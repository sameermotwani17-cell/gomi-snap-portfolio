import { TrashItem, trashCategoryInfo, TrashCategory } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import { t, Language } from "@/lib/translations";

interface TrashItemCardProps {
  item: TrashItem;
  language: Language;
}

// Helper to get item name in selected language
function getItemName(item: TrashItem, language: Language): string {
  // For now, fallback to en/ja as the TrashItem schema only has those
  return language === "en" || language === "zh" || language === "ko" || language === "id" || language === "my" 
    ? item.nameEn 
    : item.nameJa;
}

// Helper to get secondary name (shows alternate language)
function getSecondaryName(item: TrashItem, language: Language): string {
  return language === "ja" ? item.nameEn : item.nameJa;
}

// Helper to get instructions in selected language
function getInstructions(item: TrashItem, language: Language): string {
  return language === "ja" ? item.instructionsJa : item.instructionsEn;
}

// Category translation key map
const categoryKeyMap: Record<TrashCategory, string> = {
  burnable: "categoryBurnable",
  "non-burnable": "categoryNonBurnable",
  recyclable: "categoryRecyclable",
  "old-paper-clothing": "categoryOldPaperClothing",
  oversized: "categoryOversized",
  "special-recycling": "categorySpecialRecycling",
};

// Bag color translation key map
const bagColorKeyMap: Record<string, string> = {
  Green: "bagGreen",
  Transparent: "bagTransparent",
  Pink: "bagPink",
  "Half-Transparent": "bagHalfTransparent",
  "Red Sticker": "bagRedSticker",
};

export default function TrashItemCard({ item, language }: TrashItemCardProps) {
  const categoryData = trashCategoryInfo[item.category];
  const categoryKey = categoryKeyMap[item.category] || "categoryBurnable";
  const bagColorKey = bagColorKeyMap[categoryData.bagColor] || "bagGreen";
  
  return (
    <Card className="overflow-hidden" data-testid={`card-item-${item.id}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-foreground truncate" data-testid="text-item-name">
              {getItemName(item, language)}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {getSecondaryName(item, language)}
            </p>
          </div>
          <Badge variant="secondary" className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide">
            {t(categoryKey, language)}
          </Badge>
        </div>

        <div className={`h-2 rounded-full ${categoryData.colorClass}`} data-testid="indicator-bag-color" />

        <div className="flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {t(bagColorKey, language)} {t("bag", language)}
            </p>
            <p className="text-muted-foreground" data-testid="text-instructions">
              {getInstructions(item, language)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
