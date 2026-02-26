import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  issueType: text("issue_type").notNull(),
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
  pinned: boolean("pinned").notNull().default(false),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  timestamp: true,
  pinned: true,
}).extend({
  issueType: z.string().min(1, "Issue type is required"),
  description: z.string().min(1, "Description is required").min(10, "Description must be at least 10 characters"),
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export const imageCache = pgTable("image_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  perceptualHash: text("perceptual_hash").notNull().unique(),
  thumbnailData: text("thumbnail_data").notNull(),
  category: text("category").notNull(),
  itemNameEn: text("item_name_en"),
  itemNameJa: text("item_name_ja"),
  confidence: real("confidence").notNull(),
  instructionsEn: text("instructions_en").notNull(),
  instructionsJa: text("instructions_ja").notNull(),
  timesUsed: integer("times_used").notNull().default(1),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertImageCacheSchema = createInsertSchema(imageCache).omit({
  id: true,
  timestamp: true,
  timesUsed: true,
});

export type InsertImageCache = z.infer<typeof insertImageCacheSchema>;
export type ImageCache = typeof imageCache.$inferSelect;

export const trashScanEvents = pgTable("trash_scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: text("scan_id").unique(), // Client-generated idempotency key to prevent duplicate scans
  capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  language: text("language").notNull(),
  detectedCategory: text("detected_category").notNull(),
  detectedItemName: text("detected_item_name").notNull(),
  confidence: real("confidence").notNull(),
  bagColor: text("bag_color").notNull(),
  resultSource: text("result_source").notNull(), // 'cache' | 'openai'
  userAgent: text("user_agent"),
  sessionId: text("session_id").notNull(),
  city: text("city"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationSource: text("location_source"), // 'browser' | 'manual' | 'unknown'
  thumbnailRef: text("thumbnail_ref"), // Reference to imageCache.id if applicable
  pilotLocationId: text("pilot_location_id"), // e.g., "aphouse3f" for AP House 3F Kitchen
}, (table) => ({
  scanIdIdx: index("trash_scan_events_scan_id_idx").on(table.scanId),
  capturedAtIdx: index("trash_scan_events_captured_at_idx").on(table.capturedAt),
  categoryIdx: index("trash_scan_events_category_idx").on(table.detectedCategory),
  cityIdx: index("trash_scan_events_city_idx").on(table.city),
  resultSourceIdx: index("trash_scan_events_result_source_idx").on(table.resultSource),
  pilotLocationIdx: index("trash_scan_events_pilot_location_idx").on(table.pilotLocationId),
}));

// Analytics namespace: 'app' for scanning app, 'website' for marketing site
export type AnalyticsNamespace = 'app' | 'website';

// Granular event tracking for investor analytics
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  namespace: text("namespace").notNull().default('app'), // 'app' | 'website' - strict separation
  eventName: text("event_name").notNull(), // 'app_opened', 'scan_started', 'scan_completed', etc.
  anonymousUserId: text("anonymous_user_id").notNull(), // Persistent user identifier
  sessionId: text("session_id").notNull(),
  pilotLocationId: text("pilot_location_id"),
  payload: text("payload"), // JSON stringified metadata
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  namespaceIdx: index("analytics_events_namespace_idx").on(table.namespace),
  eventNameIdx: index("analytics_events_event_name_idx").on(table.eventName),
  userIdIdx: index("analytics_events_user_id_idx").on(table.anonymousUserId),
  createdAtIdx: index("analytics_events_created_at_idx").on(table.createdAt),
  pilotLocationIdx: index("analytics_events_pilot_location_idx").on(table.pilotLocationId),
}));

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// Event types for analytics (extended for institutional impact reporting)
export type AnalyticsEventType = 
  | 'app_opened'
  | 'page_viewed'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'clarification_shown'
  | 'clarification_answered'
  | 'classification_finalized'
  | 'why_opened'
  | 'quick_item_selected'
  | 'feedback_submitted'
  // Impact report events (invisible to users)
  | 'guidance_shown'
  | 'guidance_confirmed'
  | 'guidance_rejected'
  | 'disposal_completed'
  | 'rules_viewed'
  | 'location_selected'
  | 'language_selected'
  | 'returning_user'
  | 'qr_scan';

