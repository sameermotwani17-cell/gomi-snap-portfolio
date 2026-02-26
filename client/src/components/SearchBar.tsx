import { Search, X, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { t, Language, LANGUAGE_CODES } from "@/lib/translations";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  language: Language;
  onLanguageToggle: () => void;
}

export default function SearchBar({ value, onChange, onClear, language, onLanguageToggle }: SearchBarProps) {
  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("typeItemName", language)}
              className="pl-10 pr-10 h-16 text-lg"
              autoFocus
              data-testid="input-search"
            />
            {value && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={onClear}
                data-testid="button-clear"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-16 w-16 flex-shrink-0"
            onClick={onLanguageToggle}
            data-testid="button-language"
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <Globe className="h-5 w-5" />
              <span className="text-xs font-semibold">{LANGUAGE_CODES[language]}</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
