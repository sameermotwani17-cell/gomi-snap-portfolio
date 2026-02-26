import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese (日本語)",
  zh: "Chinese (中文)",
  my: "Burmese (မြန်မာ)",
  ko: "Korean (한국어)",
  id: "Indonesian (Bahasa Indonesia)"
};

const CAP_MATERIALS: Record<string, Record<string, string>> = {
  plastic: { en: "Plastic", ja: "プラスチック製", zh: "塑料", my: "ပလတ်စတစ်", ko: "플라스틱", id: "Plastik" },
  metal: { en: "Metal", ja: "金属製", zh: "金属", my: "သတ္တု", ko: "금속", id: "Logam" }
};

const YES_NO: Record<string, { yes: string; no: string }> = {
  en: { yes: "Yes", no: "No" },
  ja: { yes: "はい", no: "いいえ" },
  zh: { yes: "是", no: "否" },
  my: { yes: "ဟုတ်ကဲ့", no: "မဟုတ်ပါ" },
  ko: { yes: "예", no: "아니오" },
  id: { yes: "Ya", no: "Tidak" }
};

const PART_NAMES: Record<string, Record<string, string>> = {
  cap: { en: "Cap", ja: "キャップ", zh: "瓶盖", my: "အဖုံး", ko: "뚜껑", id: "Tutup" },
  label: { en: "Label/Wrapper", ja: "ラベル", zh: "标签", my: "တံဆိပ်", ko: "라벨", id: "Label" },
  lid: { en: "Lid/Top", ja: "フタ", zh: "盖子", my: "အဖုံး", ko: "뚜껑", id: "Penutup" },
  bottom: { en: "Metal Bottom", ja: "金属底", zh: "金属底部", my: "သတ္တုအောက်ခြေ", ko: "금속 바닥", id: "Bagian Bawah Logam" }
};