export const insertTrashScanEventSchema = createInsertSchema(trashScanEvents).omit({
  id: true,
  capturedAt: true,
});

export type InsertTrashScanEvent = z.infer<typeof insertTrashScanEventSchema>;
export type TrashScanEvent = typeof trashScanEvents.$inferSelect;

export type TrashCategory = "burnable" | "non-burnable" | "recyclable" | "old-paper-clothing" | "oversized" | "special-recycling" | "city-excluded" | "invalid-scan";

export interface TrashItem {
  id: string;
  nameEn: string;
  nameJa: string;
  aliases: string[];
  category: TrashCategory;
  bagColor: string;
  instructionsEn: string;
  instructionsJa: string;
}

export const trashCategoryInfo = {
  burnable: {
    nameEn: "Burnable",
    nameJa: "燃えるゴミ",
    bagColor: "Green",
    bagColorJa: "緑",
    colorClass: "bg-green-600",
    description: "Use city-designated GREEN bag",
    instructionsEn: "Place in designated GREEN bag. If item is too large for bag, it becomes oversized garbage.",
    instructionsJa: "指定の緑色の袋に入れてください。袋に入らない場合は粗大ゴミになります。"
  },
  "non-burnable": {
    nameEn: "Non-Burnable",
    nameJa: "燃えないゴミ",
    bagColor: "Transparent",
    bagColorJa: "透明",
    colorClass: "bg-gray-400",
    description: "Use city-designated TRANSPARENT bag",
    instructionsEn: "Place in designated TRANSPARENT bag. Wrap sharp items in paper. If item is too large for bag, it becomes oversized garbage.",
    instructionsJa: "指定の透明な袋に入れてください。鋭利なものは紙で包んでください。袋に入らない場合は粗大ゴミになります。"
  },
  recyclable: {
    nameEn: "Cans/Glass/PET",
    nameJa: "缶・瓶・ペット",
    bagColor: "Pink",
    bagColorJa: "ピンク",
    colorClass: "bg-pink-500",
    description: "Use city-designated PINK bag",
    instructionsEn: "Rinse thoroughly and place in designated PINK bag. Remove caps and labels from PET bottles.",
    instructionsJa: "よく洗って指定のピンク色の袋に入れてください。PETボトルはキャップとラベルを外してください。"
  },
  "old-paper-clothing": {
    nameEn: "Old Papers/Clothing",
    nameJa: "古紙・衣類",
    bagColor: "Half-Transparent",
    bagColorJa: "半透明",
    colorClass: "bg-blue-300",
    description: "Use half-transparent bag, tie papers in bundles",
    instructionsEn: "Tie papers in bundles. Place clean clothing in half-transparent bag. Exclude badly stained items.",
    instructionsJa: "紙は束ねてください。きれいな衣類は半透明の袋に入れてください。ひどく汚れたものは除外してください。"
  },
  oversized: {
    nameEn: "Oversized",
    nameJa: "粗大ゴミ",
    bagColor: "Red Sticker",
    bagColorJa: "赤シール",
    colorClass: "bg-red-600",
    description: "Paid service - Reservation required",
    instructionsEn: "Reservation required. Fee: 330/660/880 yen (tax included). Collected Wednesdays only. Place outside by 8:30 AM.",
    instructionsJa: "予約が必要です。料金：330/660/880円（税込）。水曜日のみ収集。午前8時30分までに外に出してください。",
    contactPhone: "0977-66-5349",
    contactNameEn: "Beppu City Environment Division (Cleaning Office)",
    contactNameJa: "別府市生活環境課清掃事務所"
  },
  "special-recycling": {
    nameEn: "Special Recycling",
    nameJa: "特別リサイクル",
    bagColor: "N/A",
    bagColorJa: "該当なし",
    colorClass: "bg-purple-600",
    description: "Contact retailer or manufacturer",
    instructionsEn: "Contact retailer where purchased or manufacturer. Home Appliance Recycling Law applies. NOT allowed at Fujigatani Disposal Center.",
    instructionsJa: "購入した小売店またはメーカーに連絡してください。家電リサイクル法が適用されます。藤ケ谷清掃センターへの持ち込みは不可。",
    contactPhone: "0977-66-5353",
    contactNameEn: "Beppu City Environment Division (Cleaning Office)",
    contactNameJa: "別府市生活環境課清掃事務所"
  },
  "city-excluded": {
    nameEn: "Manufacturer Recycling",
    nameJa: "メーカーリサイクル",
    bagColor: "N/A",
    bagColorJa: "該当なし",
    colorClass: "bg-orange-500",
    description: "Not collected by city - requires manufacturer/retailer recycling",
    instructionsEn: "This item is NOT collected by Beppu City. Contact the manufacturer, retailer where purchased, or an authorized recycling service for proper disposal.",
    instructionsJa: "この品目は別府市では収集していません。メーカー、購入した販売店、または認可されたリサイクルサービスに連絡してください。",
    contactPhone: "0977-66-5353",
    contactNameEn: "Beppu City Environment Division (Cleaning Office)",
    contactNameJa: "別府市生活環境課清掃事務所",
    subCategories: {
      homeAppliance: {
        items: ["TV", "television", "refrigerator", "fridge", "freezer", "air conditioner", "washing machine", "dryer", "clothes dryer"],
        contactPhone: "0977-66-5353",
        contactNameEn: "Beppu City Environment Division",
        contactNameJa: "別府市生活環境課清掃事務所"
      },
      pc: {
        items: ["computer", "PC", "laptop", "desktop", "personal computer"],
        contactPhone: "0570-085-800",
        contactUrl: "https://www.renet.jp",
        contactNameEn: "Linet Japan Recycling (or your PC manufacturer)",
        contactNameJa: "リネットジャパンリサイクル（またはPCメーカー）",
        altContactPhone: "03-5282-7685",
        altContactUrl: "https://www.pc3r.jp",
        altContactNameEn: "PC3R Promotion Association",
        altContactNameJa: "パソコン3R推進協会"
      },
      motorcycle: {
        items: ["motorcycle", "motorbike", "scooter", "bike"],
        contactPhone: "050-3000-0727",
        contactNameEn: "Motorcycle Recycling Call Center",
        contactNameJa: "二輪車リサイクルコールセンター"
      },
      fireExtinguisher: {
        items: ["fire extinguisher"],
        contactPhone: "03-5829-6773",
        contactNameEn: "Fire Extinguisher Recycling Promotion Center",
        contactNameJa: "消火器リサイクル推進センター"
      }
    }
  },
  "invalid-scan": {
    nameEn: "Invalid Scan",
    nameJa: "無効なスキャン",
    bagColor: "N/A",
    bagColorJa: "該当なし",
    colorClass: "bg-gray-500",
    description: "Cannot be scanned - not a waste item or uncollectable material",
    instructionsEn: "This image cannot be classified. Either no physical waste item is visible, or the item is an uncollectable material.",
    instructionsJa: "この画像は分類できません。ゴミが写っていないか、収集不可の品目です。",
    contactPhone: "0977-66-5353",
    contactNameEn: "Beppu City Environment Division (Cleaning Office)",
    contactNameJa: "別府市生活環境課清掃事務所"
  }
} as const;

