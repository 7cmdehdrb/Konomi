import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { ImageRow } from "@preload/index.d";
import { createLogger } from "@/lib/logger";

const log = createLogger("renderer/useImageWatchBootstrap");

interface UseImageWatchBootstrapOptions {
  loadSearchPresetStats: () => Promise<void>;
  scheduleSearchStatsRefresh: (delay?: number) => void;
  handleSearchStatsProgress: (data: { done: number; total: number }) => void;
  scanningRef: MutableRefObject<boolean>;
  scheduleAnalysis: (delay?: number) => void;
  schedulePageRefresh: (delay?: number) => void;
}

export function useImageWatchBootstrap({
  loadSearchPresetStats,
  scheduleSearchStatsRefresh,
  handleSearchStatsProgress,
  scanningRef,
  scheduleAnalysis,
  schedulePageRefresh,
}: UseImageWatchBootstrapOptions) {
  useEffect(() => {
    log.info("App mounted: loading initial data and starting watchers");
    void loadSearchPresetStats();
    scheduleAnalysis(0);
    let scanFirstBatchFired = false;

    const offBatch = window.image.onBatch((rows: ImageRow[]) => {
      if (rows.length === 0) return;
      if (scanningRef.current) {
        // 스캔 중 첫 배치는 즉시 갤러리에 표시하여 빈 화면 시간을 줄인다
        if (!scanFirstBatchFired) {
          scanFirstBatchFired = true;
          schedulePageRefresh(0);
        } else {
          schedulePageRefresh(1500);
        }
      } else {
        scanFirstBatchFired = false;
        schedulePageRefresh(150);
        scheduleAnalysis();
        scheduleSearchStatsRefresh(180);
      }
    });

    const offRemoved = window.image.onRemoved((ids: number[]) => {
      if (ids.length === 0) return;
      schedulePageRefresh(60);
      scheduleAnalysis();
      scheduleSearchStatsRefresh(120);
    });

    const offSearchStatsProgress = window.image.onSearchStatsProgress(
      handleSearchStatsProgress,
    );

    let watchCancelled = false;
    let watchRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const startWatch = (attempt = 0): void => {
      void window.image.watch().catch((error: unknown) => {
        if (watchCancelled) return;
        const delayMs = Math.min(10000, 1000 * 2 ** attempt);
        log.warn("Image watcher start failed; retry scheduled", {
          attempt: attempt + 1,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
        watchRetryTimer = setTimeout(() => {
          watchRetryTimer = null;
          startWatch(attempt + 1);
        }, delayMs);
      });
    };
    startWatch();

    return () => {
      log.info("App unmount cleanup");
      watchCancelled = true;
      if (watchRetryTimer) {
        clearTimeout(watchRetryTimer);
        watchRetryTimer = null;
      }
      offBatch();
      offRemoved();
      offSearchStatsProgress();
    };
  }, [
    handleSearchStatsProgress,
    loadSearchPresetStats,
    scanningRef,
    scheduleAnalysis,
    schedulePageRefresh,
    scheduleSearchStatsRefresh,
  ]);
}
