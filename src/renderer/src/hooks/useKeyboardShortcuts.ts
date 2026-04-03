import { useEffect } from "react";
import { matchesBinding, type Keybindings } from "@/lib/keybindings";
import type { ActivePanel } from "./useAppShellState";
import type { ImageData } from "@/components/image-card";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

function focusSearchInput() {
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  if (input) {
    input.focus();
    input.select();
  }
}

interface UseKeyboardShortcutsOptions {
  bindings: Keybindings;
  handlePanelChange: (panel: ActivePanel) => void;
  activePanel: ActivePanel;
  onGenerate: () => void;
  detail: {
    isOpen: boolean;
    image: ImageData | null | undefined;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
  };
  imageActions: {
    onToggleFavorite: (id: string) => void;
    onCopyPrompt: (prompt: string) => void;
    onDelete: (id: string) => void;
  };
  runScan: () => void;
  scanning: boolean;
  imageGalleryPagination: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  anyDialogOpen: boolean;
}

export function useKeyboardShortcuts({
  bindings,
  handlePanelChange,
  activePanel,
  onGenerate,
  detail,
  imageActions,
  runScan,
  scanning,
  imageGalleryPagination,
  anyDialogOpen,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);

      // 패널 전환 — 항상 동작
      if (matchesBinding(e, bindings["panel.generator"])) {
        e.preventDefault();
        handlePanelChange("generator");
        return;
      }
      if (matchesBinding(e, bindings["panel.gallery"])) {
        e.preventDefault();
        handlePanelChange("gallery");
        return;
      }
      if (matchesBinding(e, bindings["panel.tagSearch"])) {
        e.preventDefault();
        handlePanelChange("tagSearch");
        return;
      }
      if (matchesBinding(e, bindings["panel.settings"])) {
        e.preventDefault();
        handlePanelChange("settings");
        return;
      }

      // F5 — 생성 실행 (생성 패널에서 항상 동작)
      if (
        activePanel === "generator" &&
        matchesBinding(e, bindings["generator.generate"])
      ) {
        e.preventDefault();
        onGenerate();
        return;
      }

      // 이하는 editable 포커스 중이거나 다이얼로그 열림 시 무시
      if (editable || anyDialogOpen) return;

      // 검색창 포커스
      if (
        !detail.isOpen &&
        matchesBinding(e, bindings["gallery.focusSearch"])
      ) {
        e.preventDefault();
        focusSearchInput();
        return;
      }

      // 스캔
      if (!scanning && matchesBinding(e, bindings["gallery.scan"])) {
        e.preventDefault();
        runScan();
        return;
      }

      // 디테일 열려 있을 때
      if (detail.isOpen && detail.image) {
        if (matchesBinding(e, bindings["detail.close"])) {
          detail.onClose();
          return;
        }
        if (matchesBinding(e, bindings["detail.prev"])) {
          e.preventDefault();
          detail.onPrev();
          return;
        }
        if (matchesBinding(e, bindings["detail.next"])) {
          e.preventDefault();
          detail.onNext();
          return;
        }
        if (matchesBinding(e, bindings["detail.favorite"])) {
          imageActions.onToggleFavorite(detail.image.id);
          return;
        }
        if (matchesBinding(e, bindings["detail.copyPrompt"])) {
          if (detail.image.prompt)
            imageActions.onCopyPrompt(detail.image.prompt);
          return;
        }
        if (matchesBinding(e, bindings["detail.delete"])) {
          imageActions.onDelete(detail.image.id);
          return;
        }
        return;
      }

      // 페이지 이동 (갤러리)
      if (matchesBinding(e, bindings["gallery.prevPage"])) {
        if (imageGalleryPagination.page > 1) {
          e.preventDefault();
          imageGalleryPagination.onPageChange(imageGalleryPagination.page - 1);
        }
        return;
      }
      if (matchesBinding(e, bindings["gallery.nextPage"])) {
        if (imageGalleryPagination.page < imageGalleryPagination.totalPages) {
          e.preventDefault();
          imageGalleryPagination.onPageChange(imageGalleryPagination.page + 1);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    bindings,
    anyDialogOpen,
    detail,
    handlePanelChange,
    activePanel,
    onGenerate,
    imageActions,
    imageGalleryPagination,
    runScan,
    scanning,
  ]);
}
