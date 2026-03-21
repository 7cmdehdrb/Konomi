import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createLogger } from "@/lib/logger";

const log = createLogger("renderer/useSearchPresetStats");

export function useSearchPresetStats() {
  const [availableResolutions, setAvailableResolutions] = useState<
    Array<{ width: number; height: number }>
  >([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [searchStatsProgress, setSearchStatsProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const searchStatsRefreshTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const searchStatsClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const loadSearchPresetStats = useCallback(async () => {
    try {
      const stats = await window.image.getSearchPresetStats();
      startTransition(() => {
        setAvailableResolutions(stats.availableResolutions);
        setAvailableModels(stats.availableModels);
      });
    } catch (error: unknown) {
      log.warn("Failed to load search preset stats", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const scheduleSearchStatsRefresh = useCallback(
    (delay = 220) => {
      if (searchStatsRefreshTimerRef.current) {
        clearTimeout(searchStatsRefreshTimerRef.current);
      }
      searchStatsRefreshTimerRef.current = setTimeout(() => {
        searchStatsRefreshTimerRef.current = null;
        void loadSearchPresetStats();
      }, delay);
    },
    [loadSearchPresetStats],
  );

  const handleSearchStatsProgress = useCallback(
    (data: { done: number; total: number }) => {
      startTransition(() => setSearchStatsProgress(data));
      if (searchStatsClearTimerRef.current) {
        clearTimeout(searchStatsClearTimerRef.current);
        searchStatsClearTimerRef.current = null;
      }
      if (data.total > 0 && data.done >= data.total) {
        searchStatsClearTimerRef.current = setTimeout(() => {
          setSearchStatsProgress(null);
          searchStatsClearTimerRef.current = null;
        }, 250);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (searchStatsRefreshTimerRef.current) {
        clearTimeout(searchStatsRefreshTimerRef.current);
        searchStatsRefreshTimerRef.current = null;
      }
      if (searchStatsClearTimerRef.current) {
        clearTimeout(searchStatsClearTimerRef.current);
        searchStatsClearTimerRef.current = null;
      }
    };
  }, []);

  return {
    availableResolutions,
    availableModels,
    searchStatsProgress,
    loadSearchPresetStats,
    scheduleSearchStatsRefresh,
    handleSearchStatsProgress,
  };
}
