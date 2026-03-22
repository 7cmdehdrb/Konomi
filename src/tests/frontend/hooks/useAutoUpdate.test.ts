import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { preloadEvents, preloadMocks } from "../helpers/preload-mocks";

describe("useAutoUpdate", () => {
  it("shows downloading toast when update is available (Windows)", () => {
    renderHook(() => useAutoUpdate());

    act(() => {
      preloadEvents.appInfo.updateAvailable.emit({ version: "1.2.0" });
    });

    expect(toast.info).toHaveBeenCalledWith(
      "Downloading new version 1.2.0...",
      expect.objectContaining({ duration: Infinity }),
    );
  });

  it("shows new version toast with download button when releaseUrl is present (macOS)", () => {
    const releaseUrl =
      "https://github.com/blackwaterbread/Konomi/releases/latest";
    renderHook(() => useAutoUpdate());

    act(() => {
      preloadEvents.appInfo.updateAvailable.emit({
        version: "1.2.0",
        releaseUrl,
      });
    });

    expect(toast.info).toHaveBeenCalledWith(
      "New version 1.2.0 is available",
      expect.objectContaining({
        duration: Infinity,
        action: expect.objectContaining({ label: "Download" }),
      }),
    );
  });

  it("opens release URL when download button is clicked (macOS)", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const releaseUrl =
      "https://github.com/blackwaterbread/Konomi/releases/latest";
    renderHook(() => useAutoUpdate());

    act(() => {
      preloadEvents.appInfo.updateAvailable.emit({
        version: "1.2.0",
        releaseUrl,
      });
    });

    const { action } = (toast.info as ReturnType<typeof vi.fn>).mock.calls[0][1];
    act(() => {
      action.onClick();
    });

    expect(openSpy).toHaveBeenCalledWith(releaseUrl);
    openSpy.mockRestore();
  });

  it("shows install toast when update is downloaded", () => {
    renderHook(() => useAutoUpdate());

    act(() => {
      preloadEvents.appInfo.updateDownloaded.emit({ version: "1.2.0" });
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Update 1.2.0 ready to install",
      expect.objectContaining({
        duration: Infinity,
        action: expect.objectContaining({ label: "Install Now" }),
      }),
    );
  });

  it("calls installUpdate when install button is clicked", () => {
    renderHook(() => useAutoUpdate());

    act(() => {
      preloadEvents.appInfo.updateDownloaded.emit({ version: "1.2.0" });
    });

    const { action } = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1];
    act(() => {
      action.onClick();
    });

    expect(preloadMocks.appInfo.installUpdate).toHaveBeenCalled();
  });

  it("unsubscribes from events on unmount", () => {
    const { unmount } = renderHook(() => useAutoUpdate());

    unmount();

    act(() => {
      preloadEvents.appInfo.updateAvailable.emit({ version: "1.2.0" });
      preloadEvents.appInfo.updateDownloaded.emit({ version: "1.2.0" });
    });

    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
