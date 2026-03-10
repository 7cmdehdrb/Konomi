import { useState, useMemo, useCallback, useEffect, useRef, startTransition, useDeferredValue } from "react";
import { Toaster, toast } from "sonner";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ImageGallery } from "@/components/image-gallery";
import { ImageDetail } from "@/components/image-detail";
import { SettingsView } from "@/components/settings-view";
import { CategoryDialog } from "@/components/category-dialog";
import { GenerationView } from "@/components/generation-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useNaiGenSettings } from "@/hooks/useNaiGenSettings";
import type { ImageData } from "@/components/image-card";
import type { PromptToken } from "@/lib/token";
import type { ImageRow, Category, SimilarGroup } from "@preload/index.d";
import type { AdvancedFilter } from "@/lib/advanced-filter";
import { createLogger } from "@/lib/logger";

const log = createLogger("renderer/App");
const CATEGORY_ORDER_STORAGE_KEY = "konomi-category-order";

function parseTokens(json: string | undefined): PromptToken[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === "string")
      return (parsed as string[]).map((text) => ({ text, weight: 1 }));
    return parsed as PromptToken[];
  } catch {
    return [];
  }
}

function rowToImageData(row: ImageRow): ImageData {
  return {
    id: String(row.id),
    path: row.path,
    src: `konomi://local/${encodeURIComponent(row.path.replace(/\\/g, "/"))}`,
    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    characterPrompts: (() => {
      try {
        return JSON.parse(row.characterPrompts) as string[];
      } catch {
        return [];
      }
    })(),
    tokens: parseTokens(row.promptTokens),
    negativeTokens: parseTokens(row.negativePromptTokens),
    characterTokens: parseTokens(row.characterPromptTokens),
    category: "",
    tags: [],
    fileModifiedAt: new Date(row.fileModifiedAt).toISOString(),
    isFavorite: row.isFavorite,
    pHash: row.pHash,
    source: row.source,
    folderId: row.folderId,
    model: row.model,
    seed: row.seed,
    width: row.width,
    height: row.height,
    cfgScale: row.cfgScale,
    cfgRescale: row.cfgRescale,
    noiseSchedule: row.noiseSchedule,
    varietyPlus: row.varietyPlus,
    sampler: row.sampler,
    steps: row.steps,
  };
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function hashStringToUint32(input: string): number {
  // FNV-1a 32-bit hash for deterministic ordering.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function randomRank(seed: number, key: string): number {
  return hashStringToUint32(`${seed}:${key}`);
}

function readCategoryOrder(): number[] {
  try {
    const raw = localStorage.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => Number.isInteger(id));
  } catch {
    return [];
  }
}

