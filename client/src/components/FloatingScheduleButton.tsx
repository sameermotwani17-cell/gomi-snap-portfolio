import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, Language } from "@/lib/translations";

interface FloatingScheduleButtonProps {
  language: Language;
}

export default function FloatingScheduleButton({ language }: FloatingScheduleButtonProps) {
  const handleClick = () => {
    window.open("https://www.city.beppu.oita.jp/sisetsu/gomi/", "_blank");
  };

  return (
    <Button
      size="lg"
      className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg gap-2 z-40"
      onClick={handleClick}
      data-testid="button-schedule-fab"
    >
      <Calendar className="h-5 w-5" />
      <span className="hidden sm:inline">
        {t("schedule", language)}
      </span>
    </Button>
  );
}
