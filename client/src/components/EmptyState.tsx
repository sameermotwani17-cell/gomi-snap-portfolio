import { Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, Language } from "@/lib/translations";

interface EmptyStateProps {
  language: Language;
  searchQuery: string;
}

export default function EmptyState({ language, searchQuery }: EmptyStateProps) {
  const handleScheduleClick = () => {
    window.open("https://www.city.beppu.oita.jp/sisetsu/gomi/", "_blank");
  };

  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Trash2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t("itemNotFound", language)}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {t("tryDifferentKeywords", language)}
        </p>
        <Button variant="outline" data-testid="button-report">
          {t("reportMissingItem", language)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Trash2 className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {t("typeToSearch", language)}
      </h2>
      <p className="text-sm text-muted-foreground mb-1">
        {t("searchExamples", language)}
      </p>
      
      <Button
        variant="outline"
        onClick={handleScheduleClick}
        className="gap-2 mt-6"
        data-testid="button-schedule"
      >
        <Calendar className="h-4 w-4" />
        {t("viewCollectionSchedule", language)}
      </Button>
    </div>
  );
}
