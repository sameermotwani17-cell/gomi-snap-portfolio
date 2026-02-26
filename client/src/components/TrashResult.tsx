import { trashCategoryInfo, TrashCategory } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Info, CheckCircle2, Sparkles, AlertTriangle, Phone, ExternalLink } from "lucide-react";
import { Language, t } from "@/lib/translations";

interface TrashResultProps {
  itemName: string;
  category: TrashCategory;
  instructions: string;
  confidence: number;
  language: Language;
  capInstructions?: { material: string; bagColor: string };
  partInstructions?: Array<{ partName: string; bagColor: string }>;
  rejectionReason?: "HUMAN" | "NON_WASTE_CONTEXT" | "UNCOLLECTABLE";
}

const categoryKeyMap: Record<TrashCategory, string> = {
  burnable: "categoryBurnable",
  "non-burnable": "categoryNonBurnable",
  recyclable: "categoryRecyclable",
  "old-paper-clothing": "categoryOldPaperClothing",
  oversized: "categoryOversized",
  "special-recycling": "categorySpecialRecycling",
  "city-excluded": "categoryCityExcluded",
  "invalid-scan": "categoryInvalidScan",
};

const bagColorKeyMap: Record<string, string> = {
  "Green": "bagGreen",
  "Transparent": "bagTransparent",
  "Pink": "bagPink",
  "Half-Transparent": "bagHalfTransparent",
  "Red Sticker": "bagRedSticker",
  "N/A": "bagNA",
};

const descriptionKeyMap: Record<TrashCategory, string> = {
  burnable: "descBurnable",
  "non-burnable": "descNonBurnable",
  recyclable: "descRecyclable",
  "old-paper-clothing": "descOldPaperClothing",
  oversized: "descOversized",
  "special-recycling": "descSpecialRecycling",
  "city-excluded": "descCityExcluded",
  "invalid-scan": "descInvalidScan",
};

interface ContactInfo {
  phone: string;
  nameEn: string;
  nameJa: string;
  url?: string;
  altPhone?: string;
  altUrl?: string;
  altNameEn?: string;
  altNameJa?: string;
}

function getContactInfo(category: TrashCategory, itemName: string, rejectionReason?: string): ContactInfo | null {
  const itemLower = itemName.toLowerCase();

  if (category === "oversized") {
    return {
      phone: "0977-66-5349",
      nameEn: "Beppu City Cleaning Office",
      nameJa: "別府市生活環境課清掃事務所",
      url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/sodai.html",
    };
  }

  if (category === "city-excluded" || category === "special-recycling") {
    if (itemLower.includes("computer") || itemLower.includes("pc") || itemLower.includes("laptop") || itemLower.includes("desktop") || itemLower.includes("パソコン") || itemLower.includes("ノートパソコン")) {
      return {
        phone: "0570-085-800",
        nameEn: "Linet Japan Recycling",
        nameJa: "リネットジャパンリサイクル",
        url: "https://www.renet.jp",
        altPhone: "03-5282-7685",
        altUrl: "https://www.pc3r.jp",
        altNameEn: "PC3R Promotion Association",
        altNameJa: "パソコン3R推進協会",
      };
    }

    if (itemLower.includes("motorcycle") || itemLower.includes("motorbike") || itemLower.includes("scooter") || itemLower.includes("バイク") || itemLower.includes("二輪") || itemLower.includes("オートバイ")) {
      return {
        phone: "050-3000-0727",
        nameEn: "Motorcycle Recycling Call Center",
        nameJa: "二輪車リサイクルコールセンター",
        url: "https://www.jarc.or.jp/motorcycle/",
      };
    }

    if (itemLower.includes("tv") || itemLower.includes("television") || itemLower.includes("テレビ") ||
        itemLower.includes("refrigerator") || itemLower.includes("fridge") || itemLower.includes("freezer") || itemLower.includes("冷蔵庫") || itemLower.includes("冷凍庫") ||
        itemLower.includes("air conditioner") || itemLower.includes("エアコン") ||
        itemLower.includes("washing machine") || itemLower.includes("dryer") || itemLower.includes("洗濯機") || itemLower.includes("乾燥機")) {
      return {
        phone: "0977-66-5353",
        nameEn: "Beppu City Cleaning Office (Home Appliance Recycling)",
        nameJa: "別府市生活環境課清掃事務所（家電リサイクル）",
        url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/",
      };
    }

    return {
      phone: "0977-66-5353",
      nameEn: "Beppu City Cleaning Office",
      nameJa: "別府市生活環境課清掃事務所",
      url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/",
    };
  }

  if (category === "invalid-scan" && rejectionReason === "UNCOLLECTABLE") {
    if (itemLower.includes("fire extinguisher") || itemLower.includes("消火器")) {
      return {
        phone: "03-5829-6773",
        nameEn: "Fire Extinguisher Recycling Center",
        nameJa: "消火器リサイクル推進センター",
        url: "https://www.ferpc.jp",
      };
    }

    if (itemLower.includes("tire") || itemLower.includes("タイヤ")) {
      return {
        phone: "0977-66-5353",
        nameEn: "Beppu City Cleaning Office (for vendor referral)",
        nameJa: "別府市生活環境課清掃事務所（業者紹介）",
        url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/",
      };
    }

    if (itemLower.includes("battery") || itemLower.includes("バッテリー")) {
      return {
        phone: "0977-66-5353",
        nameEn: "Beppu City Cleaning Office (for vendor referral)",
        nameJa: "別府市生活環境課清掃事務所（業者紹介）",
        url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/",
      };
    }

    return {
      phone: "0977-66-5353",
      nameEn: "Beppu City Cleaning Office",
      nameJa: "別府市生活環境課清掃事務所",
      url: "https://www.city.beppu.oita.jp/seikatu/kankyou_gomi/g_siwake/",
    };
  }

  return null;
}