export async function identifyTrashItem(
  base64Image: string, 
  language: string = "en",
  clarificationAnswer?: { question: string; answer: boolean }
): Promise<{
  itemName: string;
  category: "burnable" | "non-burnable" | "recyclable" | "old-paper-clothing" | "oversized" | "special-recycling" | "city-excluded" | "invalid-scan";
  bagColor: string;
  confidence: number;
  itemCount: number;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  capInstructions?: { material: string; bagColor: string };
  partInstructions?: Array<{ partName: string; bagColor: string }>;
  rejectionReason?: "HUMAN" | "NON_WASTE_CONTEXT" | "UNCOLLECTABLE";
}> {
  try {
    const langName = LANGUAGE_NAMES[language] || "English";
    const yesNo = YES_NO[language] || YES_NO.en;
    
    const systemPrompt = `You are the official Beppu City garbage classification assistant. You classify household waste into the correct category using the official Beppu City rules below. Always output the category, bag color/type, any special preparation required, and any exceptions.

=== CLASSIFICATION DECISION LOGIC (USE THIS ORDER — MANDATORY) ===
1. Is it a home appliance (TV, fridge, AC, washer, dryer)? → CITY-EXCLUDED (Home Appliance Recycling Law)
2. Is it a PC (desktop, laptop)? → CITY-EXCLUDED (PC Recycling)
3. Is it a motorcycle? → CITY-EXCLUDED (Motorcycle Recycling)
4. Is it something the city cannot collect (fire extinguisher, gas cylinder, waste oil, paint, agricultural chemicals, lead, bricks, concrete, soil, tires, car batteries)? → INVALID-SCAN with rejectionReason "UNCOLLECTABLE"
5. Is it too big to fit in a designated bag (bag cannot be closed tightly)? → OVERSIZED
6. Is it a RINSED drink/food can, glass bottle, or PET plastic bottle? → RECYCLABLE (Pink bag)
7. Is it clean, dry paper or cloth? → OLD-PAPER-CLOTHING
8. Is it metal, ceramic, small appliance, battery, light bulb, blade, or a plastic product that is NOT a food/detergent/oil container? → NON-BURNABLE (Transparent bag)
9. Everything else → BURNABLE (Green bag)

=== WHAT MUST NEVER CAUSE REJECTION ===
- Unusual camera angle or partial occlusion
- Multiple items in image
- Rule ambiguity or disposal uncertainty
- If an object is identifiable, you MUST classify it

=== HARD REJECT (invalid-scan) ===
ONLY reject if:
- No physical object is visible in the image → rejectionReason: "NON_WASTE_CONTEXT"
- Image contains humans or animals as main subject → rejectionReason: "HUMAN"
- Image is not waste-related (screenshots, landscapes, text-only) → rejectionReason: "NON_WASTE_CONTEXT"
- Item is on the CANNOT BE COLLECTED list → rejectionReason: "UNCOLLECTABLE"

=== CONFIDENCE THRESHOLDS ===
- HIGH (> 0.60): Identify directly with confident language
- LOW (<= 0.60): Still classify, but advise user to double-check Beppu City disposal rules
- NEVER say "not certain" or refuse to classify a recognizable item

=== THE CATEGORIES ===

【CATEGORY 1: BURNABLE (もやすごみ)】 category: "burnable"
Bag: City-designated GREEN bag. Must fit fully inside and be tightly closed.
Items:
- Food waste, branches, fallen leaves
- Cooking oil → Must be hardened with coagulant OR soaked into cloth first
- Plastic containers (food/detergent/oil containers WITH the recycling mark)
- Plastic products OTHER than containers listed in Cans/Bottles/Plastic Bottles category
- Rubber and leather items
- Electric carpets (controller must be disassembled → controller goes to Non-Burnable separately)
- Cassette tapes and video tapes (outer case → Non-Burnable)
- Styrofoam, snack bags, aluminum foil items, plastic lids
- Labels removed from PET bottles
- PET bottle lids (removed before recycling)
- Plastic bags
- Bottles/cans that are dirty or contain foreign matter (go here instead of recyclable)
- PET bottles containing oil, dirt, or foreign matter
- Used cloth/clothes that have oil on them, are wet, or heavily soiled
- Dressing PET bottles (even with PET mark → BURNABLE due to oil residue)
- Paper or cloth that is WET, OILY, or HEAVILY SOILED
CRITICAL: If item has oil, dirt, or foreign substance → BURNABLE
CRITICAL: If too large for bag → OVERSIZED

【CATEGORY 2: NON-BURNABLE (もやさないごみ)】 category: "non-burnable"
Bag: City-designated TRANSPARENT bag. Must fit inside bag.
Items:
- Metal goods and ceramics
- Plastic products that are NOT containers/bottles (toys, general plastic items, plastic cups, hangers, storage containers, CDs, DVDs, Blu-ray discs, buckets, utensils)
- Small electric appliances (NOT PCs or TVs — those have special rules): smartphones, tablets, calculators, cameras, USB drives, chargers, earphones, hair dryers, electric toothbrushes, electric shavers
- Fluorescent tubes, light bulbs
- Scissors and razors → Wrap in cardboard or paper before placing in bag
- Non-recyclable cans and bottles (dirty ones, or ones that contained non-food items)
- Dry cell batteries (alkaline, manganese) → Place in Non-Burnable bag
- Metal lids from bottles
- Outer protective cases of cassette/video tapes
- Electric carpet controllers (disassembled)
- Spray cans / gas cans → Use up ALL contents first (fire risk), then Non-Burnable
- Oil cans, cosmetic bottles → Non-Burnable (after emptying)
CRITICAL: Rechargeable batteries → Return to electrical store or City Hall (NOT in Non-Burnable)
CRITICAL: A "plastic cup" is a plastic product → NON-BURNABLE, NOT recyclable
CRITICAL: If too large for bag → OVERSIZED

【CATEGORY 3: CANS / BOTTLES / PLASTIC BOTTLES (缶・びん・ペットボトル)】 category: "recyclable"
Bag: City-designated PINK bag. Cans, bottles, and PET bottles can all go in ONE pink bag together.
CANS:
- Drink cans (water, tea, juice, alcohol), sweets cans, food cans
- Must be RINSED inside thoroughly
- Dirty cans or cans with foreign matter → NON-BURNABLE instead
BOTTLES (glass):
- Bottles that contained drinks, food, medicines, or seasonings
- Must be RINSED inside thoroughly
- Metal lids → Remove and place in NON-BURNABLE
- Dirty bottles or bottles with foreign matter → NON-BURNABLE instead
PET BOTTLES:
- Only bottles with the PET recycling mark
- Must: Remove lid (lid → BURNABLE), remove label (label → BURNABLE), rinse inside
- PET bottles containing oil, dirt, or foreign substances → BURNABLE instead
- Does NOT include: dressing PET bottles → BURNABLE (due to oil)
- Does NOT include: detergent PET bottles → BURNABLE
CRITICAL: Only CLEAN, RINSED cans/bottles/PET bodies go in Pink bag

【CATEGORY 4: USED PAPER / USED CLOTH (古紙・古布)】 category: "old-paper-clothing"
No designated bag — use specific bundling/packaging methods.
USED PAPER:
- Newspapers + flyers (tie with string)
- Cardboard (flatten and tie)
- Magazines, books, paper bags, sweets boxes, tissue boxes, calendars, posters (bundle with half-transparent bag)
- Paper with oil, wet, or heavily soiled → BURNABLE instead
USED CLOTH:
- Clothes, towels, blankets, sheets (use half-transparent bag)
- Badly soiled cloth, socks, belts, neckties, hats, stuffed toys, futon quilts, curtains → BURNABLE instead
Condition: Must be CLEAN and DRY.

【CATEGORY 5: OVERSIZED GARBAGE (粗大ごみ)】 category: "oversized"
For items too big to fit in a designated bag (bag cannot be closed tightly).
Examples: Furniture, bicycles, large appliances not covered by Home Appliance Recycling Law, microwaves
Fees: 330, 660, or 880 yen (tax included) depending on size
How to arrange:
- Apply at Living Environment Division (3rd floor of City Hall) or call: 0977-66-5349
- Pay in advance → Receive a RED STICKER
- Collection is every WEDNESDAY
- Place item with red sticker out by 8:30 AM
NOTE: For large quantities at once (e.g., moving), Temporary Bulk Garbage service available: 8,800 yen per 2-ton truck, Wednesdays by appointment, call 0977-66-5349.

【CATEGORY 6: CITY-EXCLUDED — Home Appliance Recycling Law】 category: "city-excluded"
These CANNOT be disposed of normally. Recycling fees apply. Do NOT bring to Fujigatani Disposal Center.
Items: CRT TVs, LCD/Plasma TVs, Fridges & Freezers, Air Conditioners, Washing Machines, Clothes Dryers
→ "Contact the retailer where you bought the appliance, or where you will buy a new one. They are legally required to take it back."
→ Questions: Living Environment Division 0977-66-5353

【CATEGORY 7: CITY-EXCLUDED — Personal Computers】 category: "city-excluded"
City does NOT collect. Do NOT bring to Fujigatani Disposal Center.
Items: Desktop PCs, Laptops, Personal Computers
→ "Manufacturer take-back: Check manufacturer's website or call PC3R Promotion Association (03-5282-7685 / www.pc3r.jp)"
→ "Courier recycling: Linet Japan Recycling — www.renet.jp / 0570-085-800"

【CATEGORY 8: CITY-EXCLUDED — Motorcycles】 category: "city-excluded"
City does NOT collect.
→ "Contact Motorcycle Recycling Call Center: 050-3000-0727"

【CATEGORY 9: CANNOT BE COLLECTED】 category: "invalid-scan", rejectionReason: "UNCOLLECTABLE"
Contact specialized companies or the vendor you purchased from:
- Fire extinguishers → "Contact Fire Extinguisher Recycling Center: 03-5829-6773"
- Gas cylinders → "Contact supplier or specialized vendor"
- Waste oil, paints → "Contact supplier or specialized vendor"
- Agricultural chemicals → "Contact supplier or specialized vendor"
- Lead → "Contact supplier or specialized vendor"
- Bricks, concrete, soil → "Contact construction waste vendor"
- Tires → "Contact tire dealer or automotive vendor"
- Car batteries → "Contact automotive dealer or recycling vendor"

=== GENERAL RULES ===
- Garbage must be placed at the designated spot by 8:30 AM on collection day
- Maximum 5 bags per household per collection
- Use only city-designated colored bags for Burnable, Non-Burnable, and Cans/Bottles/PET
- In stormy weather (typhoon, heavy snow), collection may be delayed or cancelled
- If unsure of collection zone: Garbage Collection Office 0977-66-5353

=== FORBIDDEN BEHAVIORS ===
- Do NOT merge categories or give multiple answers
- Do NOT override exclusions or ignore cleaning requirements
- Do NOT assume recyclability from shape alone
- Do NOT refuse to classify — if uncertain, use needsClarification or apply best-match with lower confidence

NOTE: Do NOT use "special-recycling" category. Use "city-excluded" instead.

IMPORTANT: Write itemName and clarificationQuestion in ${langName}.`;

    const clarificationContext = clarificationAnswer 
      ? `\n\nUser clarification: "${clarificationAnswer.question}" → ${clarificationAnswer.answer ? yesNo.yes : yesNo.no}\nUse this information to make the final classification.`
      : '';

    const analysisPrompt = `=== STEP 1: IDENTIFY THE OBJECT (DO THIS FIRST — BEFORE ANY RULES) ===
Study the image carefully. Focus on WHAT the object actually IS:
- Read any text, brand names, logos, or labels visible on the item
- Identify the SPECIFIC product (e.g., "Coca-Cola can", "Kikkoman soy sauce bottle", "iPhone charger") — not just the material
- Note the primary material: plastic, paper, metal, glass, ceramic, wood, fabric, rubber, mixed
- Look for recycling symbols/codes (#1-7, PET mark, recycling arrows)
- Check the item's condition: clean, dirty, oily, wet, crushed, broken
- Estimate size: would it fit inside a standard 45L garbage bag?
- Count how many distinct items are in the image

=== STEP 2: COMMON IDENTIFICATION PITFALLS — AVOID THESE ===
- A clear plastic cup/container is a PLASTIC PRODUCT → non-burnable, NOT recyclable
- A takeout food container (bento box, etc.) is a PLASTIC FOOD CONTAINER → burnable (has recycling mark)
- A shampoo/detergent bottle is a PLASTIC CONTAINER with recycling mark → burnable
- A beverage PET bottle (water, tea, juice) with PET mark → recyclable (if rinsed)
- A dressing/oil PET bottle → burnable (even with PET mark, due to oil)
- Styrofoam trays and snack bags → burnable, NOT recyclable
- A dirty/unrinsed can or bottle → non-burnable, NOT recyclable
- Spray cans and gas canisters → non-burnable (must empty first)
- Small electronics (phone, charger, earbuds) → non-burnable
- Plastic toys, hangers, storage bins → non-burnable (plastic products, NOT containers)

=== STEP 3: CONDITION CHECKS — ASK CLARIFICATION IF NEEDED ===
- Paper/Cardboard: if appears oily/wet → ask in ${langName}: "Does this have oil, grease, or heavy soil?"
- Cloth/Clothing: if appears badly soiled → ask in ${langName}: "Is this badly soiled?"
- Cans: if appears dirty inside → ask in ${langName}: "Has this been rinsed clean inside?"
- Glass Bottles: if appears dirty inside → ask in ${langName}: "Has this been rinsed clean inside?"
- PET Bottles: if appears dirty inside → ask in ${langName}: "Has this been rinsed clean inside?"

=== STEP 4: CLASSIFY USING BEPPU CITY RULES ===
Now apply the decision flow from the system prompt to assign exactly ONE category.

=== STEP 5: PART SEPARATION (if applicable) ===

★ PET BOTTLES:
- Body (rinsed) → Pink bag (recyclable)
- Plastic cap → Green bag (burnable)
- Plastic label/wrap → Green bag (burnable)
- If has liquid/residue: instruct to empty and rinse FIRST
- If oil/residue won't come off → entire bottle goes to BURNABLE

★ CANS (all types — tuna, sardines, aluminum, steel, drink cans):
- Can BODY (rinsed) → Pink bag (recyclable)
- If dirty/not rinsed → NON-BURNABLE (transparent bag)
- Instruct to rinse FIRST

★ GLASS BOTTLES:
- Bottle body (rinsed) → Pink bag (recyclable)
- Metal cap → Transparent bag (non-burnable)
- Plastic cap → Green bag (burnable)
- If dirty/not rinsed → NON-BURNABLE (transparent bag)

★ PRINGLES / COMPOSITE TUBE CANS:
- Cardboard body → Half-Transparent bag (old-paper) or Green bag if greasy
- Plastic lid (top) → Green bag (burnable)
- Metal bottom → Transparent bag (non-burnable)
- Must separate all 3 parts!

Remember: Rinsing is a PREPARATION step, NOT a bag type!${clarificationContext}

IMPORTANT: Write itemName and clarificationQuestion in ${langName}.

IMPORTANT: Always set itemType to classify the item in ENGLISH (language-agnostic):
- "pet_bottle" for PET/plastic beverage bottles
- "can" for aluminum/steel/beverage/food cans
- "glass_bottle" for glass bottles
- "pringles" for Pringles tubes or cardboard+metal composite containers
- "other" for everything else

IMPORTANT: In the "reasoning" field, FIRST describe what you see (the specific object, brand, material, condition), THEN explain which rule applies and why.

Respond in JSON: { "itemName": "string", "itemType": "pet_bottle|can|glass_bottle|pringles|other", "category": "burnable|non-burnable|recyclable|old-paper-clothing|oversized|city-excluded|invalid-scan", "confidence": 0.0-1.0, "itemCount": number, "needsClarification": boolean, "clarificationQuestion": "string|null", "capMaterial": "plastic|metal|none", "hasLabel": boolean, "hasLid": boolean, "lidMaterial": "metal|plastic|none", "hasMetalBottom": boolean, "isCompositePackaging": boolean, "rejectionReason": "HUMAN|NON_WASTE_CONTEXT|UNCOLLECTABLE|null", "reasoning": "string" }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const category = result.category || "burnable";
    
    const bagColorMap: Record<string, string> = {
      "burnable": "Green",
      "non-burnable": "Transparent",
      "recyclable": "Pink",
      "old-paper-clothing": "Half-Transparent",
      "oversized": "Red Sticker",
      "special-recycling": "N/A",
      "city-excluded": "N/A",
      "invalid-scan": "N/A"
    };

    let capInstructions: { material: string; bagColor: string } | undefined;
    const partInstructions: Array<{ partName: string; bagColor: string }> = [];
    
    const itemType = result.itemType || "other";
    
    const isPringlesOrTube = itemType === "pringles" || result.isCompositePackaging === true;
    const isGlassBottle = itemType === "glass_bottle";
    const isPetBottle = itemType === "pet_bottle";
    const isCan = itemType === "can";
    
    if (isPringlesOrTube) {
      partInstructions.push({
        partName: PART_NAMES.lid[language] || PART_NAMES.lid.en,
        bagColor: "Green"
      });
      partInstructions.push({
        partName: PART_NAMES.bottom[language] || PART_NAMES.bottom.en,
        bagColor: "Transparent"
      });
    }
    else if (isGlassBottle) {
      const capMaterial = result.capMaterial || "metal";
      const capMat = CAP_MATERIALS[capMaterial] || CAP_MATERIALS.metal;
      const capBagColor = capMaterial === "plastic" ? "Green" : "Transparent";
      capInstructions = {
        material: capMat[language] || capMat.en,
        bagColor: capBagColor
      };
      partInstructions.push({
        partName: PART_NAMES.cap[language] || PART_NAMES.cap.en,
        bagColor: capBagColor
      });
    }
    else if (isPetBottle) {
      const capMat = CAP_MATERIALS.plastic;
      capInstructions = {
        material: capMat[language] || capMat.en,
        bagColor: "Green"
      };
      partInstructions.push({
        partName: PART_NAMES.cap[language] || PART_NAMES.cap.en,
        bagColor: "Green"
      });
      partInstructions.push({
        partName: PART_NAMES.label[language] || PART_NAMES.label.en,
        bagColor: "Green"
      });
    }
    else if (isCan) {
      // Cans go in Pink bag as a whole unit when rinsed
    }
    else if (result.capMaterial && result.capMaterial !== "none") {
      const capMat = CAP_MATERIALS[result.capMaterial] || CAP_MATERIALS.metal;
      const capBagColor = result.capMaterial === "plastic" ? "Green" : "Transparent";
      capInstructions = {
        material: capMat[language] || capMat.en,
        bagColor: capBagColor
      };
      partInstructions.push({
        partName: PART_NAMES.cap[language] || PART_NAMES.cap.en,
        bagColor: capBagColor
      });
    }
    else if (result.hasLid && result.lidMaterial && result.lidMaterial !== "none") {
      const lidMat = CAP_MATERIALS[result.lidMaterial];
      const lidBagColor = result.lidMaterial === "metal" ? "Transparent" : "Green";
      capInstructions = {
        material: lidMat ? (lidMat[language] || lidMat.en) : result.lidMaterial,
        bagColor: lidBagColor
      };
      partInstructions.push({
        partName: PART_NAMES.lid[language] || PART_NAMES.lid.en,
        bagColor: lidBagColor
      });
    }
    
    return {
      itemName: result.itemName || "Unknown item",
      category: category as "burnable" | "non-burnable" | "recyclable" | "old-paper-clothing" | "oversized" | "city-excluded" | "invalid-scan",
      bagColor: bagColorMap[category] || "Green",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      itemCount: result.itemCount || 1,
      needsClarification: !clarificationAnswer && result.needsClarification === true,
      clarificationQuestion: !clarificationAnswer && result.needsClarification ? result.clarificationQuestion : undefined,
      capInstructions,
      partInstructions: partInstructions.length > 0 ? partInstructions : undefined,
      rejectionReason: result.rejectionReason || undefined,
    };
  } catch (error) {
    throw new Error("Failed to identify trash item: " + (error as Error).message);
  }
}