// Challenge scans table for binfluencer competition anti-abuse tracking
export const challengeScans = pgTable("challenge_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  anonymousUserId: text("anonymous_user_id").notNull(),
  sessionId: text("session_id").notNull(),
  perceptualHash: text("perceptual_hash").notNull(),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  confidence: real("confidence").notNull(),
  isValid: boolean("is_valid").notNull().default(true),
  invalidReason: text("invalid_reason"), // 'duplicate_cooldown', 'daily_cap', 'low_confidence', 'flagged'
  scannedAt: text("scanned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  challengeMonth: text("challenge_month").notNull(), // Format: "2025-01" for January 2025
}, (table) => ({
  userIdIdx: index("challenge_scans_user_id_idx").on(table.anonymousUserId),
  hashIdx: index("challenge_scans_hash_idx").on(table.perceptualHash),
  monthIdx: index("challenge_scans_month_idx").on(table.challengeMonth),
  scannedAtIdx: index("challenge_scans_scanned_at_idx").on(table.scannedAt),
}));

export const insertChallengeScanSchema = createInsertSchema(challengeScans).omit({
  id: true,
  scannedAt: true,
});

export type InsertChallengeScan = z.infer<typeof insertChallengeScanSchema>;
export type ChallengeScan = typeof challengeScans.$inferSelect;

