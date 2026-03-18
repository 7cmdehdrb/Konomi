import { useState } from "react";
import { FolderPlus, Globe, Images, Search, Sparkles, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AppLanguage } from "@/lib/language";
import { SUPPORTED_APP_LANGUAGES } from "@/lib/language";
import { cn } from "@/lib/utils";

interface OnboardingViewProps {
  onAddFolder: () => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}

const ONBOARDING_LANGUAGE_STEP_KEY = "konomi-onboarding-language-step-completed";

export function OnboardingView({
  onAddFolder,
  language,
  onLanguageChange,
}: OnboardingViewProps) {
  const { t } = useTranslation();
  const [languageStepCompleted, setLanguageStepCompleted] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_LANGUAGE_STEP_KEY) === "true";
    } catch {
      return false;
    }
  });

  const features = [
    {
      icon: Search,
      title: t("onboarding.features.search.title"),
      description: t("onboarding.features.search.description"),
    },
    {
      icon: Sparkles,
      title: t("onboarding.features.similar.title"),
      description: t("onboarding.features.similar.description"),
    },
    {
      icon: Tags,
      title: t("onboarding.features.categories.title"),
      description: t("onboarding.features.categories.description"),
    },
  ];

  const handleContinue = () => {
    try {
      localStorage.setItem(ONBOARDING_LANGUAGE_STEP_KEY, "true");
    } catch {
      // ignore storage errors
    }
    setLanguageStepCompleted(true);
  };

  if (!languageStepCompleted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
        <div className="max-w-lg space-y-8">
          <div className="space-y-3">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("onboarding.languageStep.title")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("onboarding.languageStep.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SUPPORTED_APP_LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onLanguageChange(item)}
                className={cn(
                  "rounded-xl border px-4 py-4 text-left transition-colors",
                  language === item
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                <div className="text-sm font-medium">
                  {t(`settings.language.${item}`)}
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {t(`onboarding.languageStep.options.${item}`)}
                </div>
              </button>
            ))}
          </div>

          <Button size="lg" className="gap-2" onClick={handleContinue}>
            {t("onboarding.languageStep.continue")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
      <div className="max-w-lg space-y-8">
        <div className="space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Images className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("onboarding.title")}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("onboarding.descriptionLine1")}
            <br />
            {t("onboarding.descriptionLine2")}
          </p>
        </div>

        <div className="space-y-3 text-left">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
            >
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {feature.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Button size="lg" className="gap-2" onClick={onAddFolder}>
            <FolderPlus className="h-5 w-5" />
            {t("onboarding.addFolder")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("onboarding.addFolderDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