function ContactSection({ contact, language, category }: { contact: ContactInfo; language: Language; category: TrashCategory }) {
  const contactName = language === "ja" ? contact.nameJa : contact.nameEn;
  const showFee = category === "oversized";

  return (
    <div className="space-y-2 pt-3 border-t border-border/50 bg-blue-50/50 dark:bg-blue-950/20 -mx-5 -mb-4 px-5 pb-4 mt-4 rounded-b-2xl" data-testid="section-contact-info">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
        {contactName}
      </p>

      {showFee && (
        <p className="text-xs font-medium text-foreground mb-2" data-testid="text-fee-info">
          {t("oversizedFeeInfo", language)}
        </p>
      )}

      <a
        href={`tel:${contact.phone}`}
        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover-elevate rounded-md p-1.5 -ml-1.5 transition-colors"
        data-testid="link-phone-primary"
      >
        <Phone className="h-4 w-4 flex-shrink-0" />
        <span>{t("contactCallTo", language)}: {contact.phone}</span>
      </a>

      {contact.url && (
        <a
          href={contact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover-elevate rounded-md p-1.5 -ml-1.5 transition-colors"
          data-testid="link-website-primary"
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0" />
          <span>{t("contactVisit", language)}: {contact.url.replace("https://", "")}</span>
        </a>
      )}

      {contact.altPhone && (
        <div className="pt-2 mt-1 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-1.5">
            {t("contactOrAlternative", language)}: {language === "ja" ? contact.altNameJa : contact.altNameEn}
          </p>
          <a
            href={`tel:${contact.altPhone}`}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover-elevate rounded-md p-1.5 -ml-1.5 transition-colors"
            data-testid="link-phone-alt"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{t("contactCallTo", language)}: {contact.altPhone}</span>
          </a>
          {contact.altUrl && (
            <a
              href={contact.altUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover-elevate rounded-md p-1.5 -ml-1.5 transition-colors"
              data-testid="link-website-alt"
            >
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <span>{t("contactVisit", language)}: {contact.altUrl.replace("https://", "")}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrashResult({ itemName, category, instructions, confidence, language, capInstructions, partInstructions, rejectionReason }: TrashResultProps) {
  const categoryData = trashCategoryInfo[category];
  const categoryName = t(categoryKeyMap[category] || "categoryBurnable", language);
  const bagColorName = t(bagColorKeyMap[categoryData.bagColor] || "bagGreen", language);
  const categoryDescription = t(descriptionKeyMap[category] || "descBurnable", language);
  const contactInfo = getContactInfo(category, itemName, rejectionReason);
  
  const getGradientClass = () => {
    switch (category) {
      case "burnable":
        return "from-green-500/20 to-emerald-500/20";
      case "recyclable":
        return "from-pink-500/20 to-rose-500/20";
      case "non-burnable":
        return "from-gray-500/20 to-slate-500/20";
      case "old-paper-clothing":
        return "from-amber-500/20 to-yellow-500/20";
      case "oversized":
        return "from-red-500/20 to-orange-500/20";
      case "special-recycling":
        return "from-cyan-500/20 to-teal-500/20";
      default:
        return "from-gray-500/20 to-slate-500/20";
    }
  };
  
  return (
    <Card className={`overflow-hidden shadow-xl border-0 bg-gradient-to-br ${getGradientClass()} backdrop-blur-sm transition-smooth hover:shadow-2xl`} data-testid="card-result">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <h2 className="text-2xl font-bold text-foreground tracking-tight" data-testid="text-item-name">
                {itemName}
              </h2>
            </div>
            {category !== "invalid-scan" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>
                  {Math.round(confidence * 100)}% {t("confident", language)}
                </span>
              </div>
            )}
          </div>
          <Badge variant="secondary" className="flex-shrink-0 text-xs font-bold uppercase tracking-wider shadow-sm">
            {categoryName}
          </Badge>
        </div>

        <div className={`h-2 rounded-full ${categoryData.colorClass} shadow-inner`} data-testid="indicator-bag-color" />

        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${categoryData.colorClass} shadow-md flex items-center justify-center`}>
              <div className="h-4 w-4 rounded-full bg-white/40" />
            </div>
            <p className="font-bold text-lg text-foreground">
              {bagColorName}
            </p>
          </div>
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            {categoryDescription}
          </p>
          <div className="flex items-start gap-3 pt-2 border-t border-border/50">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed" data-testid="text-instructions">
              {instructions}
            </p>
          </div>

          {confidence <= 0.60 && (
            <div className="flex items-start gap-3 pt-3 border-t border-border/50 bg-amber-50/50 dark:bg-amber-950/20 -mx-5 -mb-4 px-5 pb-4 mt-4 rounded-b-2xl" data-testid="advisory-double-check">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                {t("doubleCheckAdvice", language)}
              </p>
            </div>
          )}
          
          {(partInstructions && partInstructions.length > 0) ? (
            <div className="flex items-start gap-3 pt-3 border-t border-border/50 bg-muted/30 -mx-5 -mb-4 px-5 pb-4 mt-4">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm w-full" data-testid="text-part-instructions">
                <p className="font-semibold text-foreground mb-2">
                  {t("separateParts", language)}
                </p>
                <ul className="space-y-1.5">
                  {partInstructions.map((part, index) => (
                    <li key={index} className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-foreground font-medium">{part.partName}</span>
                      <span>→</span>
                      <span className={`font-semibold ${
                        part.bagColor === "Green" ? "text-green-600 dark:text-green-400" :
                        part.bagColor === "Pink" ? "text-pink-600 dark:text-pink-400" :
                        part.bagColor === "Transparent" ? "text-gray-600 dark:text-gray-400" :
                        "text-foreground"
                      }`}>
                        {bagColorKeyMap[part.bagColor] ? t(bagColorKeyMap[part.bagColor], language) : part.bagColor}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : capInstructions && (
            <div className="flex items-start gap-3 pt-3 border-t border-border/50 bg-muted/30 -mx-5 -mb-4 px-5 pb-4 mt-4">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm" data-testid="text-cap-instructions">
                <p className="font-semibold text-foreground mb-1">
                  {t("capLidDisposal", language)}
                </p>
                <p className="text-muted-foreground">
                  {capInstructions.material} {t("capTo", language)} → {bagColorKeyMap[capInstructions.bagColor] ? t(bagColorKeyMap[capInstructions.bagColor], language) : capInstructions.bagColor}
                </p>
              </div>
            </div>
          )}

          {contactInfo && (
            <ContactSection contact={contactInfo} language={language} category={category} />
          )}
        </div>
      </div>
    </Card>
  );
}