// Challenge configuration constants
export const CHALLENGE_CONFIG = {
  DUPLICATE_COOLDOWN_MINUTES: 15, // Same image can only count once per 15 minutes
  DAILY_SCAN_CAP: 100, // Max scans per user per day
  MIN_CONFIDENCE_THRESHOLD: 0.70, // 70% minimum confidence
  SIMILARITY_THRESHOLD: 0.85, // 85% image similarity to count as duplicate
} as const;

// Official Beppu City categorization rules (April 2024 edition)
export const beppuRules = {
  burnable: {
    items: [
      "Food waste, food scraps",
      "Branches, fallen leaves, green waste (max 50cm length, 5cm thick)",
      "Cooking oil (hardened with coagulant OR absorbed into cloth/paper; 10L+ → Recycling Info Center)",
      "Plastic containers for food, detergent, oil WITH recycling mark",
      "Dressing PET bottles (even with PET mark → burnable due to oil)",
      "Rubber items, leather items (removable metal fittings → non-burnable)",
      "Cassette tapes, video tapes (outer plastic cases → non-burnable)",
      "Styrofoam, styrofoam trays, snack bags, plastic bags",
      "Plastic lids and caps (all plastic lids)",
      "Aluminum foil, hand warmers, preservatives, ice packs",
      "Labels from PET bottles",
      "Paper or cloth that is wet, oily, or heavily soiled",
      "Pet toilet litter, disposable diapers (remove waste first)",
      "Umbrella cloth/vinyl parts (metal frame → non-burnable)"
    ],
    notes: "If item has oil, dirt, or foreign substance → BURNABLE. If too large for bag → OVERSIZED."
  },
  "non-burnable": {
    items: [
      "Metal goods, metal items, metal lids/caps",
      "Ceramics, pottery",
      "Glass items (NOT recyclable bottles)",
      "Small electric appliances (smartphones, tablets, calculators, cameras, chargers, earphones, shavers, hair dryers, etc.)",
      "Fluorescent tubes, light bulbs (wrap in original case or thick paper)",
      "Scissors, razors, knives (wrap safely in thick paper or cardboard)",
      "Plastic products NOT food/detergent/oil containers (cups, utensils, buckets, toys, hangers, CDs, DVDs, etc.)",
      "Umbrella metal frames (cloth/vinyl → burnable)",
      "Dirty/unrinsed cans or bottles with residue",
      "Cosmetic bottles, oil bottles",
      "Spray cans, gas canisters (empty contents first; no need to puncture)",
      "Lighters (empty fuel first)",
      "Dry cell batteries — alkaline, manganese only (tape terminals). Rechargeable NOT allowed.",
      "Kerosene heaters/fan heaters (empty kerosene, remove batteries)",
      "Electric carpet controllers",
      "Cassette/video tape outer plastic cases",
      "Polyethylene tanks (empty kerosene first)"
    ],
    notes: "If item does not fit bag → OVERSIZED. Rechargeable batteries NOT allowed. Freon-gas dehumidifiers NOT allowed."
  },
  recyclable: {
    items: [
      "Cans (food/drink) — MUST be rinsed inside. If dirty → NON-BURNABLE.",
      "Glass bottles (drinks, food, medicines, seasonings) — MUST be rinsed. If dirty → NON-BURNABLE.",
      "PET bottles with PET mark — cap removed (→burnable), label removed (→burnable), body rinsed. If oil/residue remains → BURNABLE."
    ],
    notes: "STRICT: Only CLEAN, RINSED items go in Pink bag. Dirty = NON-BURNABLE."
  },
  "old-paper-clothing": {
    papers: [
      "Newspapers, flyers",
      "Cardboard",
      "Magazines, books",
      "Paper bags, boxes",
      "Calendars, posters",
      "Tissue paper boxes (remove plastic film)"
    ],
    fabrics: [
      "Clothes, towels, blankets, sheets",
      "Curtains, futons",
      "Stuffed toys",
      "Socks, belts, hats, neckties"
    ],
    conditions: [
      "Paper: must be clean and dry, tie with string",
      "Cloth: use half-transparent bag",
      "If wet, oily, or heavily soiled → BURNABLE"
    ],
    notes: "Paper tied with string. Cloth in half-transparent bag. Soiled items → BURNABLE."
  },
  oversized: {
    items: [
      "Any item that cannot fit fully inside a designated bag",
      "Furniture (chairs, tables, desks)",
      "Bicycles",
      "Microwaves",
      "Large household items"
    ],
    process: "①Reservation required ②Paid service with official red sticker ③Collected on Wednesdays only",
    cost: "330 / 660 / 880 yen (tax included)"
  },
  "special-recycling": {
    items: [
      "Televisions (CRT, LCD, plasma)",
      "Refrigerators, freezers",
      "Air conditioners",
      "Washing machines, clothes dryers",
      "Personal computers (desktops, laptops)",
      "Motorcycles"
    ],
    process: "Contact retailer where purchased or manufacturer. Home Appliance Recycling Law applies.",
    notes: "Maps to city-excluded category."
  },
  "city-excluded": {
    items: [
      "Personal computers (desktops, laptops)",
      "Televisions (CRT, LCD, plasma)",
      "Refrigerators, freezers",
      "Air conditioners",
      "Washing machines, clothes dryers",
      "Motorcycles"
    ],
    process: "Contact manufacturer, retailer, or authorized recycling service. Home Appliance Recycling Law applies.",
    notes: "Identifiable but NOT collected by Beppu City. No bag color assigned."
  },
  "invalid-scan": {
    items: [
      "Fire extinguishers",
      "Gas cylinders",
      "Waste oil, paints",
      "Agricultural chemicals",
      "Lead",
      "Bricks, concrete, soil",
      "Tires",
      "Car batteries"
    ],
    notes: "Cannot be collected by the city under any condition. Contact manufacturer or specialized vendor."
  }
};

