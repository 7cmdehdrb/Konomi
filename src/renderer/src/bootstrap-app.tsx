import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster, useSonner } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import App from "./App";
import { AppSplash } from "@/components/app-splash";
import { applyAppLanguagePreference } from "@/lib/i18n";
import { createLogger } from "@/lib/logger";
import type { ThemeId } from "@/lib/themes";
import { readStoredSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Folder } from "@preload/index.d";

const log = createLogger("renderer/BootstrapApp");
const APP_SPLASH_MIN_VISIBLE_MS = 1900; // 사용자가 최소 1.9초는 Splash를 보기를 원해
const APP_SPLASH_COMPLETION_HOLD_MS = 180;
const APP_SPLASH_FADE_OUT_MS = 240;
const TOASTER_POSITION = "bottom-right";
const isWebMode = Boolean((window as { __konomiWebMode?: boolean }).__konomiWebMode);

type AuthState = "checking" | "locked" | "authed";

interface BootstrapResult {
  folderCount: number | null;
  folders: Folder[] | null;
}

let migrationPromise: Promise<void> | null = null;
let initialFolderCountPromise: Promise<number | null> | null = null;
let bootstrapPromise: Promise<BootstrapResult> | null = null;
const bootstrapResult: BootstrapResult = {
  folderCount: null,
  folders: null,
};
let bootstrapCompleted = false;

function ensureMigrationsRun(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = window.db.runMigrations().catch((error: unknown) => {
      log.error("Database migration failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
  return migrationPromise;
}

function ensureInitialFolderCount(): Promise<number | null> {
  if (!initialFolderCountPromise) {
    initialFolderCountPromise = ensureMigrationsRun()
      .then(() => window.folder.list())
      .then((folders) => {
        bootstrapResult.folders = folders;
        bootstrapResult.folderCount = folders.length;
        return bootstrapResult.folderCount;
      })
      .catch((error: unknown) => {
        log.warn("Failed to load initial folder count during bootstrap", {
          error: error instanceof Error ? error.message : String(error),
        });
        bootstrapResult.folderCount = null;
        return null;
      });
  }

  return initialFolderCountPromise;
}

function ensureBootstrapComplete(): Promise<BootstrapResult> {
  if (bootstrapCompleted) {
    return Promise.resolve(bootstrapResult);
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureInitialFolderCount();
      bootstrapCompleted = true;
      return bootstrapResult;
    })();
  }

  return bootstrapPromise;
}

function bindThemePreference(theme: ThemeId): () => void {
  const applyTheme = (isDark: boolean) => {
    document.documentElement.dataset.theme = isDark ? "dark" : "white";
    document.documentElement.classList.toggle("dark", isDark);
  };

  if (theme === "auto") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(mq.matches);
    const handler = (event: MediaQueryListEvent) => applyTheme(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }

  applyTheme(theme === "dark");
  return () => undefined;
}

function ClickableToaster() {
  const { toasts } = useSonner();
  const toasterRef = useRef<HTMLElement | null>(null);
  const toastIdByElementRef = useRef(
    new WeakMap<HTMLElement, string | number>(),
  );

  useEffect(() => {
    const toaster = toasterRef.current;
    if (!toaster) return;

    toastIdByElementRef.current = new WeakMap();
    const [defaultYPosition, defaultXPosition] = TOASTER_POSITION.split("-");
    const toasterLists = Array.from(
      toaster.querySelectorAll<HTMLOListElement>("ol[data-sonner-toaster]"),
    );

    toasterLists.forEach((list) => {
      const yPosition = list.dataset.yPosition ?? defaultYPosition;
      const xPosition = list.dataset.xPosition ?? defaultXPosition;
      const position = `${yPosition}-${xPosition}`;
      const positionedToasts = toasts.filter(
        (toastItem) => (toastItem.position ?? TOASTER_POSITION) === position,
      );
      const toastElements = Array.from(
        list.querySelectorAll<HTMLElement>(":scope > [data-sonner-toast]"),
      );

      toastElements.forEach((element, index) => {
        const toastItem = positionedToasts[index];
        if (toastItem) {
          toastIdByElementRef.current.set(element, toastItem.id);
        }
      });
    });
  }, [toasts]);

  useEffect(() => {
    const toaster = toasterRef.current;
    if (!toaster) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.closest(
          "button, a, input, textarea, select, label, [role='button']",
        )
      ) {
        return;
      }

      const toastElement = target.closest<HTMLElement>("[data-sonner-toast]");
      if (!toastElement || !toaster.contains(toastElement)) return;
      if (toastElement.dataset.dismissible === "false") return;

      const toastId = toastIdByElementRef.current.get(toastElement);
      if (toastId == null) return;
      toast.dismiss(toastId);
    };

    toaster.addEventListener("click", handleClick);
    return () => toaster.removeEventListener("click", handleClick);
  }, []);

  return <Toaster ref={toasterRef} richColors position={TOASTER_POSITION} />;
}

