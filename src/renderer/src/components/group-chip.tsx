import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2, RotateCcw } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { GroupRefToken } from "@/lib/token";
import type { PromptGroup } from "@preload/index.d";

const POPOVER_WIDTH = 264;
const POPOVER_GAP = 6;
const POPOVER_EDGE_PADDING = 8;

interface SortableBindings {
  setNodeRef: (node: HTMLDivElement | null) => void;
  attributes: DraggableAttributes;
  listeners: ReturnType<typeof useSortable>["listeners"];
  style: CSSProperties;
  isDragging: boolean;
}

interface GroupChipProps {
  token: GroupRefToken;
  groups: PromptGroup[];
  isEditable?: boolean;
  readOnly?: boolean; // if true, disables all popups (preview + editor)
  onChange?: (token: GroupRefToken) => void;
  onDelete?: () => void;
  chipRef?: (node: HTMLDivElement | null) => void;
  onTokenFocus?: () => void;
  onTokenKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  isSortable?: boolean;
  sortableId?: string;
  sortableDisabled?: boolean;
}

function GroupChipCore({
  token,
  groups,
  isEditable = false,
  readOnly = false,
  onChange,
  onDelete,
  chipRef,
  onTokenFocus,
  onTokenKeyDown,
  sortable,
}: Omit<GroupChipProps, "isSortable" | "sortableId" | "sortableDisabled"> & {
  sortable?: SortableBindings;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const newTagInputRef = useRef<HTMLInputElement | null>(null);

  // "preview" = popup showing current expansion; "editor" = full edit popover; "delete" = delete confirm
  const [activePopup, setActivePopup] = useState<
    "preview" | "editor" | "delete" | null
  >(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  // Editor draft state
  const [draftName, setDraftName] = useState(token.groupName);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [newTagDraft, setNewTagDraft] = useState("");

  const group = groups.find((g) => g.name === token.groupName);
  const currentTags =
    token.overrideTags ?? group?.tokens.map((t) => t.label) ?? [];
  const hasOverride = token.overrideTags !== undefined;

  const openEditor = () => {
    const currentGroup = groups.find((g) => g.name === token.groupName);
    setDraftName(token.groupName);
    setDraftTags(
      token.overrideTags ?? currentGroup?.tokens.map((t) => t.label) ?? [],
    );
    setNewTagDraft("");
    setActivePopup("editor");
  };

  const handleApply = () => {
    const trimmedName = draftName.trim() || token.groupName;
    const targetGroup = groups.find((g) => g.name === trimmedName);
    const dbTags = targetGroup?.tokens.map((t) => t.label) ?? [];
    const tagsMatchDb =
      draftTags.length === dbTags.length &&
      draftTags.every((t, i) => t === dbTags[i]);

    onChange?.({
      kind: "group",
      groupName: trimmedName,
      ...(tagsMatchDb ? {} : { overrideTags: draftTags }),
    });
    setActivePopup(null);
  };

  const handleCancel = () => {
    setActivePopup(null);
  };

  const handleResetTags = () => {
    const targetGroup = groups.find((g) => g.name === draftName.trim());
    setDraftTags(targetGroup?.tokens.map((t) => t.label) ?? []);
  };

  const handleAddTag = () => {
    const tag = newTagDraft.trim();
    if (!tag) return;
    setDraftTags((prev) => [...prev, tag]);
    setNewTagDraft("");
    requestAnimationFrame(() => newTagInputRef.current?.focus());
  };

  const handleDeleteTag = (index: number) => {
    setDraftTags((prev) => prev.filter((_, i) => i !== index));
  };

  // Focus new tag input when editor opens
  useEffect(() => {
    if (activePopup !== "editor") return;
    const raf = window.requestAnimationFrame(() => {
      newTagInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activePopup]);

  // Position tracking + outside-click for both popups
  useEffect(() => {
    if (activePopup === null) return;

    const updatePosition = () => {
      const triggerNode = triggerRef.current;
      if (!triggerNode) return;
      const rect = triggerNode.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverHeight =
        popoverRef.current?.offsetHeight ??
        (activePopup === "editor" ? 300 : activePopup === "delete" ? 90 : 160);

      let left = rect.left;
      left = Math.max(POPOVER_EDGE_PADDING, left);
      left = Math.min(
        left,
        viewportWidth - POPOVER_WIDTH - POPOVER_EDGE_PADDING,
      );

      const spaceBelow = viewportHeight - rect.bottom - POPOVER_EDGE_PADDING;
      const spaceAbove = rect.top - POPOVER_EDGE_PADDING;
      const shouldOpenAbove =
        spaceBelow < popoverHeight && spaceAbove > spaceBelow;

      let top = shouldOpenAbove
        ? rect.top - popoverHeight - POPOVER_GAP
        : rect.bottom + POPOVER_GAP;
      top = Math.max(POPOVER_EDGE_PADDING, top);
      top = Math.min(
        top,
        viewportHeight - popoverHeight - POPOVER_EDGE_PADDING,
      );

      setPopoverStyle({
        position: "fixed",
        top,
        left,
        width: POPOVER_WIDTH,
        zIndex: 3000,
      });
    };

    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setActivePopup(null);
    };

    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [activePopup]);

  const setCombinedRef = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    sortable?.setNodeRef(node);
  };
  const setTriggerRef = (node: HTMLDivElement | null) => {
    triggerRef.current = node;
    chipRef?.(node);
  };

  const hiddenStyle: CSSProperties = {
    position: "fixed",
    top: POPOVER_EDGE_PADDING,
    left: POPOVER_EDGE_PADDING,
    width: POPOVER_WIDTH,
    zIndex: 3000,
    visibility: "hidden",
  };

  const chip = (
    <div
      ref={setCombinedRef}
      className={cn("relative inline-flex", sortable?.isDragging && "z-20")}
      style={sortable?.style}
    >
      <div
        ref={setTriggerRef}
        role="button"
        tabIndex={0}
        data-token-chip="true"
        data-token-raw={`@{${token.groupName}}`}
        onClick={() => {
          if (readOnly) return;
          if (activePopup === "editor") return;
          setActivePopup((prev) => (prev === "preview" ? null : "preview"));
        }}
        onDoubleClick={() => {
          if (readOnly) return;
          if (isEditable) openEditor();
        }}
        onContextMenu={(e) => {
          if (!onDelete) return;
          e.preventDefault();
          setActivePopup((prev) => (prev === "delete" ? null : "delete"));
        }}
        onFocus={onTokenFocus}
        onKeyDown={(e) => {
          onTokenKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (!readOnly && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setActivePopup((prev) => (prev === "preview" ? null : "preview"));
          }
        }}
        {...sortable?.attributes}
        {...(activePopup !== null ? {} : sortable?.listeners)}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-1 text-xs rounded border transition-colors cursor-pointer touch-none select-none",
          "bg-group/14 text-group border-group/35",
          "hover:brightness-105",
          sortable?.isDragging && "opacity-70",
          hasOverride && "ring-1 ring-group/40",
        )}
      >
        <span className="font-semibold text-group shrink-0">@</span>
        <span>{`{${token.groupName}}`}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 text-group/80" />
      </div>
    </div>
  );

  // Preview popup — shows current expansion
  const previewPopover = activePopup === "preview" && (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {token.groupName}
        </p>
        {hasOverride && (
          <span className="rounded bg-group/12 px-1.5 py-0.5 text-[9px] text-group/85">
            편집됨
          </span>
        )}
      </div>
      {currentTags.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">태그 없음</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {currentTags.map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[11px] rounded bg-muted text-foreground/80 border border-border/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {isEditable && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/40">
            Delete/Backspace로 제거
          </p>
          <button
            type="button"
            onClick={() => openEditor()}
            className="text-[10px] text-group hover:text-group/80 transition-colors"
          >
            편집
          </button>
        </div>
      )}
    </div>
  );

  // Editor popup — edit group name + tags (one-time, not persisted to DB)
  const editorPopover = activePopup === "editor" && (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Group Name */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Group Name
        </label>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
          }}
          className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60"
        />
      </div>

      {/* Tags */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tags
          </label>
          <button
            type="button"
            onClick={handleResetTags}
            title="그룹 원본 태그로 초기화"
            className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Tag list */}
        <div className="space-y-1 max-h-30 overflow-y-auto mb-1.5">
          {draftTags.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 text-center py-2">
              태그 없음
            </p>
          ) : (
            draftTags.map((tag, i) => (
              <div key={i} className="flex items-center gap-1.5 group/tag">
                <span className="flex-1 min-w-0 text-xs text-foreground/80 truncate px-1.5 py-0.5 rounded bg-muted border border-border/40">
                  {tag}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(i)}
                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add tag */}
        <div className="flex gap-1">
          <input
            ref={newTagInputRef}
            value={newTagDraft}
            onChange={(e) => setNewTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
              }
            }}
            placeholder="태그 추가..."
            className="flex-1 min-w-0 h-7 px-2 text-xs bg-background border border-border/60 rounded outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!newTagDraft.trim()}
            className="h-7 w-7 flex items-center justify-center rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Note */}
      <p className="text-[10px] text-muted-foreground/40 mb-2.5">
        변경사항은 이 칩에만 적용됩니다
      </p>

      {/* Footer */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={handleCancel}
          className="h-7 rounded border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="h-7 rounded border border-primary/50 bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>
    </div>
  );

  const deletePopover = activePopup === "delete" && (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-foreground/80 mb-2.5">
        <span className="font-medium text-group">
          @{`{${token.groupName}}`}
        </span>
        을 제거하시겠습니까?
      </p>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setActivePopup(null)}
          className="h-7 rounded border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePopup(null);
            onDelete?.();
          }}
          className="h-7 rounded border border-destructive/50 bg-destructive/10 px-2 text-[11px] text-destructive hover:bg-destructive/20 flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          삭제
        </button>
      </div>
    </div>
  );

  const popoverContent =
    activePopup === "preview"
      ? previewPopover
      : activePopup === "delete"
        ? deletePopover
        : editorPopover;

  const popover =
    activePopup !== null && typeof document !== "undefined"
      ? createPortal(popoverContent, document.body)
      : null;

  return (
    <>
      {chip}
      {popover}
    </>
  );
}

function SortableGroupChip({
  sortableId,
  sortableDisabled = false,
  ...props
}: Omit<GroupChipProps, "isSortable"> & { sortableId: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: sortableDisabled });

  return (
    <GroupChipCore
      {...props}
      sortable={{
        setNodeRef,
        attributes,
        listeners,
        style: { transform: CSS.Translate.toString(transform), transition },
        isDragging,
      }}
    />
  );
}

export function GroupChip({
  isSortable = false,
  sortableId,
  sortableDisabled = false,
  ...props
}: GroupChipProps) {
  if (isSortable && sortableId !== undefined) {
    return (
      <SortableGroupChip
        {...props}
        sortableId={sortableId}
        sortableDisabled={sortableDisabled}
      />
    );
  }
  return <GroupChipCore {...props} />;
}