// ============================================
// INSTITUTIONAL IMPACT REPORT ENTITIES
// ============================================

// Pilot locations for impact tracking (dorms, buildings, campuses, cities)
export const impactLocations = pgTable("impact_locations", {
  id: varchar("id").primaryKey(), // e.g., "aphouse3f", "beppu-city"
  name: text("name").notNull(),
  type: text("type").notNull(), // 'dorm', 'building', 'campus', 'city'
  country: text("country").notNull().default("Japan"),
  city: text("city").notNull().default("Beppu"),
  rulesetVersion: text("ruleset_version").notNull().default("1.0"),
  baselineStartDate: text("baseline_start_date"), // ISO date string
  baselineEndDate: text("baseline_end_date"), // ISO date string
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  typeIdx: index("impact_locations_type_idx").on(table.type),
  cityIdx: index("impact_locations_city_idx").on(table.city),
}));

export const insertImpactLocationSchema = createInsertSchema(impactLocations).omit({
  createdAt: true,
});

export type InsertImpactLocation = z.infer<typeof insertImpactLocationSchema>;
export type ImpactLocation = typeof impactLocations.$inferSelect;

// Ruleset versions for tracking rule changes over time
export const rulesets = pgTable("rulesets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: text("location_id").notNull(),
  version: text("version").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"), // null = current
  changedFields: text("changed_fields"), // JSON summary of what changed
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  locationIdx: index("rulesets_location_idx").on(table.locationId),
  effectiveIdx: index("rulesets_effective_idx").on(table.effectiveFrom),
}));

export const insertRulesetSchema = createInsertSchema(rulesets).omit({
  id: true,
  createdAt: true,
});

export type InsertRuleset = z.infer<typeof insertRulesetSchema>;
export type Ruleset = typeof rulesets.$inferSelect;

// User sessions for impact analysis (privacy-preserving)
export const impactSessions = pgTable("impact_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userIdHash: text("user_id_hash").notNull(), // Hashed anonymous user ID
  locationId: text("location_id"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: text("ended_at"),
  language: text("language").notNull().default("en"),
  platform: text("platform"), // 'mobile', 'desktop', 'tablet'
  isBaseline: boolean("is_baseline").notNull().default(false), // True if during baseline period
}, (table) => ({
  userHashIdx: index("impact_sessions_user_hash_idx").on(table.userIdHash),
  locationIdx: index("impact_sessions_location_idx").on(table.locationId),
  startedAtIdx: index("impact_sessions_started_at_idx").on(table.startedAt),
}));