export function BootstrapApp() {
  const { t } = useTranslation();
  const storedSettings = useMemo(() => readStoredSettings(), []);
  const [authState, setAuthState] = useState<AuthState>(
    isWebMode ? "checking" : "authed",
  );
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [folderCount, setFolderCount] = useState<number | null>(
    bootstrapResult.folderCount,
  );
  const [migrating, setMigrating] = useState(false);
  const [mountApp, setMountApp] = useState(bootstrapCompleted);
  const [renderSplash, setRenderSplash] = useState(!bootstrapCompleted);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const splashShownAtRef = useRef<number | null>(null);
  const splashMinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splashFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSplashTimers = useCallback(() => {
    if (splashMinTimerRef.current) {
      clearTimeout(splashMinTimerRef.current);
      splashMinTimerRef.current = null;
    }
    if (splashFadeTimerRef.current) {
      clearTimeout(splashFadeTimerRef.current);
      splashFadeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    void applyAppLanguagePreference(storedSettings.language);
  }, [storedSettings.language]);

  useEffect(() => {
    if (mountApp) return;
    return bindThemePreference(storedSettings.theme);
  }, [mountApp, storedSettings.theme]);

  useEffect(() => {
    if (renderSplash && splashShownAtRef.current === null) {
      splashShownAtRef.current = Date.now();
    }
  }, [renderSplash]);

  useEffect(() => {
    if (!isWebMode) return;
    let cancelled = false;
    void window.auth
      .status()
      .then((ok) => {
        if (!cancelled) setAuthState(ok ? "authed" : "locked");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthState("locked");
          setAuthError(
            error instanceof Error
              ? error.message
              : "인증 상태를 확인할 수 없습니다.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isWebMode && authState !== "authed") return;
    if (bootstrapCompleted) {
      setFolderCount(bootstrapResult.folderCount);
      setMountApp(true);

      setProgressPercent(100);
      setRenderSplash(false);
      setSplashFadingOut(false);
      return;
    }

    let cancelled = false;
    const offMigrationProgress = window.db.onMigrationProgress((data) => {
      if (data.total > 0 && data.done < data.total) {
        setMigrating(true);
        const migrationPercent = Math.min(
          50,
          Math.round((data.done / data.total) * 50),
        );
        setProgressPercent(migrationPercent);
      } else {
        setMigrating(false);
      }
    });

    void ensureInitialFolderCount().then((count) => {
      if (!cancelled) {
        setFolderCount(count);
        setProgressPercent((prev) => prev ?? 60);
      }
    });

    void ensureBootstrapComplete().then((result) => {
      if (cancelled) return;

      setFolderCount(result.folderCount);

      setProgressPercent(100);
      const shownAt = splashShownAtRef.current ?? Date.now();
      const elapsedMs = Date.now() - shownAt;
      const waitMs = Math.max(
        APP_SPLASH_COMPLETION_HOLD_MS,
        APP_SPLASH_MIN_VISIBLE_MS - elapsedMs,
      );

      splashMinTimerRef.current = setTimeout(() => {
        setMountApp(true);
        setSplashFadingOut(true);
        splashFadeTimerRef.current = setTimeout(() => {
          setRenderSplash(false);
        }, APP_SPLASH_FADE_OUT_MS);
      }, waitMs);
    });

    return () => {
      cancelled = true;
      clearSplashTimers();
      offMigrationProgress();
    };
  }, [authState, clearSplashTimers]);

  const statusText = useMemo(() => {
    if (migrating) {
      return t("app.splash.status.updatingDatabase");
    }
    if (folderCount === null) {
      return t("app.splash.status.checkingFolders");
    }
    if (folderCount === 0) {
      return t("app.splash.status.preparingOnboarding");
    }
    return t("app.splash.status.finalizing");
  }, [folderCount, migrating, t]);

  const detailText = useMemo(() => {
    if (migrating) {
      return t("app.splash.detail.updatingDatabase");
    }
    if (folderCount === null) {
      return t("app.splash.detail.loadingFolders");
    }
    if (folderCount === 0) {
      return t("app.splash.detail.preparingOnboarding");
    }
    return t("app.splash.detail.loadingLibraryState");
  }, [folderCount, migrating, t]);

  const submitLogin = useCallback(async () => {
    const value = password.trim();
    if (!value) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const ok = await window.auth.login(value);
      if (!ok) {
        setAuthError("비밀번호가 일치하지 않습니다.");
        return;
      }
      setPassword("");
      setAuthState("authed");
      setRenderSplash(!bootstrapCompleted);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "로그인 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  }, [password]);

  if (isWebMode && authState !== "authed") {
    return (
      <>
        <ClickableToaster />
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
            <h1 className="text-lg font-semibold text-foreground">Konomi 잠금 해제</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              비밀번호를 입력해야 라이브러리에 접근할 수 있습니다.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitLogin();
                  }
                }}
                placeholder="Password"
                autoFocus
              />
              {authError && (
                <p className="text-xs text-destructive">{authError}</p>
              )}
              <Button
                className="w-full"
                onClick={() => void submitLogin()}
                disabled={authSubmitting || authState === "checking"}
              >
                {authSubmitting || authState === "checking" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Unlock"
                )}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ClickableToaster />
      {mountApp && (
        <App
          initialFolderCount={folderCount}
          initialFolders={bootstrapResult.folders}
        />
      )}
      {renderSplash && (
        <AppSplash
          fadingOut={splashFadingOut}
          statusText={statusText}
          detailText={detailText}
          progressPercent={progressPercent}
        />
      )}
    </>
  );
}
