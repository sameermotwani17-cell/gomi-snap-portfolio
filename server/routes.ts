import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, DbStorage, MemStorage, type IStorage } from "./storage";
import { identifyTrashItem } from "./openai";
import { beppuRules, type TrashCategory, insertFeedbackSchema, trashCategoryInfo, imageCache, CHALLENGE_CONFIG, IMPACT_CONFIG, calculateScanImpact } from "@shared/schema";
import { generateImageHash } from "./imageHash";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { systemMetrics } from "./metrics";
import { identifyTrashRateLimiter, botDetection, requestValidation, getSecurityLogs, getSecurityStats } from "./rateLimit";
import path from "path";
import fs from "fs";

// Admin endpoints use the same storage as the rest of the app
// This is already configured based on DATABASE_URL at module scope
function getAdminStorage(): IStorage {
  return storage;
}

// Check if admin access is allowed (development mode OR valid admin key)
function isAdminAccessAllowed(req: any): boolean {
  // Only allow unauthenticated access in explicit development mode
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  // In all other environments, require ADMIN_KEY
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 16) {
    // Fail closed: if ADMIN_KEY is not set or too short, deny access
    return false;
  }
  
  const providedKey = req.query.admin_key || req.headers['x-admin-key'];
  if (!providedKey || providedKey.length !== adminKey.length) {
    return false;
  }
  
  // Constant-time string comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < adminKey.length; i++) {
    result |= adminKey.charCodeAt(i) ^ providedKey.charCodeAt(i);
  }
  return result === 0;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/identify-trash", botDetection, requestValidation, identifyTrashRateLimiter, async (req, res) => {
    // Track this scan in metrics
    const endScan = systemMetrics.startScan();
    
    try {
      const { image, demoMode, language: requestLanguage, sessionId, anonymousUserId, city, latitude, longitude, locationSource, clarificationAnswer, scanId } = req.body;
      
      if (!image || typeof image !== "string") {
        endScan();
        return res.status(400).json({ error: "Image data is required" });
      }

      const language = requestLanguage === "ja" ? "ja" : "en";

      // Demo mode - return mock result for testing camera without OpenAI credits
      if (demoMode) {
        const isJapanese = language === "ja";
        const demoResults = [
          {
            itemName: isJapanese ? "ペットボトル" : "PET Bottle",
            category: "recyclable" as const,
            bagColor: "Pink",
            confidence: 0.95,
            itemCount: 1
          },
          {
            itemName: isJapanese ? "食品廃棄物" : "Food Waste",
            category: "burnable" as const,
            bagColor: "Green",
            confidence: 0.92,
            itemCount: 1
          },
          {
            itemName: isJapanese ? "アルミ缶" : "Aluminum Can",
            category: "recyclable" as const,
            bagColor: "Pink",
            confidence: 0.88,
            itemCount: 1
          }
        ];
        
        const randomResult = demoResults[Math.floor(Math.random() * demoResults.length)];
        endScan();
        return res.json(randomResult);
      }

      // Generate perceptual hash and thumbnail from image
      const { perceptualHash, thumbnailData } = await generateImageHash(image);
      
      // Skip cache lookup when clarificationAnswer is provided - we need OpenAI to process the user's response
      // The cache contains results without the clarification context
      let cachedResult = null;
      if (!clarificationAnswer) {
        // Check cache for similar images (85% similarity threshold)
        // Wrap in try-catch to handle database wake-up scenarios gracefully
        try {
          cachedResult = await storage.findSimilarImage(perceptualHash, 0.85);
        } catch (cacheError) {
          console.warn("Cache lookup skipped (database may be waking up):", 
            cacheError instanceof Error ? cacheError.message : 'Unknown error');
          // Continue without cache - will use OpenAI directly
        }
      }
      
      if (cachedResult) {
        systemMetrics.recordCacheHit();
        // Non-critical - don't fail if this errors
        storage.incrementCacheUsage(cachedResult.id).catch(err => 
          console.warn("Cache usage increment skipped:", err instanceof Error ? err.message : 'Unknown error'));
        
        // BACKWARDS COMPATIBILITY: Normalize deprecated special-recycling to city-excluded
        if (cachedResult.category === "special-recycling") {
          cachedResult.category = "city-excluded";
          console.log(`CACHE_LEGACY_MAPPING: special-recycling → city-excluded for cached result ${cachedResult.id}`);
        }
        
        const isJapanese = language === "ja";
        const categoryInfo = trashCategoryInfo[cachedResult.category as TrashCategory];
        const cachedName = isJapanese ? cachedResult.itemNameJa : cachedResult.itemNameEn;
        
        // Check if we have translation for requested language
        if (!cachedName) {
          // Cache exists but missing this language - fetch and update
          const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
          const result = await identifyTrashItem(base64Image, language, clarificationAnswer);
          
          // Update cache with missing language using storage interface (non-critical)
          storage.updateCachedTranslation(cachedResult.id, language, result.itemName)
            .catch(err => console.warn("Cache translation update skipped:", err instanceof Error ? err.message : 'Unknown error'));
          
          // Log scan event asynchronously (non-blocking) with idempotency
          (async () => {
            // Idempotency check: if scanId provided and already exists, skip logging
            if (scanId) {
              const existing = await storage.getScanEventByScanId(scanId);
              if (existing) {
                console.log('Duplicate scan detected, skipping:', scanId);
                return;
              }
            }
            return storage.logScanEvent({
              scanId: scanId ?? null,
              language,
              detectedCategory: cachedResult.category,
              detectedItemName: result.itemName,
              confidence: cachedResult.confidence,
              bagColor: isJapanese ? categoryInfo.bagColorJa : categoryInfo.bagColor,
              resultSource: 'cache',
              userAgent: req.get('user-agent') ?? null,
              sessionId: sessionId ?? 'unknown',
              city: city ?? null,
              latitude: latitude ?? null,
              longitude: longitude ?? null,
              locationSource: locationSource ?? null,
              thumbnailRef: cachedResult.id,
            });
          })().then(async (scanEvent) => {
            if (!scanEvent) return; // Skip if duplicate
            // Calculate and log impact for this scan
            try {
              const impactCalc = calculateScanImpact(result.itemName, cachedResult.category, cachedResult.confidence, city);
              await storage.logScanImpact({
                scanEventId: scanEvent.id,
                itemType: result.itemName,
                category: cachedResult.category,
                location: city ?? null,
                confidenceScore: cachedResult.confidence,
                misSortPrevented: impactCalc.misSortPrevented,
                avoidedMassKg: impactCalc.avoidedMassKg,
                avoidedCostJpy: impactCalc.avoidedCostJpy,
                avoidedCo2eKg: impactCalc.avoidedCo2eKg,
                baselineMisSortRate: IMPACT_CONFIG.BASELINE_MIS_SORT_RATE,
                disposalCostPerTon: IMPACT_CONFIG.DISPOSAL_COST_PER_TON_JPY,
                emissionFactor: IMPACT_CONFIG.INCINERATION_EMISSION_FACTOR,
                contaminationMultiplier: IMPACT_CONFIG.CONTAMINATION_MULTIPLIER,
              });
            } catch (impactErr) { console.warn('Failed to log scan impact:', impactErr); }
            // Server-side analytics event to ensure sync with scan events
            try {
              await storage.logAnalyticsEvent({
                namespace: 'app',
                eventName: 'scan_completed',
                anonymousUserId: anonymousUserId ?? 'server_generated',
                sessionId: sessionId ?? 'unknown',
                payload: JSON.stringify({
                  scanEventId: scanEvent.id,
                  category: cachedResult.category,
                  itemName: result.itemName,
                  confidence: cachedResult.confidence,
                  source: 'server',
                  resultSource: 'cache',
                }),
              });
            } catch (analyticsErr) { console.warn('Failed to log server analytics:', analyticsErr); }
          }).catch(err => console.error('Failed to log scan event:', err));
          
          endScan();
          return res.json({
            itemName: result.itemName,
            category: cachedResult.category,
            bagColor: isJapanese ? categoryInfo.bagColorJa : categoryInfo.bagColor,
            instructions: isJapanese ? categoryInfo.instructionsJa : categoryInfo.instructionsEn,
            confidence: cachedResult.confidence,
            itemCount: 1,
            cached: true
          });
        }
        
        // Full cache hit with translation
        // Log scan event asynchronously (non-blocking) with idempotency
        (async () => {
          // Idempotency check: if scanId provided and already exists, skip logging
          if (scanId) {
            const existing = await storage.getScanEventByScanId(scanId);
            if (existing) {
              console.log('Duplicate scan detected, skipping:', scanId);
              return;
            }
          }
          return storage.logScanEvent({
            scanId: scanId ?? null,
            language,
            detectedCategory: cachedResult.category,
            detectedItemName: cachedName,
            confidence: cachedResult.confidence,
            bagColor: isJapanese ? categoryInfo.bagColorJa : categoryInfo.bagColor,
            resultSource: 'cache',
            userAgent: req.get('user-agent') ?? null,
            sessionId: sessionId ?? 'unknown',
            city: city ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            locationSource: locationSource ?? null,
            thumbnailRef: cachedResult.id,
          });
        })().then(async (scanEvent) => {
          if (!scanEvent) return; // Skip if duplicate
          // Calculate and log impact for this scan
          try {
            const impactCalc = calculateScanImpact(cachedName || 'Unknown', cachedResult.category, cachedResult.confidence, city);
            await storage.logScanImpact({
              scanEventId: scanEvent.id,
              itemType: cachedName || 'Unknown',
              category: cachedResult.category,
              location: city ?? null,
              confidenceScore: cachedResult.confidence,
              misSortPrevented: impactCalc.misSortPrevented,
              avoidedMassKg: impactCalc.avoidedMassKg,
              avoidedCostJpy: impactCalc.avoidedCostJpy,
              avoidedCo2eKg: impactCalc.avoidedCo2eKg,
              baselineMisSortRate: IMPACT_CONFIG.BASELINE_MIS_SORT_RATE,
              disposalCostPerTon: IMPACT_CONFIG.DISPOSAL_COST_PER_TON_JPY,
              emissionFactor: IMPACT_CONFIG.INCINERATION_EMISSION_FACTOR,
              contaminationMultiplier: IMPACT_CONFIG.CONTAMINATION_MULTIPLIER,
            });
          } catch (impactErr) { console.warn('Failed to log scan impact:', impactErr); }
          // Server-side analytics event to ensure sync with scan events
          try {
            await storage.logAnalyticsEvent({
              namespace: 'app',
              eventName: 'scan_completed',
              anonymousUserId: anonymousUserId ?? 'server_generated',
              sessionId: sessionId ?? 'unknown',
              payload: JSON.stringify({
                scanEventId: scanEvent.id,
                category: cachedResult.category,
                itemName: cachedName,
                confidence: cachedResult.confidence,
                source: 'server',
                resultSource: 'cache',
              }),
            });
          } catch (analyticsErr) { console.warn('Failed to log server analytics:', analyticsErr); }
        }).catch(err => console.error('Failed to log scan event:', err));
        
        // Challenge scan validation and recording for cache hits (await to ensure data integrity)
        let challengeStatus: { isValid: boolean; reason?: string; dailyCount?: number } = { isValid: true };
        if (anonymousUserId && perceptualHash) {
          try {
            challengeStatus = await storage.validateChallengeScan(anonymousUserId, perceptualHash, cachedResult.confidence);
            const currentMonth = new Date().toISOString().substring(0, 7);
            await storage.recordChallengeScan({
              anonymousUserId,
              sessionId: sessionId ?? 'unknown',
              perceptualHash,
              category: cachedResult.category,
              itemName: cachedName || 'Unknown',
              confidence: cachedResult.confidence,
              isValid: challengeStatus.isValid,
              invalidReason: challengeStatus.reason ?? null,
              challengeMonth: currentMonth,
            });
          } catch (err) {
            console.error('Challenge validation/recording error:', err);
          }
        }
        
        endScan();
        return res.json({
          itemName: cachedName,
          category: cachedResult.category,
          bagColor: isJapanese ? categoryInfo.bagColorJa : categoryInfo.bagColor,
          instructions: isJapanese ? cachedResult.instructionsJa : cachedResult.instructionsEn,
          confidence: cachedResult.confidence,
          itemCount: 1,
          cached: true,
          challengeStatus: anonymousUserId ? challengeStatus : undefined,
        });
      }

      // Cache miss - call OpenAI API once for requested language
      systemMetrics.recordOpenAICall();
      const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
      
      if (clarificationAnswer) {
        console.log(`CLARIFICATION_REQUEST: question="${clarificationAnswer.question}", answer=${clarificationAnswer.answer}, language=${language}`);
      }
      
      const result = await identifyTrashItem(base64Image, language, clarificationAnswer);
      
      // EARLY EXIT GATE: Reject non-waste scans immediately (zero-cost: no caching, no impact calc, no logging overhead)
      if (result.category === "invalid-scan") {
        console.log(`INVALID_SCAN: ${result.rejectionReason || "UNKNOWN"} - ${result.itemName}`);
        endScan();
        const categoryInfo = trashCategoryInfo["invalid-scan"];
        let instructions: string = language === "ja" ? categoryInfo.instructionsJa : categoryInfo.instructionsEn;
        if (result.rejectionReason === "UNCOLLECTABLE") {
          instructions = language === "ja"
            ? "この品目は別府市では収集できません。専門業者やメーカーにお問い合わせください。下記の連絡先をご利用ください。"
            : "This item cannot be collected by Beppu City. Please contact a specialized vendor or manufacturer. See the contact info below.";
        }
        return res.json({
          itemName: result.itemName,
          category: "invalid-scan",
          bagColor: "N/A",
          instructions,
          confidence: 0,
          itemCount: 0,
          isRejection: true,
          rejectionReason: result.rejectionReason || "UNKNOWN",
          cached: false
        });
      }
      
      // BACKWARDS COMPATIBILITY: Map deprecated special-recycling to city-excluded
      // The prompt no longer outputs special-recycling, but cached data or edge cases may still have it
      if (result.category === "special-recycling") {
        result.category = "city-excluded";
        console.log(`LEGACY_MAPPING: special-recycling → city-excluded for ${result.itemName}`);
      }
      
      // CITY-EXCLUDED: Identifiable items not collected by city (laptops, TVs, fridges, etc.)
      // These are valid identifications - log them but with special instructions
      if (result.category === "city-excluded") {
        console.log(`CITY_EXCLUDED: ${result.itemName} (confidence: ${result.confidence})`);
        endScan();
        const categoryInfo = trashCategoryInfo["city-excluded"];
        return res.json({
          itemName: result.itemName,
          category: "city-excluded",
          bagColor: "N/A",
          instructions: language === "ja" ? categoryInfo.instructionsJa : categoryInfo.instructionsEn,
          confidence: result.confidence,
          itemCount: result.itemCount || 1,
          isCityExcluded: true,
          cached: false
        });
      }
      
      // Guard against infinite clarification loops
      if (result.needsClarification && clarificationAnswer) {
        console.error("AI still needs clarification after answer provided - finalizing with best guess");
        // Force finalization with the current result
        result.needsClarification = false;
        result.clarificationQuestion = undefined;
      }
      
      // If clarification needed (and no answer was provided), return immediately without caching
      if (result.needsClarification) {
        const categoryInfo = trashCategoryInfo[result.category as TrashCategory] || trashCategoryInfo["burnable"];
        endScan();
        return res.json({
          itemName: result.itemName,
          category: result.category,
          bagColor: result.bagColor,
          instructions: (language === "ja" ? categoryInfo.instructionsJa : categoryInfo.instructionsEn) + " " + (language === "ja" ? "(確認が必要です)" : "(Clarification needed)"),
          confidence: result.confidence,
          itemCount: result.itemCount,
          needsClarification: true,
          clarificationQuestion: result.clarificationQuestion,
          capInstructions: result.capInstructions,
          cached: false
        });
      }
      
      if (clarificationAnswer) {
        console.log(`CLARIFICATION_RESULT: category="${result.category}", item="${result.itemName}", confidence=${result.confidence}`);
      }
      
      // Cache the result (other language will be filled on first request in that language)
      const categoryInfo = trashCategoryInfo[result.category as TrashCategory] || trashCategoryInfo["burnable"];
      
      // Try to cache but don't fail if database is unavailable
      let cachedImageId: string | null = null;
      try {
        const cachedImage = await storage.cacheImageResult({
          perceptualHash,
          thumbnailData,
          category: result.category,
          itemNameEn: language === "en" ? result.itemName : null,
          itemNameJa: language === "ja" ? result.itemName : null,
          confidence: result.confidence,
          instructionsEn: categoryInfo.instructionsEn,
          instructionsJa: categoryInfo.instructionsJa,
        });
        cachedImageId = cachedImage.id;
      } catch (cacheError) {
        console.warn("Cache save skipped (database may be waking up):", 
          cacheError instanceof Error ? cacheError.message : 'Unknown error');
      }
      
      // Log scan event asynchronously (non-blocking)
      const isJapanese = language === "ja";
      // Log scan event asynchronously (non-blocking) with idempotency
      (async () => {
        // Idempotency check: if scanId provided and already exists, skip logging
        if (scanId) {
          const existing = await storage.getScanEventByScanId(scanId);
          if (existing) {
            console.log('Duplicate scan detected, skipping:', scanId);
            return;
          }
        }
        return storage.logScanEvent({
          scanId: scanId ?? null,
          language,
          detectedCategory: result.category,
          detectedItemName: result.itemName,
          confidence: result.confidence,
          bagColor: isJapanese ? categoryInfo.bagColorJa : categoryInfo.bagColor,
          resultSource: 'openai',
          userAgent: req.get('user-agent') ?? null,
          sessionId: sessionId ?? 'unknown',
          city: city ?? null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          locationSource: locationSource ?? null,
          thumbnailRef: cachedImageId,
        });
      })().then(async (scanEvent) => {
        if (!scanEvent) return; // Skip if duplicate
        // Calculate and log impact for this scan
        try {
          const impact = calculateScanImpact(
            result.itemName,
            result.category,
            result.confidence,
            city
          );
          await storage.logScanImpact({
            scanEventId: scanEvent.id,
            itemType: result.itemName,
            category: result.category,
            location: city ?? null,
            confidenceScore: result.confidence,
            misSortPrevented: impact.misSortPrevented,
            avoidedMassKg: impact.avoidedMassKg,
            avoidedCostJpy: impact.avoidedCostJpy,
            avoidedCo2eKg: impact.avoidedCo2eKg,
            baselineMisSortRate: IMPACT_CONFIG.BASELINE_MIS_SORT_RATE,
            disposalCostPerTon: IMPACT_CONFIG.DISPOSAL_COST_PER_TON_JPY,
            emissionFactor: IMPACT_CONFIG.INCINERATION_EMISSION_FACTOR,
            contaminationMultiplier: IMPACT_CONFIG.CONTAMINATION_MULTIPLIER,
          });
        } catch (impactErr) {
          console.warn('Failed to log scan impact:', impactErr);
        }
        // Server-side analytics event to ensure sync with scan events
        try {
          await storage.logAnalyticsEvent({
            namespace: 'app',
            eventName: 'scan_completed',
            anonymousUserId: anonymousUserId ?? 'server_generated',
            sessionId: sessionId ?? 'unknown',
            payload: JSON.stringify({
              scanEventId: scanEvent.id,
              category: result.category,
              itemName: result.itemName,
              confidence: result.confidence,
              source: 'server',
              resultSource: 'openai',
            }),
          });
        } catch (analyticsErr) { console.warn('Failed to log server analytics:', analyticsErr); }
      }).catch(err => console.error('Failed to log scan event:', err));
      
      // Challenge scan validation and recording (await to ensure data integrity)
      let challengeStatus: { isValid: boolean; reason?: string; dailyCount?: number } = { isValid: true };
      if (anonymousUserId && perceptualHash) {
        try {
          challengeStatus = await storage.validateChallengeScan(anonymousUserId, perceptualHash, result.confidence);
          const currentMonth = new Date().toISOString().substring(0, 7);
          await storage.recordChallengeScan({
            anonymousUserId,
            sessionId: sessionId ?? 'unknown',
            perceptualHash,
            category: result.category,
            itemName: result.itemName,
            confidence: result.confidence,
            isValid: challengeStatus.isValid,
            invalidReason: challengeStatus.reason ?? null,
            challengeMonth: currentMonth,
          });
        } catch (err) {
          console.error('Challenge validation/recording error:', err);
        }
      }
      
      endScan();
      res.json({ 
        ...result, 
        instructions: isJapanese ? categoryInfo.instructionsJa : categoryInfo.instructionsEn,
        cached: false,
        challengeStatus: anonymousUserId ? challengeStatus : undefined,
      });
    } catch (error) {
      endScan();
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      systemMetrics.recordError(errorMessage);
      const isClarification = !!req.body?.clarificationAnswer;
      console.error(`Error identifying trash (clarification=${isClarification}):`, error);
      
      // If OpenAI quota exceeded, return demo mode flag with 200 status
      if (error instanceof Error && error.message.includes("quota")) {
        return res.status(200).json({ 
          useDemoMode: true
        });
      }
      
      // Return specific error code for client-side handling
      const errorCode = error instanceof Error && error.message.includes("rate") ? "RATE_LIMITED"
        : error instanceof Error && error.message.includes("timeout") ? "TIMEOUT"
        : error instanceof Error && error.message.includes("JSON") ? "PARSE_ERROR"
        : "SERVER_ERROR";
      
      res.status(500).json({ 
        error: "Failed to identify trash item",
        errorCode,
        isClarification,
      });
    }
  });

  app.post("/api/explain-trash", async (req, res) => {
    try {
      const { category, itemName, language: requestLanguage } = req.body;
      
      if (!category || !itemName) {
        return res.status(400).json({ error: "Category and itemName are required" });
      }

      // invalid-scan items don't have disposal rules to explain
      if (category === "invalid-scan") {
        return res.status(400).json({ error: "No disposal rules for rejected scans" });
      }

      const language = requestLanguage === "ja" ? "ja" : "en";
      const isJapanese = language === "ja";
      
      // Get the Beppu City rules for this category
      const rules = beppuRules[category as TrashCategory];
      
      if (!rules) {
        return res.status(400).json({ error: "Invalid category" });
      }
      
      // Build explanation based on category
      let explanation = "";
      
      if (isJapanese) {
        explanation = `検出されたアイテム: ${itemName}\n\n`;
        explanation += `別府市ルール: `;
        
        if (category === "burnable") {
          explanation += `燃えるゴミ（緑色の袋）\n食品残渣、プラスチック容器、ゴム製品、革製品などが含まれます。`;
        } else if (category === "non-burnable") {
          explanation += `燃えないゴミ（透明な袋）\n金属製品、陶器、電池、小型家電などが含まれます。鋭利なものは紙で包んでください。`;
        } else if (category === "recyclable") {
          explanation += `缶・瓶・ペット（ピンク色の袋）\nよく洗ってからピンク色の袋に入れてください。汚れた缶や瓶は燃えないゴミになります。`;
        } else if (category === "old-paper-clothing") {
          explanation += `古紙・衣類（半透明な袋）\n新聞、段ボール、きれいな衣類が含まれます。ひどく汚れたものは燃えるゴミになります。`;
        } else if (category === "oversized") {
          explanation += `粗大ゴミ（赤いシール）\n環境課（0977-66-5349）に電話し、手数料を支払い、赤いシールを貼ってください。`;
        } else if (category === "city-excluded") {
          explanation += `メーカーリサイクル\n別府市では収集していません。購入した小売店またはメーカーに連絡してください。家電リサイクル法が適用されます。`;
        } else {
          explanation += `特別リサイクル\n購入した小売店またはメーカーに連絡してください。家電リサイクル法が適用されます。`;
        }
        
        explanation += `\n\n準備ステップ: `;
        if (category === "recyclable") {
          explanation += `よく洗って、キャップとラベルを外してください。`;
        } else if (category === "non-burnable") {
          explanation += `鋭利なものは紙で包んでください。電池は端子にテープを貼ってください。`;
        } else if (category === "old-paper-clothing") {
          explanation += `紙は束ねてください。衣類はきれいな状態で出してください。`;
        } else {
          explanation += `特に準備は必要ありません。`;
        }
      } else {
        explanation = `Detected Item: ${itemName}\n\n`;
        explanation += `Beppu City Rule: `;
        
        if (category === "burnable") {
          explanation += `Burnable (Green bag)\nIncludes food waste, plastic containers, rubber goods, leather goods, etc.`;
        } else if (category === "non-burnable") {
          explanation += `Non-Burnable (Transparent bag)\nIncludes metal goods, ceramics, batteries, small appliances, etc. Wrap sharp items in paper.`;
        } else if (category === "recyclable") {
          explanation += `Cans/Glass/PET (Pink bag)\nRinse thoroughly before placing in pink bag. Dirty cans/bottles go in non-burnable.`;
        } else if (category === "old-paper-clothing") {
          explanation += `Old Papers/Clothing (Half-transparent bag)\nIncludes newspapers, cardboard, clean clothing. Badly stained items go in burnable.`;
        } else if (category === "oversized") {
          explanation += `Oversized (Red sticker)\nCall Environment Division (0977-66-5349), pay fee, attach red sticker.`;
        } else if (category === "city-excluded") {
          explanation += `Manufacturer Recycling\nThis item is NOT collected by Beppu City. Contact the manufacturer, retailer, or an authorized recycling service.`;
        } else {
          explanation += `Special Recycling\nContact retailer or manufacturer. Home Appliance Recycling Law applies.`;
        }
        
        explanation += `\n\nPreparation Steps: `;
        if (category === "recyclable") {
          explanation += `Rinse thoroughly, remove caps and labels.`;
        } else if (category === "non-burnable") {
          explanation += `Wrap sharp items in paper. Tape battery terminals.`;
        } else if (category === "old-paper-clothing") {
          explanation += `Tie papers in bundles. Clothing must be clean.`;
        } else {
          explanation += `No special preparation needed.`;
        }
      }
      
      res.json({ explanation });
    } catch (error) {
      console.error("Error generating explanation:", error);
      res.status(500).json({ error: "Failed to generate explanation" });
    }
  });

  app.get("/api/feedback", async (req, res) => {
    // Only allow access to feedback in development mode (Replit admin)
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const adminStorage = getAdminStorage();
      const feedbackList = await adminStorage.getAllFeedback();
      res.json(feedbackList);
    } catch (error) {
      console.error("Error retrieving feedback:", error);
      res.status(500).json({ error: "Failed to retrieve feedback" });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const validated = insertFeedbackSchema.parse(req.body);
      const adminStorage = getAdminStorage();
      
      // Retry logic for database wake-up scenarios (up to 3 attempts with backoff)
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const feedback = await adminStorage.createFeedback(validated);
          
          // Log feedback submission for debugging
          console.log(`📝 FEEDBACK SAVED:`, {
            id: feedback.id,
            issueType: feedback.issueType,
            environment: process.env.NODE_ENV || 'unknown',
            timestamp: new Date().toISOString()
          });
          
          return res.json(feedback);
        } catch (dbError) {
          lastError = dbError instanceof Error ? dbError : new Error('Unknown error');
          console.warn(`Feedback save attempt ${attempt}/3 failed (database may be waking up):`, lastError.message);
          
          // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
          }
        }
      }
      
      // All retries failed - return 503 with retry guidance
      console.error("❌ Feedback save failed after 3 attempts:", lastError?.message);
      res.status(503).json({ 
        error: "Service temporarily unavailable", 
        message: "Please try again in a few seconds",
        retryable: true
      });
    } catch (validationError) {
      console.error("❌ Error validating feedback:", validationError);
      res.status(400).json({ error: "Invalid feedback data" });
    }
  });

  app.delete("/api/feedback/:id", async (req, res) => {
    // Only allow access to feedback in development mode (Replit admin)
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const adminStorage = getAdminStorage();
      await adminStorage.deleteFeedback(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting feedback:", error);
      res.status(500).json({ error: "Failed to delete feedback" });
    }
  });

  app.delete("/api/feedback", async (req, res) => {
    // Only allow access to feedback in development mode (Replit admin)
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const adminStorage = getAdminStorage();
      await adminStorage.deleteAllFeedback();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing all feedback:", error);
      res.status(500).json({ error: "Failed to clear all feedback" });
    }
  });

  app.patch("/api/feedback/:id/pin", async (req, res) => {
    // Only allow access to feedback in development mode (Replit admin)
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const adminStorage = getAdminStorage();
      const updated = await adminStorage.togglePinFeedback(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling pin:", error);
      res.status(500).json({ error: "Failed to toggle pin" });
    }
  });

  // Server start time for "since server start" metrics
  const serverStartTime = new Date().toISOString();

  // Database health check endpoint
  app.get("/api/admin/health/db", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      // Check database connectivity
      const dbType = storage instanceof DbStorage ? 'postgresql' : 'memory';
      const dbConnected = dbType === 'postgresql' ? await (storage as DbStorage).checkConnection() : true;
      
      // Get database name (sanitized - hide connection details)
      const dbUrl = process.env.DATABASE_URL;
      let dbName = 'memory';
      if (dbUrl) {
        try {
          const url = new URL(dbUrl);
          dbName = url.pathname.replace('/', '') || 'default';
        } catch {
          dbName = 'configured';
        }
      }

      // Get git commit if available
      let gitCommit = 'unknown';
      try {
        const gitPath = path.join(process.cwd(), '.git', 'HEAD');
        if (fs.existsSync(gitPath)) {
          const head = fs.readFileSync(gitPath, 'utf-8').trim();
          if (head.startsWith('ref:')) {
            const refPath = path.join(process.cwd(), '.git', head.replace('ref: ', ''));
            if (fs.existsSync(refPath)) {
              gitCommit = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
            }
          } else {
            gitCommit = head.substring(0, 7);
          }
        }
      } catch { /* ignore git errors */ }

      // Get table counts for consistency check
      const scanCount = await storage.getScanEventCount();
      const analyticsCount = await storage.getAnalyticsEventCount();

      res.json({
        environment: process.env.NODE_ENV || 'development',
        database: {
          type: dbType,
          name: dbName,
          connected: dbConnected,
        },
        serverStartTime,
        gitCommit,
        tableCounts: {
          trashScanEvents: scanCount,
          analyticsEvents: analyticsCount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed', details: String(error) });
    }
  });

  app.post("/api/admin/clear-table", async (req, res) => {
    // Only allow access in development mode (Replit admin)
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { tableName } = req.body;
      
      // Validate table name
      if (!["feedback", "imageCache", "trashScanEvents"].includes(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      const adminStorage = getAdminStorage();
      await adminStorage.clearTable(tableName as "feedback" | "imageCache" | "trashScanEvents");
      
      res.json({ success: true, message: `Table ${tableName} cleared successfully` });
    } catch (error) {
      console.error("Error clearing table:", error);
      res.status(500).json({ error: "Failed to clear table" });
    }
  });

  // Analytics endpoints (admin only)
  app.get("/api/admin/analytics/summary", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  app.get("/api/admin/analytics/events", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const events = await storage.getScanEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching scan events:", error);
      res.status(500).json({ error: "Failed to fetch scan events" });
    }
  });

  app.get("/api/admin/analytics/by-city/:city", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const events = await storage.getScanEventsByCity(req.params.city);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by city:", error);
      res.status(500).json({ error: "Failed to fetch events by city" });
    }
  });

  app.get("/api/admin/analytics/by-category/:category", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const events = await storage.getScanEventsByCategory(req.params.category);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by category:", error);
      res.status(500).json({ error: "Failed to fetch events by category" });
    }
  });

  app.get("/api/admin/analytics/timeline", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const events = await storage.getScanEventsByDateRange(
        startDate as string,
        endDate as string
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by date range:", error);
      res.status(500).json({ error: "Failed to fetch events by date range" });
    }
  });

  // Event logging endpoint (public - used by frontend)
  // Simple in-memory rate limiter (per IP, 100 requests per minute)
  const eventRateLimiter = new Map<string, { count: number; resetTime: number }>();
  const MAX_EVENTS_PER_MIN = 100;
  const RATE_LIMIT_WINDOW_MS = 60000;
  
  // Valid event names (whitelist) - includes impact report events
  const VALID_EVENT_NAMES = [
    'app_opened', 'page_viewed', 'scan_started', 'scan_completed', 'clarification_shown',
    'clarification_answered', 'why_opened', 'quick_item_selected', 
    'feedback_submitted', 'classification_finalized',
    // Impact report events (invisible to users)
    'guidance_shown', 'guidance_confirmed', 'guidance_rejected',
    'disposal_completed', 'rules_viewed', 'location_selected',
    'language_selected', 'returning_user', 'qr_scan'
  ];
  
  app.post("/api/events", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const clientLimit = eventRateLimiter.get(clientIp);
      
      if (clientLimit && now < clientLimit.resetTime) {
        if (clientLimit.count >= MAX_EVENTS_PER_MIN) {
          return res.status(429).json({ error: "Too many requests" });
        }
        clientLimit.count++;
      } else {
        eventRateLimiter.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      }
      
      const { eventName, anonymousUserId, sessionId, pilotLocationId, payload, namespace } = req.body;
      
      // Validate required fields
      if (!eventName || !anonymousUserId || !sessionId) {
        return res.status(400).json({ error: "eventName, anonymousUserId, and sessionId are required" });
      }
      
      // Validate namespace (default to 'app' if not specified, for backwards compatibility)
      const validNamespace = namespace === 'website' ? 'website' : 'app';
      
      // Validate event name against whitelist
      if (!VALID_EVENT_NAMES.includes(eventName)) {
        return res.status(400).json({ error: "Invalid event name" });
      }
      
      // Validate string lengths
      if (anonymousUserId.length > 100 || sessionId.length > 100 || (pilotLocationId && pilotLocationId.length > 50)) {
        return res.status(400).json({ error: "Invalid field length" });
      }
      
      // Limit payload size (max 2KB)
      let sanitizedPayload: string | null = null;
      if (payload) {
        const payloadStr = JSON.stringify(payload);
        if (payloadStr.length > 2048) {
          // Truncate payload to essential fields only
          const trimmedPayload: Record<string, unknown> = {};
          if (payload.category) trimmedPayload.category = String(payload.category).slice(0, 50);
          if (payload.itemName) trimmedPayload.itemName = String(payload.itemName).slice(0, 100);
          if (payload.confidence !== undefined) trimmedPayload.confidence = Number(payload.confidence);
          if (payload.helpful !== undefined) trimmedPayload.helpful = payload.helpful;
          sanitizedPayload = JSON.stringify(trimmedPayload);
        } else {
          sanitizedPayload = payloadStr;
        }
      }
      
      // Log analytics event - but don't fail the request if database is unavailable
      try {
        await storage.logAnalyticsEvent({
          namespace: validNamespace,
          eventName,
          anonymousUserId,
          sessionId,
          pilotLocationId: pilotLocationId || null,
          payload: sanitizedPayload,
        });
      } catch (dbError) {
        // Log the error but don't fail the request - analytics should never block UX
        console.warn("Analytics logging skipped (database may be waking up):", 
          dbError instanceof Error ? dbError.message : 'Unknown error');
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error in events endpoint:", error);
      // Still return success - analytics failures should not break the app
      res.json({ success: true });
    }
  });

  // Enhanced analytics endpoints for investor dashboard
  app.get("/api/admin/analytics/funnel", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const funnel = await storage.getFunnelAnalytics();
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching funnel analytics:", error);
      res.status(500).json({ error: "Failed to fetch funnel analytics" });
    }
  });

  app.get("/api/admin/analytics/clarifications", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const clarifications = await storage.getClarificationAnalytics();
      res.json(clarifications);
    } catch (error) {
      console.error("Error fetching clarification analytics:", error);
      res.status(500).json({ error: "Failed to fetch clarification analytics" });
    }
  });

  app.get("/api/admin/analytics/feedback", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const feedback = await storage.getFeedbackAnalytics();
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback analytics:", error);
      res.status(500).json({ error: "Failed to fetch feedback analytics" });
    }
  });

  // New endpoint for individual post-scan feedback entries
  app.get("/api/admin/analytics/post-scan-feedback", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const feedbackList = await storage.getPostScanFeedbackList(limit);
      const summary = await storage.getFeedbackAnalytics();
      res.json({ feedbackList, summary });
    } catch (error) {
      console.error("Error fetching post-scan feedback:", error);
      res.status(500).json({ error: "Failed to fetch post-scan feedback" });
    }
  });

  app.get("/api/admin/analytics/daily-users", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const dailyUsers = await storage.getDailyActiveUsers(days);
      res.json(dailyUsers);
    } catch (error) {
      console.error("Error fetching daily active users:", error);
      res.status(500).json({ error: "Failed to fetch daily active users" });
    }
  });

  app.get("/api/admin/analytics/unique-users", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const uniqueUsers = await storage.getUniqueUsers();
      res.json({ uniqueUsers });
    } catch (error) {
      console.error("Error fetching unique users:", error);
      res.status(500).json({ error: "Failed to fetch unique users" });
    }
  });

  app.get("/api/admin/analytics/event-counts", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const eventCounts = await storage.getEventCounts();
      res.json(eventCounts);
    } catch (error) {
      console.error("Error fetching event counts:", error);
      res.status(500).json({ error: "Failed to fetch event counts" });
    }
  });

  // Page views analytics endpoint
  app.get("/api/admin/analytics/page-views", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      // Get all events and filter for page_viewed
      const allEvents = await storage.getAnalyticsEvents(1000);
      const pageViewEvents = allEvents.filter((e: { eventName: string }) => e.eventName === 'page_viewed');
      
      // Count by page
      const pageStats: Record<string, number> = {};
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      let todayViews = 0;
      
      for (const event of pageViewEvents) {
        let payload: Record<string, unknown> = {};
        try {
          payload = event.payload ? JSON.parse(event.payload) : {};
        } catch (e) {
          // Skip malformed payloads
        }
        const page = (payload.page as string) || 'unknown';
        pageStats[page] = (pageStats[page] || 0) + 1;
        
        // Count today's views
        const eventDate = new Date(event.createdAt);
        if (eventDate >= todayStart) {
          todayViews++;
        }
      }
      
      // Get unique visitors from page_viewed events
      const uniqueVisitors = new Set(pageViewEvents.map((e: { anonymousUserId: string }) => e.anonymousUserId)).size;
      
      res.json({
        totalPageViews: pageViewEvents.length,
        todayPageViews: todayViews,
        uniqueVisitors,
        byPage: pageStats
      });
    } catch (error) {
      console.error("Error fetching page views:", error);
      res.status(500).json({ error: "Failed to fetch page views" });
    }
  });

  // User retention analytics endpoint
  app.get("/api/admin/analytics/retention", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const retention = await storage.getUserRetentionAnalytics();
      res.json(retention);
    } catch (error) {
      console.error("Error fetching user retention analytics:", error);
      res.status(500).json({ error: "Failed to fetch user retention analytics" });
    }
  });

  // Challenge leaderboard endpoint (public)
  app.get("/api/challenge/leaderboard", async (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const leaderboard = await storage.getChallengeLeaderboard(month, limit);
      res.json({ 
        month, 
        leaderboard,
        config: {
          dailyCap: CHALLENGE_CONFIG.DAILY_SCAN_CAP,
          minConfidence: CHALLENGE_CONFIG.MIN_CONFIDENCE_THRESHOLD,
          cooldownMinutes: CHALLENGE_CONFIG.DUPLICATE_COOLDOWN_MINUTES,
        }
      });
    } catch (error) {
      console.error("Error fetching challenge leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // User's own challenge stats (public)
  app.get("/api/challenge/stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const stats = await storage.getUserChallengeStats(userId, month);
      res.json({ 
        month, 
        ...stats,
        config: {
          dailyCap: CHALLENGE_CONFIG.DAILY_SCAN_CAP,
          minConfidence: CHALLENGE_CONFIG.MIN_CONFIDENCE_THRESHOLD,
        }
      });
    } catch (error) {
      console.error("Error fetching user challenge stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin challenge management endpoint
  app.get("/api/admin/challenge/overview", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const leaderboard = await storage.getChallengeLeaderboard(month, 50);
      
      // Calculate aggregate stats
      const totalParticipants = leaderboard.length;
      const totalValidScans = leaderboard.reduce((sum, u) => sum + u.validScans, 0);
      const totalInvalidScans = leaderboard.reduce((sum, u) => sum + (u.totalScans - u.validScans), 0);
      const avgConfidence = leaderboard.length > 0 
        ? leaderboard.reduce((sum, u) => sum + u.avgConfidence, 0) / leaderboard.length 
        : 0;
      
      res.json({
        month,
        totalParticipants,
        totalValidScans,
        totalInvalidScans,
        invalidRate: totalValidScans + totalInvalidScans > 0 
          ? Math.round((totalInvalidScans / (totalValidScans + totalInvalidScans)) * 100) / 100 
          : 0,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        topUsers: leaderboard.slice(0, 10),
        config: CHALLENGE_CONFIG,
      });
    } catch (error) {
      console.error("Error fetching challenge overview:", error);
      res.status(500).json({ error: "Failed to fetch challenge overview" });
    }
  });

  // ============================================
  // INSTITUTIONAL IMPACT REPORT ENDPOINTS
  // ============================================

  // Get impact KPIs with optional filters
  app.get("/api/admin/impact/kpis", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId, startDate, endDate } = req.query;
      const kpis = await storage.getImpactKPIs(
        locationId as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching impact KPIs:", error);
      res.status(500).json({ error: "Failed to fetch impact KPIs" });
    }
  });

  // Get weekly trends
  app.get("/api/admin/impact/trends", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId, weeks } = req.query;
      const trends = await storage.getWeeklyTrends(
        locationId as string | undefined,
        weeks ? parseInt(weeks as string) : 12
      );
      res.json(trends);
    } catch (error) {
      console.error("Error fetching weekly trends:", error);
      res.status(500).json({ error: "Failed to fetch weekly trends" });
    }
  });

  // Get baseline comparison for a location
  app.get("/api/admin/impact/baseline/:locationId", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId } = req.params;
      const comparison = await storage.getBaselineComparison(locationId);
      if (!comparison) {
        return res.status(404).json({ error: "Baseline not configured for this location" });
      }
      res.json(comparison);
    } catch (error) {
      console.error("Error fetching baseline comparison:", error);
      res.status(500).json({ error: "Failed to fetch baseline comparison" });
    }
  });

  // Location management
  app.get("/api/admin/impact/locations", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const locations = await storage.getAllImpactLocations();
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.post("/api/admin/impact/locations", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const location = await storage.createImpactLocation(req.body);
      res.json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  app.put("/api/admin/impact/locations/:id/baseline", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { id } = req.params;
      const { startDate, endDate } = req.body;
      const location = await storage.updateImpactLocationBaseline(id, startDate, endDate);
      res.json(location);
    } catch (error) {
      console.error("Error updating baseline:", error);
      res.status(500).json({ error: "Failed to update baseline" });
    }
  });

  // Record an outcome (guidance followed/ignored)
  app.post("/api/admin/impact/outcomes", async (req, res) => {
    try {
      const outcome = await storage.recordOutcome(req.body);
      res.json(outcome);
    } catch (error) {
      console.error("Error recording outcome:", error);
      res.status(500).json({ error: "Failed to record outcome" });
    }
  });

  // Export endpoints
  app.get("/api/admin/export/events", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId, startDate, endDate, format } = req.query;
      const events = await storage.exportImpactEvents(
        locationId as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined
      );

      if (format === 'csv') {
        // Generate CSV
        if (events.length === 0) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
          return res.send('No events found');
        }
        const headers = Object.keys(events[0]).join(',');
        const rows = events.map(e => Object.values(e).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
        const csv = [headers, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
        return res.send(csv);
      }

      res.json(events);
    } catch (error) {
      console.error("Error exporting events:", error);
      res.status(500).json({ error: "Failed to export events" });
    }
  });

  app.get("/api/admin/export/kpis", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId, format } = req.query;
      const summary = await storage.exportImpactKPISummary(locationId as string | undefined);

      if (format === 'csv') {
        // Flatten KPIs to CSV
        const kpis = summary.kpis as Record<string, unknown>;
        const rows = Object.entries(kpis).map(([key, value]) => `"${key}","${value}"`);
        const csv = ['metric,value', ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="kpis.csv"');
        return res.send(csv);
      }

      res.json(summary);
    } catch (error) {
      console.error("Error exporting KPIs:", error);
      res.status(500).json({ error: "Failed to export KPIs" });
    }
  });

  app.get("/api/admin/export/report", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId } = req.query;
      const summary = await storage.exportImpactKPISummary(locationId as string | undefined);
      
      // Add additional report metadata
      const report = {
        ...summary,
        reportType: 'Institutional Impact Report',
        reportVersion: '1.0',
        pilotProgram: 'GOMI SNAP',
        targetDate: 'April 2026',
        disclaimer: 'This report contains proxy metrics and estimates based on app usage data.',
      };

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ============================================
  // IMPACT ANALYTICS ENGINE ENDPOINTS
  // ============================================

  // Backfill historical scans with impact data
  app.post("/api/admin/impact-analytics/backfill", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const result = await storage.backfillScanImpacts();
      res.json({
        success: true,
        message: `Backfill complete: processed ${result.processed} scans, ${result.impacted} prevented mis-sorts`,
        ...result,
      });
    } catch (error) {
      console.error("Error backfilling impact data:", error);
      res.status(500).json({ error: "Failed to backfill impact data" });
    }
  });

  // Backfill analytics events from existing scan events to sync the databases
  app.post("/api/admin/analytics/backfill-scans", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      // Get all scan events
      const scanEvents = await storage.getScanEvents();
      
      // Get existing scan_completed analytics events
      const existingAnalytics = await storage.getAnalyticsEvents();
      const existingScanIds = new Set(
        existingAnalytics
          .filter(e => e.eventName === 'scan_completed')
          .map(e => {
            try {
              const payload = e.payload ? JSON.parse(e.payload) : {};
              return payload.scanEventId;
            } catch { return null; }
          })
          .filter(Boolean)
      );
      
      let created = 0;
      let skipped = 0;
      
      for (const scan of scanEvents) {
        // Skip if we already have an analytics event for this scan
        if (existingScanIds.has(scan.id)) {
          skipped++;
          continue;
        }
        
        try {
          await storage.logAnalyticsEvent({
            namespace: 'app',
            eventName: 'scan_completed',
            anonymousUserId: 'backfill_' + (scan.sessionId || 'unknown'),
            sessionId: scan.sessionId || 'unknown',
            payload: JSON.stringify({
              category: scan.detectedCategory,
              itemName: scan.detectedItemName,
              confidence: scan.confidence,
              source: 'backfill',
              resultSource: scan.resultSource,
              scanEventId: scan.id,
            }),
          });
          created++;
        } catch (err) {
          console.warn('Failed to backfill analytics event:', err);
        }
      }
      
      res.json({
        success: true,
        message: `Backfill complete: created ${created} analytics events, skipped ${skipped} (already existed)`,
        created,
        skipped,
        totalScans: scanEvents.length,
      });
    } catch (error) {
      console.error("Error backfilling analytics events:", error);
      res.status(500).json({ error: "Failed to backfill analytics events" });
    }
  });

  // Get impact summary with aggregations
  app.get("/api/admin/impact-analytics/summary", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { locationId, startDate, endDate } = req.query;
      const summary = await storage.getImpactSummary(
        locationId as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(summary);
    } catch (error) {
      console.error("Error fetching impact summary:", error);
      res.status(500).json({ error: "Failed to fetch impact summary" });
    }
  });

  // Get impact by location for comparison
  app.get("/api/admin/impact-analytics/by-location", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const byLocation = await storage.getImpactByLocation();
      res.json(byLocation);
    } catch (error) {
      console.error("Error fetching impact by location:", error);
      res.status(500).json({ error: "Failed to fetch impact by location" });
    }
  });

  // Get daily impact trend
  app.get("/api/admin/impact-analytics/daily-trend", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const days = parseInt(req.query.days as string) || 30;
      const trend = await storage.getDailyImpactTrend(Math.min(days, 90)); // Max 90 days
      res.json(trend);
    } catch (error) {
      console.error("Error fetching daily impact trend:", error);
      res.status(500).json({ error: "Failed to fetch daily impact trend" });
    }
  });

  // Export impact analytics data for audit
  app.get("/api/admin/impact-analytics/export", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const { startDate, endDate, format } = req.query;
      const data = await storage.exportImpactAnalytics(
        startDate as string | undefined,
        endDate as string | undefined
      );

      if (format === 'csv') {
        if (data.length === 0) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="impact_analytics.csv"');
          return res.send('No data');
        }
        
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
          Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="impact_analytics.csv"');
        return res.send(csv);
      }

      res.json({
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        data,
      });
    } catch (error) {
      console.error("Error exporting impact analytics:", error);
      res.status(500).json({ error: "Failed to export impact analytics" });
    }
  });

  // System health endpoint for monitoring dashboard
  app.get("/api/admin/system-health", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const health = systemMetrics.getHealthStatus();
      const capacity = systemMetrics.getCapacityInfo();
      
      // Get persisted database stats for accurate totals (in-memory resets on restart)
      let persistedStats = {
        totalScansAllTime: 0,
        totalScansToday: 0,
        uniqueUsersAllTime: 0,
        uniqueUsersToday: 0,
        feedbackCount: 0,
      };
      
      try {
        // Get today's date range in JST (UTC+9) to match app's timezone
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000; // 9 hours in milliseconds
        const nowJST = new Date(now.getTime() + jstOffset);
        const todayStartJST = new Date(nowJST.getFullYear(), nowJST.getMonth(), nowJST.getDate());
        const todayStartUTC = new Date(todayStartJST.getTime() - jstOffset);
        const todayStart = todayStartUTC.toISOString();
        const todayEnd = now.toISOString();
        
        // Query persisted data from database
        const [allTimeEvents, todayEvents, allTimeUsers, todayUsers, feedbackList] = await Promise.all([
          storage.getEventCounts(),
          storage.getEventCounts(todayStart, todayEnd),
          storage.getUniqueUsers(),
          storage.getUniqueUsers(todayStart, todayEnd),
          storage.getAllFeedback(),
        ]);
        
        persistedStats = {
          totalScansAllTime: allTimeEvents['scan_completed'] || 0,
          totalScansToday: todayEvents['scan_completed'] || 0,
          uniqueUsersAllTime: allTimeUsers,
          uniqueUsersToday: todayUsers,
          feedbackCount: feedbackList.length,
        };
      } catch (dbError) {
        console.warn("Could not fetch persisted stats from database:", dbError);
      }
      
      res.json({
        ...health,
        capacity,
        persistedStats, // Database-persisted stats (don't reset on restart)
        serverTime: new Date().toISOString(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      });
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // User stats endpoint (public - used by frontend for personal stats)
  app.get("/api/user-stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId || userId.length > 100) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  // Security logs endpoint (admin only - requires ADMIN_KEY in production)
  app.get("/api/admin/security-logs", async (req, res) => {
    // Fail closed: require ADMIN_KEY in production
    if (process.env.NODE_ENV !== "development" && !process.env.ADMIN_KEY) {
      return res.status(503).json({ error: "Security endpoint not configured" });
    }
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Cap at 100
      const logs = getSecurityLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching security logs:", error);
      res.status(500).json({ error: "Failed to fetch security logs" });
    }
  });

  // Security stats endpoint (admin only - requires ADMIN_KEY in production)
  app.get("/api/admin/security-stats", async (req, res) => {
    // Fail closed: require ADMIN_KEY in production
    if (process.env.NODE_ENV !== "development" && !process.env.ADMIN_KEY) {
      return res.status(503).json({ error: "Security endpoint not configured" });
    }
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const stats = getSecurityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching security stats:", error);
      res.status(500).json({ error: "Failed to fetch security stats" });
    }
  });

  // Serve QR codes page for printing/distribution
  app.get("/qr-codes", (req, res) => {
    const qrCodesPath = path.resolve(import.meta.dirname, "..", "client", "public", "gomi-snap-qr-codes.html");
    if (fs.existsSync(qrCodesPath)) {
      res.sendFile(qrCodesPath);
    } else {
      res.status(404).send("QR codes page not found");
    }
  });

  // Analytics consistency check endpoint
  app.get("/api/admin/analytics/consistency", async (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const scanCount = await storage.getScanEventCount();
      const analyticsCount = await storage.getAnalyticsEventCount();
      const summary = await storage.getAnalyticsSummary();
      
      // Get namespace breakdown for analytics events
      const namespaceBreakdown = await storage.getAnalyticsEventsByNamespace();
      
      // Calculate sum of scans by category
      const scansByCategoryTotal = Object.values(summary.scansByCategory).reduce((a, b) => a + b, 0);
      
      // Calculate sum of scans by city (only for scans with city data)
      const scansByCityTotal = Object.values(summary.scansByCity).reduce((a, b) => a + b, 0);
      
      const cacheHitValid = summary.cacheHitRate >= 0 && summary.cacheHitRate <= 1;
      const categoryMatches = scansByCategoryTotal === scanCount;
      
      // Validate namespace separation
      const appEventsCount = namespaceBreakdown.app || 0;
      const websiteEventsCount = namespaceBreakdown.website || 0;
      const nullNamespaceCount = namespaceBreakdown.null || 0;
      const namespaceTotal = appEventsCount + websiteEventsCount + nullNamespaceCount;
      const namespaceSeparationValid = namespaceTotal === analyticsCount;
      
      const checks = {
        totalScans: {
          value: scanCount,
          source: 'trash_scan_events table',
          status: 'ok'
        },
        scansByCategorySum: {
          value: scansByCategoryTotal,
          source: 'trash_scan_events grouped by category',
          matches: categoryMatches,
          status: categoryMatches ? 'ok' : 'warning'
        },
        analyticsEventsCount: {
          value: analyticsCount,
          source: 'analytics_events table',
          note: 'Higher than scans due to page views, app opens, and other events'
        },
        namespaceBreakdown: {
          app: appEventsCount,
          website: websiteEventsCount,
          null: nullNamespaceCount,
          total: namespaceTotal,
          valid: namespaceSeparationValid,
          status: namespaceSeparationValid ? 'ok' : 'error',
          note: 'Admin metrics filter by namespace=app only'
        },
        cacheHitRate: {
          value: summary.cacheHitRate,
          valid: cacheHitValid,
          status: cacheHitValid ? 'ok' : 'error'
        },
        serverStartTime: serverStartTime,
      };

      const overallStatus = 
        !cacheHitValid || !namespaceSeparationValid ? 'fail' : !categoryMatches ? 'warning' : 'pass';

      res.json({
        status: overallStatus,
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Consistency check error:', error);
      res.status(500).json({ error: 'Consistency check failed', details: String(error) });
    }
  });

  // SSE endpoint for live dashboard updates
  const sseClients: Set<any> = new Set();
  
  app.get("/api/admin/stream", (req, res) => {
    if (!isAdminAccessAllowed(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Add client to the set
    sseClients.add(res);

    // Send initial data
    const sendUpdate = async () => {
      try {
        const summary = await storage.getAnalyticsSummary();
        const scanCount = await storage.getScanEventCount();
        const analyticsCount = await storage.getAnalyticsEventCount();
        
        const data = {
          type: 'update',
          timestamp: new Date().toISOString(),
          serverStartTime,
          data: {
            totalScans: summary.totalScans,
            cacheHitRate: summary.cacheHitRate,
            scansByCategory: summary.scansByCategory,
            scansByCity: summary.scansByCity,
            tableCounts: {
              trashScanEvents: scanCount,
              analyticsEvents: analyticsCount,
            }
          }
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('SSE update error:', error);
      }
    };

    // Send initial update
    sendUpdate();

    // Send updates every 5 seconds
    const intervalId = setInterval(sendUpdate, 5000);

    // Clean up on connection close
    req.on('close', () => {
      clearInterval(intervalId);
      sseClients.delete(res);
    });
  });

  // Function to broadcast to all SSE clients (for real-time scan notifications)
  const broadcastScanEvent = (scanData: any) => {
    const message = {
      type: 'new_scan',
      timestamp: new Date().toISOString(),
      data: scanData
    };
    const payload = `data: ${JSON.stringify(message)}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(payload);
      } catch (error) {
        sseClients.delete(client);
      }
    });
  };

  // Export broadcast function for use in scan logging
  (app as any).broadcastScanEvent = broadcastScanEvent;

  const httpServer = createServer(app);

  return httpServer;
}
