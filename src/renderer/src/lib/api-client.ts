import { io } from "socket.io-client";

const isWebMode = !window.appInfo;

let socket: ReturnType<typeof io> | null = null;

if (isWebMode) {
  // Web 모드 마커 설정 - 다른 모듈이 참조 가능
  (window as any).__konomiWebMode = true;

  socket = io();

  const request = async (type: string, payload?: any) => {
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown API error" }));
      throw new Error(err.error || res.statusText);
    }
    const data = await res.json();
    return data.result;
  };

  const createOnListener = (event: string) => (cb: (data: any) => void) => {
    if (!socket) return () => {};
    socket.on(event, cb);
    return () => socket!.off(event, cb);
  };

  // Mock window objects
  window.appInfo = {
    isDevMode: () => Promise.resolve(import.meta.env.DEV),
    get: () => Promise.resolve({
      appName: "Konomi Web",
      appVersion: "web",
      electronVersion: "web",
      chromeVersion: "web",
      nodeVersion: "web",
      platform: "web",
      arch: "web",
    }),
    getLocale: () => Promise.resolve(navigator.language),
    getDbFileSize: () => Promise.resolve(0),
    getPromptsDbSchemaVersion: () => Promise.resolve(1),
    checkForUpdates: () => Promise.resolve(undefined as void),
    installUpdate: () => Promise.resolve(),
    onUpdateAvailable: () => () => {},
    onUpdateDownloaded: () => () => {},
    onUpdateProgress: () => () => {},
    onUtilityReset: createOnListener("utility:reset"),
    clearResourceCache: () => {},
  };

  window.image = {
    readNaiMeta: (path: string) => request("readNaiMeta", path),
    readMetaFromBuffer: (_: Uint8Array) => Promise.resolve(null),
    readFile: (path: string) => request("image:readFile", path),
    getSearchPresetStats: () => request("image:getSearchPresetStats"),
    suggestTags: (query: any) => request("image:suggestTags", query),
    listPage: (query: any) => request("image:listPage", query),
    listMatchingIds: (query: any) => request("image:listMatchingIds", query),
    bulkDelete: (ids: number[]) => request("image:bulkDelete", ids),
    listByIds: (ids: number[]) => request("image:listByIds", { ids }),
    quickVerify: () => request("image:quickVerify"),
    scan: (options?: any) => request("image:scan", options),
    setFavorite: (id: number, isFavorite: boolean) => request("image:setFavorite", { id, isFavorite }),
    watch: () => request("image:watch"),
    listIgnoredDuplicates: () => request("image:listIgnoredDuplicates"),
    clearIgnoredDuplicates: () => request("image:clearIgnoredDuplicates"),
    onBatch: createOnListener("image:batch"),
    onRemoved: createOnListener("image:removed"),
    onWatchDuplicate: createOnListener("image:watchDuplicate"),
    revealInExplorer: (path: string) => request("image:revealInExplorer", path),
    delete: (path: string) => request("image:delete", path),
    computeHashes: () => request("image:computeHashes"),
    resetHashes: () => request("image:resetHashes"),
    rescanMetadata: () => request("image:rescanMetadata"),
    rescanImageMetadata: (paths: string[]) => request("image:rescanImageMetadata", paths),
    similarGroups: (threshold: number, jaccardThreshold?: number) => request("image:similarGroups", { threshold, jaccardThreshold }),
    similarGroupForImage: (imageId: number) => request("image:similarGroupForImage", { imageId }),
    similarReasons: (
      imageId: number,
      candidateImageIds: number[],
      threshold: number,
      jaccardThreshold?: number,
    ) => request("image:similarReasons", { imageId, candidateImageIds, threshold, jaccardThreshold }),
    onHashProgress: createOnListener("image:hashProgress"),
    onSimilarityProgress: createOnListener("image:similarityProgress"),
    onScanProgress: createOnListener("image:scanProgress"),
    onScanPhase: createOnListener("image:scanPhase"),
    onDupCheckProgress: createOnListener("image:dupCheckProgress"),
    onSearchStatsProgress: createOnListener("image:searchStatsProgress"),
    onRescanMetadataProgress: createOnListener("image:rescanMetadataProgress"),
    cancelScan: () => request("image:cancelScan"),
    onScanFolder: createOnListener("image:scanFolder"),
  };

  window.db = {
    runMigrations: () => request("db:runMigrations"),
    onMigrationProgress: createOnListener("db:migrationProgress"),
  };

  window.dialog = {
    selectDirectory: () => Promise.resolve(prompt("Enter directory absolute path:")),
    selectDirectories: async () => {
      const p = prompt("Enter directory absolute paths (comma separated):");
      return p ? p.split(",").map(s => s.trim()) : null;
    },
  };

  window.promptBuilder = {
    listCategories: () => request("prompt:listCategories"),
    suggestTags: (query: any) => request("prompt:suggestTags", query),
    createCategory: (name: string) => request("prompt:createCategory", { name }),
    renameCategory: (id: number, name: string) => request("prompt:renameCategory", { id, name }),
    deleteCategory: (id: number) => request("prompt:deleteCategory", { id }),
    resetCategories: () => request("prompt:resetCategories"),
    createGroup: (categoryId: number, name: string) => request("prompt:createGroup", { categoryId, name }),
    deleteGroup: (id: number) => request("prompt:deleteGroup", { id }),
    renameGroup: (id: number, name: string) => request("prompt:renameGroup", { id, name }),
    createToken: (groupId: number, label: string) => request("prompt:createToken", { groupId, label }),
    deleteToken: (id: number) => request("prompt:deleteToken", { id }),
    reorderGroups: (categoryId: number, ids: number[]) => request("prompt:reorderGroups", { categoryId, ids }),
    reorderTokens: (groupId: number, ids: number[]) => request("prompt:reorderTokens", { groupId, ids }),
    searchTags: (query: any) => request("prompt:searchTags", query),
  };

  window.category = {
    list: () => request("category:list"),
    create: (name: string) => request("category:create", { name }),
    delete: (id: number) => request("category:delete", { id }),
    rename: (id: number, name: string) => request("category:rename", { id, name }),
    addImage: (imageId: number, categoryId: number) => request("category:addImage", { imageId, categoryId }),
    removeImage: (imageId: number, categoryId: number) => request("category:removeImage", { imageId, categoryId }),
    addImages: (imageIds: number[], categoryId: number) => request("category:addImages", { imageIds, categoryId }),
    removeImages: (imageIds: number[], categoryId: number) => request("category:removeImages", { imageIds, categoryId }),
    addByPrompt: (categoryId: number, query: string) => request("category:addByPrompt", { categoryId, query }),
    imageIds: (categoryId: number) => request("category:imageIds", { categoryId }),
    forImage: (imageId: number) => request("category:forImage", { imageId }),
    commonForImages: (imageIds: number[]) => request("category:commonForImages", { imageIds }),
    setColor: (id: number, color: string | null) => request("category:setColor", { id, color }),
  };

  window.nai = {
    validateApiKey: (apiKey: string) => request("nai:validateApiKey", apiKey),
    getSubscription: () => request("nai:getSubscription"),
    getConfig: () => request("nai:getConfig"),
    updateConfig: (patch: object) => request("nai:updateConfig", patch),
    generate: (params: object) => request("nai:generate", params),
    onGeneratePreview: createOnListener("nai:generatePreview"),
  };

  window.folder = {
    list: () => request("folder:list"),
    create: (name: string, path: string) => request("folder:create", { name, path }),
    findDuplicates: (path: string) => request("folder:findDuplicates", { path }),
    resolveDuplicates: (resolutions: any) => request("folder:resolveDuplicates", { resolutions }),
    delete: (id: number) => request("folder:delete", { id }),
    rename: (id: number, name: string) => request("folder:rename", { id, name }),
    revealInExplorer: (idOrPath: number | string) => request("folder:revealInExplorer", idOrPath),
    listSubdirectories: (id: number) => request("folder:listSubdirectories", { id }),
    listSubdirectoriesByPath: (folderPath: string) => request("folder:listSubdirectoriesByPath", folderPath),
  };
}

export const isWeb = isWebMode;