export const insertImpactSessionSchema = createInsertSchema(impactSessions).omit({
  id: true,
  startedAt: true,
});

export type InsertImpactSession = z.infer<typeof insertImpactSessionSchema>;
export type ImpactSession = typeof impactSessions.$inferSelect;

// Outcomes tracking: did user follow guidance or not?
export const outcomes = pgTable("outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(), // Reference to analytics_events.id
  sessionId: text("session_id").notNull(),
  locationId: text("location_id"),
  userIdHash: text("user_id_hash").notNull(),
  outcomeType: text("outcome_type").notNull(), // 'followed_guidance', 'ignored', 'unknown'
  selfReported: boolean("self_reported").notNull().default(true),
  category: text("category"), // Trash category for this outcome
  confidenceBucket: text("confidence_bucket"), // 'high', 'medium', 'low'
  resolutionTimeMs: integer("resolution_time_ms"), // Time from guidance shown to decision
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sessionIdx: index("outcomes_session_idx").on(table.sessionId),
  locationIdx: index("outcomes_location_idx").on(table.locationId),
  outcomeTypeIdx: index("outcomes_outcome_type_idx").on(table.outcomeType),
  createdAtIdx: index("outcomes_created_at_idx").on(table.createdAt),
}));

export const insertOutcomeSchema = createInsertSchema(outcomes).omit({
  id: true,
  createdAt: true,
});

export type InsertOutcome = z.infer<typeof insertOutcomeSchema>;
export type Outcome = typeof outcomes.$inferSelect;

// Impact report configuration
export const IMPACT_REPORT_CONFIG = {
  DEFAULT_BASELINE_DAYS: 14, // First 2 weeks as baseline
  TIMEZONE: 'Asia/Tokyo',
  CONFIDENCE_BUCKETS: {
    high: 0.85,
    medium: 0.70,
    low: 0,
  },
} as const;

// ============================================
// IMPACT ANALYTICS ENGINE CONFIGURATION
// ============================================

// Average item weights by category (in kg) - conservative estimates
export const ITEM_WEIGHTS: Record<string, number> = {
  // Recyclables
  "pet bottle": 0.025,
  "aluminum can": 0.015,
  "glass bottle": 0.250,
  "steel can": 0.050,
  // Burnable
  "food waste": 0.150,
  "plastic container": 0.020,
  "paper": 0.010,
  "styrofoam": 0.005,
  "plastic bag": 0.005,
  // Non-burnable
  "battery": 0.025,
  "metal": 0.100,
  "ceramics": 0.200,
  "small appliance": 0.500,
  // Default fallback
  "default": 0.050,
};

// Get item weight with fuzzy matching
export function getItemWeight(itemName: string): number {
  const lowerName = itemName.toLowerCase();
  for (const [key, weight] of Object.entries(ITEM_WEIGHTS)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return weight;
    }
  }
  return ITEM_WEIGHTS.default;
}

// Impact calculation configuration
export const IMPACT_CONFIG = {
  // Baseline mis-sort rate (%) - Japanese national average for residential waste
  BASELINE_MIS_SORT_RATE: 0.15, // 15% - conservative estimate
  
  // Disposal cost per ton (JPY) - Beppu City average
  DISPOSAL_COST_PER_TON_JPY: 45000, // ¥45,000/ton
  
  // Incineration emission factor (kg CO2e per ton of waste incinerated)
  INCINERATION_EMISSION_FACTOR: 900, // 900 kg CO2e/ton - conservative for mixed waste
  
  // Contamination multiplier - how much one mis-sorted item affects a batch
  CONTAMINATION_MULTIPLIER: 1.2,
  
  // Minimum confidence threshold for counting as mis-sort prevented
  CONFIDENCE_THRESHOLD: 0.70,
  
  // Exchange rates for display (approximate)
  JPY_TO_USD: 0.0067,
} as const;

