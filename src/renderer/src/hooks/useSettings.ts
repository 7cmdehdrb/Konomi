import { useState } from "react";
import type { ThemeId } from "@/lib/themes";

export interface Settings {
  recentDays: number;
  pageSize: number;
  similarityThreshold: number;
  similarPageSize: number;
  theme: ThemeId;
}

export const DEFAULTS: Settings = {
  recentDays: 7,
  pageSize: 20,
  similarityThreshold: 12,
  similarPageSize: 10,
  theme: "auto",
};

const KEY = "konomi-settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = (keys?: (keyof Settings)[]) => {
    setSettings((prev) => {
      const next = keys
        ? { ...prev, ...Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]])) }
        : { ...DEFAULTS };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next as Settings;
    });
  };

  return { settings, updateSettings, resetSettings };
}
