import { useState } from "react";
import SearchBar from "../SearchBar";

export default function SearchBarExample() {
  const [value, setValue] = useState("");
  const [language, setLanguage] = useState<"en" | "ja">("en");

  return (
    <div className="min-h-screen bg-background">
      <SearchBar
        value={value}
        onChange={setValue}
        onClear={() => setValue("")}
        language={language}
        onLanguageToggle={() => setLanguage(language === "en" ? "ja" : "en")}
      />
    </div>
  );
}