// Scan impact metrics table - stores calculated impact per scan
export const scanImpacts = pgTable("scan_impacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanEventId: text("scan_event_id").notNull(), // Reference to trash_scan_events.id
  itemType: text("item_type").notNull(),
  category: text("category").notNull(),
  location: text("location"),
  confidenceScore: real("confidence_score").notNull(),
  
  // Impact calculations
  misSortPrevented: boolean("mis_sort_prevented").notNull().default(false),
  avoidedMassKg: real("avoided_mass_kg").notNull().default(0),
  avoidedCostJpy: real("avoided_cost_jpy").notNull().default(0),
  avoidedCo2eKg: real("avoided_co2e_kg").notNull().default(0),
  
  // Configuration snapshot at time of calculation
  baselineMisSortRate: real("baseline_mis_sort_rate").notNull(),
  disposalCostPerTon: real("disposal_cost_per_ton").notNull(),
  emissionFactor: real("emission_factor").notNull(),
  contaminationMultiplier: real("contamination_multiplier").notNull(),
  
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  scanEventIdx: index("scan_impacts_scan_event_idx").on(table.scanEventId),
  locationIdx: index("scan_impacts_location_idx").on(table.location),
  categoryIdx: index("scan_impacts_category_idx").on(table.category),
  createdAtIdx: index("scan_impacts_created_at_idx").on(table.createdAt),
  misSortIdx: index("scan_impacts_mis_sort_idx").on(table.misSortPrevented),
}));

export const insertScanImpactSchema = createInsertSchema(scanImpacts).omit({
  id: true,
  createdAt: true,
});

export type InsertScanImpact = z.infer<typeof insertScanImpactSchema>;
export type ScanImpact = typeof scanImpacts.$inferSelect;

// Calculate impact for a single scan
export function calculateScanImpact(
  itemName: string,
  category: string,
  confidence: number,
  location?: string | null
): {
  misSortPrevented: boolean;
  avoidedMassKg: number;
  avoidedCostJpy: number;
  avoidedCo2eKg: number;
} {
  const config = IMPACT_CONFIG;
  
  // Determine if this scan prevents a mis-sort
  const misSortPrevented = 
    config.BASELINE_MIS_SORT_RATE > 0 && 
    confidence >= config.CONFIDENCE_THRESHOLD;
  
  if (!misSortPrevented) {
    return {
      misSortPrevented: false,
      avoidedMassKg: 0,
      avoidedCostJpy: 0,
      avoidedCo2eKg: 0,
    };
  }
  
  // Calculate avoided waste mass (conservative: only count prevention rate)
  const itemWeight = getItemWeight(itemName);
  const avoidedMassKg = itemWeight * config.CONTAMINATION_MULTIPLIER * config.BASELINE_MIS_SORT_RATE;
  
  // Convert to tons for cost/emission calculations
  const avoidedMassTon = avoidedMassKg / 1000;
  
  // Calculate avoided disposal cost
  const avoidedCostJpy = avoidedMassTon * config.DISPOSAL_COST_PER_TON_JPY;
  
  // Calculate avoided emissions
  const avoidedCo2eKg = avoidedMassTon * config.INCINERATION_EMISSION_FACTOR;
  
  return {
    misSortPrevented,
    avoidedMassKg,
    avoidedCostJpy,
    avoidedCo2eKg,
  };
}

// Aggregated impact summary type
export interface ImpactSummary {
  totalScans: number;
  totalMisSortsPrevented: number;
  totalAvoidedMassKg: number;
  totalAvoidedCostJpy: number;
  totalAvoidedCo2eKg: number;
  preventionRate: number; // Percentage of scans that prevented mis-sorts
  avgCostSavedPerScan: number;
  avgCo2eSavedPerScan: number;
  impactByCategory: Record<string, {
    scans: number;
    misSortsPrevented: number;
    avoidedMassKg: number;
    avoidedCostJpy: number;
    avoidedCo2eKg: number;
  }>;
  impactByLocation: Record<string, {
    scans: number;
    misSortsPrevented: number;
    avoidedCostJpy: number;
    avoidedCo2eKg: number;
  }>;
  trend30Days: {
    period: string;
    scans: number;
    misSortsPrevented: number;
    avoidedCo2eKg: number;
  }[];
}