function writeCategoryOrder(ids: number[]): void {
  try {
    localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

function applyCategoryOrder(
  inputCategories: Category[],
  preferredOrder?: number[],
): Category[] {
  const builtin = inputCategories
    .filter((cat) => cat.isBuiltin)
    .sort((a, b) => a.order - b.order);
  const custom = inputCategories.filter((cat) => !cat.isBuiltin);
  const order = preferredOrder ?? readCategoryOrder();
  const customMap = new Map(custom.map((cat) => [cat.id, cat]));
  const orderedCustom: Category[] = [];

  for (const id of order) {
    const cat = customMap.get(id);
    if (!cat) continue;
    orderedCustom.push(cat);
    customMap.delete(id);
  }

  const remainingCustom = custom.filter((cat) => customMap.has(cat.id));
  const normalizedCustom = [...orderedCustom, ...remainingCustom];
  writeCategoryOrder(normalizedCustom.map((cat) => cat.id));

  return [...builtin, ...normalizedCustom];
}

export default function App() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { outputFolder, setOutputFolder, resetOutputFolder } =
    useNaiGenSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(
    () => {
      try {
        const stored = localStorage.getItem("konomi-selected-folders");
        return stored ? new Set<number>(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    },
  );
  const [activeView, setActiveView] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "list">("grid");
  const [sortBy, setSortBy] = useState("recent");
  const [images, setImages] = useState<ImageData[]>([]);
  const deferredImages = useDeferredValue(images);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    "gallery" | "generator" | "settings"
  >("gallery");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return Number(localStorage.getItem("konomi-sidebar-width")) || 288;
    } catch {
      return 288;
    }
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const currentSidebarWidth = useRef(sidebarWidth);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = sidebarWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const next = Math.max(
        180,
        Math.min(480, dragStartWidth.current + e.clientX - dragStartX.current),
      );
      currentSidebarWidth.current = next;
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(
          "konomi-sidebar-width",
          String(currentSidebarWidth.current),
        );
      } catch {
        /* ignore */
      }
    };
    const onUnload = () => {
      try {
        localStorage.setItem(
          "konomi-sidebar-width",
          String(currentSidebarWidth.current),
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);
  const [scanning, setScanning] = useState(false);
  const [activeScanFolderIds, setActiveScanFolderIds] = useState<Set<number>>(
    new Set(),
  );
  const [rollbackFolderIds, setRollbackFolderIds] = useState<Set<number>>(
    new Set(),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hashProgress, setHashProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [similarGroups, setSimilarGroups] = useState<SimilarGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [randomSeed, setRandomSeed] = useState(() =>
    Math.floor(Math.random() * 0x7fffffff),
  );
  const [categoryImageIds, setCategoryImageIds] = useState<Set<number> | null>(
    null,
  );
  const [categoryDialogImage, setCategoryDialogImage] =
    useState<ImageData | null>(null);
  const [bulkCategoryDialogImages, setBulkCategoryDialogImages] = useState<
    ImageData[] | null
  >(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scanCancelConfirmOpen, setScanCancelConfirmOpen] = useState(false);
  const [folderRollbackRequest, setFolderRollbackRequest] = useState<{
    id: number;
    folderIds: number[];
  } | null>(null);
  const [scanningFolderNames, setScanningFolderNames] = useState<
    Map<number, string>
  >(new Map());
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilter[]>([]);
  const [pendingGeneratorImport, setPendingGeneratorImport] =
    useState<ImageData | null>(null);

  const pendingRowsRef = useRef<ImageRow[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanPromiseRef = useRef<Promise<void> | null>(null);
  const scanningRef = useRef(false);
  const analyzingRef = useRef(false);
  const rollbackRequestSeqRef = useRef(0);
  const cancelledFolderIdsRef = useRef<Set<number>>(new Set());
  const similarityThresholdRef = useRef(settings.similarityThreshold);
  const mountedRef = useRef(false);

  useEffect(() => {
    similarityThresholdRef.current = settings.similarityThreshold;
  }, [settings.similarityThreshold]);

  useEffect(() => {
    const theme = settings.theme ?? "dark";
    const applyTheme = (isDark: boolean) => {
      document.documentElement.dataset.theme = isDark ? "dark" : "white";
      document.documentElement.classList.toggle("dark", isDark);
    };
    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    applyTheme(theme === "dark");
    return undefined;
  }, [settings.theme]);

  const flushPendingBatch = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    const pending = pendingRowsRef.current.splice(0);
    if (pending.length === 0) return;
    startTransition(() => {
      setImages((prev) => {
        const map = new Map(prev.map((img) => [img.id, img]));
        pending.forEach((row) => map.set(String(row.id), rowToImageData(row)));
        return Array.from(map.values());
      });
    });
  }, []);

  const scheduleAnalysis = useCallback((delay = 3000) => {
    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    analyzeTimerRef.current = setTimeout(async () => {
      if (scanningRef.current) {
        log.debug("Analysis delayed because scan is running");
        scheduleAnalysis(1000);
        return;
      }
      const startedAt = Date.now();
      log.info("Analysis started", { delayMs: delay });
      analyzingRef.current = true;
      setIsAnalyzing(true);
      setHashProgress(null);
      try {
        await window.image.computeHashes();
        const groups = await window.image.similarGroups(
          similarityThresholdRef.current,
        );
        setSimilarGroups(groups);
        log.info("Analysis completed", {
          elapsedMs: Date.now() - startedAt,
          groups: groups.length,
        });
      } catch (e: unknown) {
        log.error("Analysis failed", {
          elapsedMs: Date.now() - startedAt,
          error: e instanceof Error ? e.message : String(e),
        });
        toast.error(
          `이미지 분석 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        analyzingRef.current = false;
        setHashProgress(null);
        setIsAnalyzing(false);
      }
    }, delay);
  }, []);

  const runScan = useCallback(
    (options?: { detectDuplicates?: boolean }) => {
      if (scanPromiseRef.current) {
        log.debug("Scan request deduped");
        return scanPromiseRef.current;
      }
      const startedAt = Date.now();
      log.info("Scan started", { options });
      scanningRef.current = true;
      setScanning(true);
      setScanProgress(null);
      const orderedFolderIds = (() => {
        try {
          const raw = localStorage.getItem("konomi-folder-order");
          if (!raw) return undefined;
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return undefined;
          const ids = parsed.filter((id): id is number => Number.isInteger(id));
          return ids.length > 0 ? ids : undefined;
        } catch {
          return undefined;
        }
      })();
      const scanPromise = window.image
        .scan({ ...options, orderedFolderIds })
        .then(() => {
          log.info("Scan completed", { elapsedMs: Date.now() - startedAt });
          flushPendingBatch();
          cancelledFolderIdsRef.current.clear();
        })
        .catch((e: unknown) => {
          log.error("Scan failed", {
            elapsedMs: Date.now() - startedAt,
            error: e instanceof Error ? e.message : String(e),
          });
          toast.error(
            `스캔 실패: ${e instanceof Error ? e.message : String(e)}`,
          );
        })
        .finally(() => {
          scanningRef.current = false;
          setScanning(false);
          setScanProgress(null);
          setActiveScanFolderIds(new Set());
          setScanningFolderNames(new Map());
          scanPromiseRef.current = null;
        });
      scanPromiseRef.current = scanPromise;
      return scanPromise;
    },
    [flushPendingBatch],
  );

  // Auto-analyze when threshold changes (skip initial mount)
  useEffect(() => {
    if (!mountedRef.current) return;
    scheduleAnalysis(500);
  }, [settings.similarityThreshold]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    log.info("App mounted: loading initial data and starting watchers");

    window.image
      .list()
      .then((rows) => setImages(rows.map(rowToImageData)))
      .catch((e: unknown) =>
        toast.error(
          `이미지 목록 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );

    const offBatch = window.image.onBatch((rows) => {
      const filtered = rows.filter(
        (r) => !cancelledFolderIdsRef.current.has(r.folderId),
      );
      pendingRowsRef.current.push(...filtered);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(flushPendingBatch, 150);
      if (!scanningRef.current && filtered.length > 0) scheduleAnalysis();
    });

    const offHashProgress = window.image.onHashProgress((data) => {
      if (analyzingRef.current) startTransition(() => setHashProgress(data));
    });
    const offScanProgress = window.image.onScanProgress((data) => {
      if (scanningRef.current) startTransition(() => setScanProgress(data));
    });
    const offScanFolder = window.image.onScanFolder(
      ({ folderId, folderName, active }) => {
        setActiveScanFolderIds((prev) => {
          const next = new Set(prev);
          if (active) next.add(folderId);
          else next.delete(folderId);
          return next;
        });
        setScanningFolderNames((prev) => {
          const next = new Map(prev);
          if (active && folderName) next.set(folderId, folderName);
          else next.delete(folderId);
          return next;
        });
      },
    );

    const offRemoved = window.image.onRemoved((ids) => {
      const idStrSet = new Set(ids.map(String));
      setImages((prev) => prev.filter((img) => !idStrSet.has(img.id)));
      scheduleAnalysis();
    });

    window.category
      .list()
      .then((loaded) => setCategories(applyCategoryOrder(loaded)))
      .catch((e: unknown) =>
        toast.error(
          `카테고리 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );

    runScan({ detectDuplicates: true }).then(() => scheduleAnalysis(0));
    try {
      window.image.watch();
    } catch {
      /* 감시 시작 실패 시 조용히 무시 */
    }

    return () => {
      log.info("App unmount cleanup");
      offBatch();
      offRemoved();
      offHashProgress();
      offScanProgress();
      offScanFolder();
    };
  }, []);

  useEffect(() => {
    if (selectedImage) {
      const updated = images.find((img) => img.id === selectedImage.id);
      if (updated) setSelectedImage(updated);
    }
  }, [images]);

  const availableResolutions = useMemo(() => {
    const freq = new Map<
      string,
      { width: number; height: number; count: number }
    >();
    for (const img of deferredImages) {
      if (img.width && img.height) {
        const key = `${img.width}x${img.height}`;
        const entry = freq.get(key);
        if (entry) entry.count++;
        else freq.set(key, { width: img.width, height: img.height, count: 1 });
      }
    }
    return Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .map(({ width, height }) => ({ width, height }));
  }, [deferredImages]);

  const availableModels = useMemo(() => {
    const freq = new Map<string, number>();
    for (const img of deferredImages) {
      if (img.model != null)
        freq.set(img.model, (freq.get(img.model) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
  }, [deferredImages]);

  const filteredImages = useMemo(() => {
    let result = [...deferredImages];

    result = result.filter((img) => selectedFolderIds.has(img.folderId));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (img) =>
          img.tokens.some((t) => t.text.toLowerCase().includes(query)) ||
          img.negativeTokens.some((t) =>
            t.text.toLowerCase().includes(query),
          ) ||
          img.characterTokens.some((t) => t.text.toLowerCase().includes(query)),
      );
    }

    if (advancedFilters.length > 0) {
      const resFilters = advancedFilters.filter(
        (f): f is Extract<AdvancedFilter, { type: "resolution" }> =>
          f.type === "resolution",
      );
      const modelFilters = advancedFilters.filter(
        (f): f is Extract<AdvancedFilter, { type: "model" }> =>
          f.type === "model",
      );
      if (resFilters.length > 0) {
        result = result.filter((img) =>
          resFilters.some(
            (f) => img.width === f.width && img.height === f.height,
          ),
        );
      }
      if (modelFilters.length > 0) {
        result = result.filter((img) =>
          modelFilters.some((f) => img.model === f.value),
        );
      }
    }

    if (selectedCategoryId !== null) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat?.isBuiltin && cat.name === "랜덤 픽") {
        return [...result]
          .sort((a, b) => {
            const rankA = randomRank(randomSeed, `${a.id}:${a.path}`);
            const rankB = randomRank(randomSeed, `${b.id}:${b.path}`);
            if (rankA !== rankB) return rankA - rankB;
            return a.id.localeCompare(b.id);
          })
          .slice(0, settings.pageSize);
      } else if (cat?.isBuiltin) {
        result = result.filter((img) => img.isFavorite);
      } else if (categoryImageIds !== null) {
        result = result.filter((img) => categoryImageIds.has(parseInt(img.id)));
      }
    }

    if (activeView === "recent") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - settings.recentDays);
      result = result.filter((img) => new Date(img.fileModifiedAt) >= cutoff);
    }

    switch (sortBy) {
      case "recent":
        result.sort(
          (a, b) =>
            new Date(b.fileModifiedAt).getTime() -
            new Date(a.fileModifiedAt).getTime(),
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.fileModifiedAt).getTime() -
            new Date(b.fileModifiedAt).getTime(),
        );
        break;
      case "favorites":
        result.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
        break;
      case "name":
        result.sort((a, b) =>
          fileNameFromPath(a.path).localeCompare(
            fileNameFromPath(b.path),
            undefined,
            { sensitivity: "base" },
          ),
        );
        break;
    }

    return result;
  }, [
    deferredImages,
    searchQuery,
    selectedFolderIds,
    activeView,
    sortBy,
    settings,
    selectedCategoryId,
    categories,
    categoryImageIds,
    advancedFilters,
    randomSeed,
  ]);

  useEffect(() => {
    localStorage.setItem(
      "konomi-selected-folders",
      JSON.stringify([...selectedFolderIds]),
    );
  }, [selectedFolderIds]);

  const handleFolderToggle = useCallback((id: number) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFolderAdded = useCallback(
    (folderId: number) => {
      log.info("Folder added", { folderId });
      setSelectedFolderIds((prev) => new Set([...prev, folderId]));
      setRollbackFolderIds((prev) => new Set([...prev, folderId]));
      setActiveScanFolderIds((prev) => new Set([...prev, folderId]));
      window.image
        .list()
        .then((rows) => setImages(rows.map(rowToImageData)))
        .catch(() => {});
      runScan().then(() => {
        setRollbackFolderIds((prev) => {
          const s = new Set(prev);
          s.delete(folderId);
          return s;
        });
        scheduleAnalysis(0);
      });
    },
    [runScan, scheduleAnalysis],
  );

  const handleFolderCancelled = useCallback(
    (id: number) => {
      log.info("Folder add rollback/cancelled", { folderId: id });
      cancelledFolderIdsRef.current.add(id);
      pendingRowsRef.current = pendingRowsRef.current.filter(
        (r) => r.folderId !== id,
      );
      setSelectedFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      setRollbackFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      setActiveScanFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      window.image
        .list()
        .then((rows) => {
          setImages(rows.map(rowToImageData));
          scheduleAnalysis(500);
        })
        .catch(() => {});
    },
    [scheduleAnalysis],
  );

  const handleFolderRemoved = useCallback(
    (id: number) => {
      log.info("Folder removed", { folderId: id });
      setSelectedFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      setRollbackFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      setActiveScanFolderIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      window.image
        .list()
        .then((rows) => {
          setImages(rows.map(rowToImageData));
          scheduleAnalysis(500);
        })
        .catch(() => {});
      runScan();
    },
    [runScan, scheduleAnalysis],
  );

  const handleCategorySelect = useCallback(
    (id: number | null) => {
      log.debug("Category selected", { categoryId: id });
      setSelectedCategoryId(id);
      if (id === null) {
        setCategoryImageIds(null);
        return;
      }
      const cat = categories.find((c) => c.id === id);
      if (cat?.isBuiltin) {
        setCategoryImageIds(null);
      } else {
        window.category
          .imageIds(id)
          .then((ids) => setCategoryImageIds(new Set(ids)))
          .catch((e: unknown) =>
            toast.error(
              `카테고리 이미지 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
            ),
          );
      }
    },
    [categories],
  );

  const handleCategoryCreate = useCallback((name: string) => {
    log.info("Creating category", { name });
    window.category
      .create(name)
      .then((cat) =>
        setCategories((prev) => applyCategoryOrder([...prev, cat])),
      )
      .catch((e: unknown) =>
        toast.error(
          `카테고리 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }, []);

  const handleCategoryRename = useCallback((id: number, name: string) => {
    log.info("Renaming category", { categoryId: id, name });
    window.category
      .rename(id, name)
      .then((updated) =>
        setCategories((prev) => prev.map((c) => (c.id === id ? updated : c))),
      )
      .catch((e: unknown) =>
        toast.error(
          `카테고리 이름 변경 실패: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }, []);

  const handleCategoryReorder = useCallback((ids: number[]) => {
    log.info("Reordering categories", { ids });
    setCategories((prev) => applyCategoryOrder(prev, ids));
  }, []);

  const handleCategoryDelete = useCallback(
    (id: number) => {
      log.info("Deleting category", { categoryId: id });
      window.category
        .delete(id)
        .then(() => {
          setCategories((prev) =>
            applyCategoryOrder(prev.filter((c) => c.id !== id)),
          );
          setSelectedCategoryId((prev) => (prev === id ? null : prev));
          setCategoryImageIds((prev) =>
            selectedCategoryId === id ? null : prev,
          );
        })
        .catch((e: unknown) =>
          toast.error(
            `카테고리 삭제 실패: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    },
    [selectedCategoryId],
  );

  const handleCategoryAddByPrompt = useCallback(
    (id: number, query: string) => {
      log.info("Adding category images by prompt", { categoryId: id, query });
      window.category
        .addByPrompt(id, query)
        .then(() => {
          if (selectedCategoryId === id) {
            window.category
              .imageIds(id)
              .then((ids) => setCategoryImageIds(new Set(ids)));
          }
        })
        .catch((e: unknown) =>
          toast.error(
            `이미지 추가 실패: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    },
    [selectedCategoryId],
  );

  const handleToggleFavorite = useCallback((id: string) => {
    log.debug("Toggling favorite", { imageId: id });
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (!img) return prev;
      window.image
        .setFavorite(parseInt(id), !img.isFavorite)
        .catch((e: unknown) => {
          toast.error(
            `즐겨찾기 설정 실패: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      return prev.map((i) =>
        i.id === id ? { ...i, isFavorite: !i.isFavorite } : i,
      );
    });
    setSelectedImage((prev) =>
      prev?.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev,
    );
  }, []);

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard
      .writeText(prompt)
      .catch(() => toast.error("클립보드 복사 실패"));
  }, []);

  const handleReveal = useCallback((path: string) => {
    window.image.revealInExplorer(path);
  }, []);

  const handleDeleteImage = useCallback((id: string) => {
    log.info("Deleting image requested", { imageId: id });
    setDeleteConfirmId(id);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirmId) return;
    const img = images.find((i) => i.id === deleteConfirmId);
    if (img) {
      window.image.delete(img.path).catch((e: unknown) => {
        toast.error(
          `이미지 삭제 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, images]);

  const handleCancelScan = useCallback(() => {
    setScanCancelConfirmOpen(true);
  }, []);

  const waitForScanToStop = useCallback(async (timeoutMs = 15000) => {
    const start = Date.now();
    while (scanningRef.current && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, []);

  const confirmCancelScan = useCallback(async () => {
    log.warn("Scan cancel requested");
    setScanCancelConfirmOpen(false);
    const rollbackTargetFolderIds = Array.from(rollbackFolderIds);
    await window.image.cancelScan().catch(() => {});
    await waitForScanToStop();

    if (rollbackTargetFolderIds.length > 0) {
      rollbackRequestSeqRef.current += 1;
      setFolderRollbackRequest({
        id: rollbackRequestSeqRef.current,
        folderIds: rollbackTargetFolderIds,
      });
      setRollbackFolderIds((prev) => {
        const next = new Set(prev);
        rollbackTargetFolderIds.forEach((folderId) => next.delete(folderId));
        return next;
      });
    }
  }, [rollbackFolderIds, waitForScanToStop]);

  const handleSendToGenerator = useCallback((image: ImageData) => {
    setPendingGeneratorImport(image);
    setActivePanel("generator");
  }, []);

  const handleChangeCategory = useCallback((image: ImageData) => {
    setBulkCategoryDialogImages(null);
    setCategoryDialogImage(image);
  }, []);

  const handleBulkChangeCategory = useCallback((targets: ImageData[]) => {
    if (targets.length === 0) return;
    setCategoryDialogImage(null);
    setBulkCategoryDialogImages(targets);
  }, []);

  const handleRandomRefresh = useCallback(() => {
    log.info("Random pick refreshed");
    setRandomSeed((seed) => seed + 1);
  }, []);

  const handleCategoryDialogClose = useCallback(() => {
    setCategoryDialogImage(null);
    setBulkCategoryDialogImages(null);
    if (selectedCategoryId !== null) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (!cat?.isBuiltin) {
        window.category
          .imageIds(selectedCategoryId)
          .then((ids) => setCategoryImageIds(new Set(ids)))
          .catch(() => {});
      }
    }
  }, [selectedCategoryId, categories]);

  const similarImages = useMemo(() => {
    if (!selectedImage) return [];
    const imageId = parseInt(selectedImage.id);
    const group = similarGroups.find((g) => g.imageIds.includes(imageId));
    if (!group) return [];
    return group.imageIds
      .map((id) => images.find((img) => img.id === String(id)))
      .filter(Boolean) as ImageData[];
  }, [selectedImage, similarGroups, images]);

  const selectedIndex = useMemo(
    () =>
      selectedImage
        ? filteredImages.findIndex((img) => img.id === selectedImage.id)
        : -1,
    [filteredImages, selectedImage],
  );

  const handlePrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedImage(filteredImages[selectedIndex - 1]);
  }, [filteredImages, selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex < filteredImages.length - 1)
      setSelectedImage(filteredImages[selectedIndex + 1]);
  }, [filteredImages, selectedIndex]);

  const handleImageClick = useCallback((image: ImageData) => {
    setSelectedImage(image);
    setIsDetailOpen(true);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col">
      <Toaster richColors position="bottom-right" />
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        scanning={scanning}
        isAnalyzing={isAnalyzing}
        hashProgress={hashProgress}
        scanProgress={scanProgress}
        scanningFolderNames={scanningFolderNames}
        onCancelScan={handleCancelScan}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        availableResolutions={availableResolutions}
        availableModels={availableModels}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* GenerationView - 항상 마운트, CSS로만 숨김 */}
        <div
          className={
            activePanel === "generator"
              ? "flex flex-1 overflow-hidden"
              : "hidden"
          }
        >
          <GenerationView
            pendingImport={pendingGeneratorImport}
            onClearPendingImport={() => setPendingGeneratorImport(null)}
            outputFolder={outputFolder}
          />
        </div>

        {/* 갤러리 영역 - 항상 마운트, CSS로만 숨김 */}
        <div
          className={
            activePanel !== "generator"
              ? "flex flex-1 overflow-hidden"
              : "hidden"
          }
        >
          <div
            className="relative flex-none h-full"
            style={{ width: sidebarWidth }}
          >
            <Sidebar
              rollbackRequest={folderRollbackRequest}
              activeView={activeView}
              onViewChange={setActiveView}
              selectedFolderIds={selectedFolderIds}
              onFolderToggle={handleFolderToggle}
              onFolderRemoved={handleFolderRemoved}
              onFolderAdded={handleFolderAdded}
              onFolderCancelled={handleFolderCancelled}
              scanningFolderIds={activeScanFolderIds}
              scanning={scanning}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategorySelect={handleCategorySelect}
              onCategoryCreate={handleCategoryCreate}
              onCategoryRename={handleCategoryRename}
              onCategoryDelete={handleCategoryDelete}
              onCategoryReorder={handleCategoryReorder}
              onCategoryAddByPrompt={handleCategoryAddByPrompt}
              onRandomRefresh={handleRandomRefresh}
              isAnalyzing={isAnalyzing}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
              onMouseDown={handleResizeStart}
            />
          </div>
          {activePanel === "settings" && (
            <SettingsView
              settings={settings}
              onUpdate={updateSettings}
              onReset={resetSettings}
              onClose={() => setActivePanel("gallery")}
              outputFolder={outputFolder}
              onOutputFolderChange={setOutputFolder}
              onResetOutputFolder={resetOutputFolder}
              onResetHashes={async () => {
                try {
                  await window.image.resetHashes();
                  scheduleAnalysis(0);
                } catch (e: unknown) {
                  toast.error(
                    `해시 초기화 실패: ${e instanceof Error ? e.message : String(e)}`,
                  );
                }
              }}
              isAnalyzing={isAnalyzing}
            />
          )}
          {/* ImageGallery - 항상 마운트, 설정 화면일 때만 숨김 */}
          <div
            className={
              activePanel === "settings"
                ? "hidden"
                : "flex flex-1 overflow-hidden"
            }
          >
            <ImageGallery
              images={filteredImages}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onToggleFavorite={handleToggleFavorite}
              onCopyPrompt={handleCopyPrompt}
              onImageClick={handleImageClick}
              onReveal={handleReveal}
              onDelete={handleDeleteImage}
              onChangeCategory={handleChangeCategory}
              onBulkChangeCategory={handleBulkChangeCategory}
              onSendToGenerator={handleSendToGenerator}
              totalCount={filteredImages.length}
              pageSize={settings.pageSize}
            />
          </div>
        </div>
      </div>

      <CategoryDialog
        image={categoryDialogImage}
        images={bulkCategoryDialogImages}
        categories={categories}
        onClose={handleCategoryDialogClose}
      />

      <Dialog
        open={scanCancelConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setScanCancelConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>스캔 취소</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            진행 중인 폴더 스캔을 취소할까요?
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">계속 스캔</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmCancelScan}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미지 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            정말로 이 이미지를 삭제할까요? 파일이 휴지통으로 이동됩니다.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">취소</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageDetail
        image={selectedImage}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onToggleFavorite={handleToggleFavorite}
        onCopyPrompt={handleCopyPrompt}
        prevImage={selectedIndex > 0 ? filteredImages[selectedIndex - 1] : null}
        nextImage={
          selectedIndex < filteredImages.length - 1
            ? filteredImages[selectedIndex + 1]
            : null
        }
        onPrev={handlePrev}
        onNext={handleNext}
        similarImages={similarImages}
        onSimilarImageClick={setSelectedImage}
        similarPageSize={settings.similarPageSize}
      />
    </div>
  );
}
