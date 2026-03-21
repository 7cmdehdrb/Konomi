import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImageWatchBootstrap } from "@/hooks/useImageWatchBootstrap";
import { createImageRow } from "../helpers/image-row";
import { preloadEvents, preloadMocks } from "../helpers/preload-mocks";

describe("useImageWatchBootstrap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("boots watchers and reacts to batch, removed, and stats progress events", async () => {
    const loadSearchPresetStats = vi.fn().mockResolvedValue(undefined);
    const scheduleSearchStatsRefresh = vi.fn();
    const handleSearchStatsProgress = vi.fn();
    const scheduleAnalysis = vi.fn();
    const schedulePageRefresh = vi.fn();
    const scanningRef = { current: false };

    renderHook(() =>
      useImageWatchBootstrap({
        loadSearchPresetStats,
        scheduleSearchStatsRefresh,
        handleSearchStatsProgress,
        scanningRef,
        scheduleAnalysis,
        schedulePageRefresh,
      }),
    );

    await waitFor(() => expect(loadSearchPresetStats).toHaveBeenCalledTimes(1));
    expect(scheduleAnalysis).toHaveBeenCalledWith(0);
    expect(preloadMocks.image.watch).toHaveBeenCalledTimes(1);

    act(() => {
      preloadEvents.image.batch.emit([]);
      preloadEvents.image.batch.emit([createImageRow({ id: 1 })]);
      preloadEvents.image.removed.emit([11, 12]);
      preloadEvents.image.searchStatsProgress.emit({ done: 2, total: 3 });
    });

    expect(schedulePageRefresh).toHaveBeenCalledWith(150);
    expect(schedulePageRefresh).toHaveBeenCalledWith(60);
    expect(scheduleAnalysis).toHaveBeenCalledTimes(3);
    expect(scheduleSearchStatsRefresh).toHaveBeenCalledWith(180);
    expect(scheduleSearchStatsRefresh).toHaveBeenCalledWith(120);
    expect(handleSearchStatsProgress).toHaveBeenCalledWith({
      done: 2,
      total: 3,
    });
  });
});
