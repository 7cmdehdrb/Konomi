import { useCallback, useMemo, useState } from "react";

export type Subfolder = {
  path: string;
  name: string;
  folderId: number;
};

export type SubfolderFilter = {
  folderId: number;
  selectedPaths: string[];
  allPaths: string[];
};

const VISIBILITY_KEY = "konomi-subfolder-visibility";

function readDeselected(): Map<number, Set<string>> {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const map = new Map<number, Set<string>>();
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) map.set(Number(k), new Set(v));
    }
    return map;
  } catch {
    return new Map();
  }
}

function writeDeselected(map: Map<number, Set<string>>): void {
  try {
    const obj: Record<string, string[]> = {};
    for (const [k, v] of map) {
      if (v.size > 0) obj[String(k)] = [...v];
    }
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export function useSubfolderState() {
  const [subfoldersByFolder, setSubfoldersByFolder] = useState<
    Map<number, Subfolder[]>
  >(new Map());
  const [deselected, setDeselected] = useState<Map<number, Set<string>>>(() =>
    readDeselected(),
  );

  const loadSubfolders = useCallback(async (folderId: number) => {
    const paths = await window.folder.listSubdirectories(folderId);
    setSubfoldersByFolder((prev) => {
      const next = new Map(prev);
      next.set(
        folderId,
        paths.map((p) => ({
          path: p,
          name: p.replace(/\\/g, "/").split("/").pop() ?? p,
          folderId,
        })),
      );
      return next;
    });
  }, []);

  const refreshSubfolders = useCallback(
    async (folderIds: number[]) => {
      for (const id of folderIds) {
        await loadSubfolders(id);
      }
    },
    [loadSubfolders],
  );

  const isSubfolderVisible = useCallback(
    (subfolderPath: string, folderId: number) => {
      return !(deselected.get(folderId)?.has(subfolderPath) ?? false);
    },
    [deselected],
  );

  const toggleSubfolder = useCallback(
    (subfolderPath: string, folderId: number) => {
      setDeselected((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(folderId));
        if (set.has(subfolderPath)) set.delete(subfolderPath);
        else set.add(subfolderPath);
        if (set.size === 0) next.delete(folderId);
        else next.set(folderId, set);
        writeDeselected(next);
        return next;
      });
    },
    [],
  );

  // Called when parent folder visibility is toggled (cascade)
  const setFolderSubfoldersVisible = useCallback(
    (folderId: number, visible: boolean) => {
      setDeselected((prev) => {
        const next = new Map(prev);
        if (visible) {
          next.delete(folderId);
        } else {
          const allPaths = subfoldersByFolder.get(folderId)?.map((s) => s.path);
          if (allPaths && allPaths.length > 0) {
            next.set(folderId, new Set(allPaths));
          }
        }
        writeDeselected(next);
        return next;
      });
    },
    [subfoldersByFolder],
  );

  const clearFolderSubfolders = useCallback((folderId: number) => {
    setSubfoldersByFolder((prev) => {
      const next = new Map(prev);
      next.delete(folderId);
      return next;
    });
    setDeselected((prev) => {
      if (!prev.has(folderId)) return prev;
      const next = new Map(prev);
      next.delete(folderId);
      writeDeselected(next);
      return next;
    });
  }, []);

  const subfolderFilters = useMemo<SubfolderFilter[]>(() => {
    const filters: SubfolderFilter[] = [];
    for (const [folderId, deselectedPaths] of deselected) {
      if (deselectedPaths.size === 0) continue;
      const allSubfolders = subfoldersByFolder.get(folderId) ?? [];
      if (allSubfolders.length === 0) continue;
      const allPaths = allSubfolders.map((s) => s.path);
      const selectedPaths = allPaths.filter((p) => !deselectedPaths.has(p));
      filters.push({ folderId, selectedPaths, allPaths });
    }
    return filters;
  }, [deselected, subfoldersByFolder]);

  return {
    subfoldersByFolder,
    isSubfolderVisible,
    toggleSubfolder,
    setFolderSubfoldersVisible,
    clearFolderSubfolders,
    refreshSubfolders,
    loadSubfolders,
    subfolderFilters,
  };
}
