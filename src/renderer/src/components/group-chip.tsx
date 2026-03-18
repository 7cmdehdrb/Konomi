import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
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
  readOnly?: boolean;
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
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const newTagInputRef = useRef<HTMLInputElement | null>(null);

  const [activePopup, setActivePopup] = useState<
    "preview" | "editor" | "delete" | null
  >(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [draftName, setDraftName] = useState(token.groupName);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [newTagDraft, setNewTagDraft] = useState("");

  const group = groups.find((item) => item.name === token.groupName);
  const currentTags =
    token.overrideTags ?? group?.tokens.map((item) => item.label) ?? [];
  const hasOverride = token.overrideTags !== undefined;

  const openEditor = () => {
    const currentGroup = groups.find((item) => item.name === token.groupName);
    setDraftName(token.groupName);
    setDraftTags(
      token.overrideTags ?? currentGroup?.tokens.map((item) => item.label) ?? [],
    );
    setNewTagDraft("");
    setActivePopup("editor");
  };

  const handleApply = () => {
    const trimmedName = draftName.trim() || token.groupName;
    const targetGroup = groups.find((item) => item.name === trimmedName);
    const dbTags = targetGroup?.tokens.map((item) => item.label) ?? [];
    const tagsMatchDb =
      draftTags.length === dbTags.length &&
      draftTags.every((tag, index) => tag === dbTags[index]);

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
    const targetGroup = groups.find((item) => item.name === draftName.trim());
    setDraftTags(targetGroup?.tokens.map((item) => item.label) ?? []);
  };

  const handleAddTag = () => {
    const tag = newTagDraft.trim();
    if (!tag) return;
    setDraftTags((previous) => [...previous, tag]);
    setNewTagDraft("");
    requestAnimationFrame(() => newTagInputRef.current?.focus());
  };

  const handleDeleteTag = (index: number) => {
    setDraftTags((previous) => previous.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (activePopup !== "editor") return;
    const raf = window.requestAnimationFrame(() => {
      newTagInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activePopup]);

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

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (popoverRef.current?.contains(event.target as Node)) return;
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
          setActivePopup((previous) => (previous === "preview" ? null : "preview"));
        }}
        onDoubleClick={() => {
          if (readOnly) return;
          if (isEditable) openEditor();
        }}
        onContextMenu={(e) => {
          if (!onDelete) return;
          e.preventDefault();
          setActivePopup((previous) => (previous === "delete" ? null : "delete"));
        }}
        onFocus={onTokenFocus}
        onKeyDown={(e) => {
          onTokenKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (!readOnly && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setActivePopup((previous) => (previous === "preview" ? null : "preview"));
          }
        }}
        {...sortable?.attributes}
        {...(activePopup !== null ? {} : sortable?.listeners)}
        className={cn(
          "inline-flex cursor-pointer touch-none select-none items-center gap-1 rounded border px-1.5 py-1 text-xs transition-colors",
          "border-group/35 bg-group/14 text-group",
          "hover:brightness-105",
          sortable?.isDragging && "opacity-70",
          hasOverride && "ring-1 ring-group/40",
        )}
      >
        <span className="shrink-0 font-semibold text-group">@</span>
        <span>{`{${token.groupName}}`}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 text-group/80" />
      </div>
    </div>
  );

  const previewPopover = activePopup === "preview" ? (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {token.groupName}
        </p>
        {hasOverride ? (
          <span className="rounded bg-group/12 px-1.5 py-0.5 text-[9px] text-group/85">
            {t("groupChip.edited")}
          </span>
        ) : null}
      </div>
      {currentTags.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/60">
          {t("groupChip.noTags")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {currentTags.map((tag, index) => (
            <span
              key={index}
              className="rounded border border-border/40 bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {isEditable ? (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/40">
            {t("groupChip.deleteHint")}
          </p>
          <button
            type="button"
            onClick={() => openEditor()}
            className="text-[10px] text-group transition-colors hover:text-group/80"
          >
            {t("groupChip.edit")}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  const editorPopover = activePopup === "editor" ? (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3">
        <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("groupChip.groupName")}
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

      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("groupChip.tags")}
          </label>
          <button
            type="button"
            onClick={handleResetTags}
            title={t("groupChip.resetTags")}
            aria-label={t("groupChip.resetTags")}
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </button>
        </div>

        <div className="mb-1.5 max-h-30 space-y-1 overflow-y-auto">
          {draftTags.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground/40">
              {t("groupChip.noTags")}
            </p>
          ) : (
            draftTags.map((tag, index) => (
              <div key={index} className="group/tag flex items-center gap-1.5">
                <span className="flex-1 min-w-0 truncate rounded border border-border/40 bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                  {tag}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(index)}
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/tag:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

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
            placeholder={t("groupChip.addTagPlaceholder")}
            className="flex-1 min-w-0 h-7 rounded border border-border/60 bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60 placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!newTagDraft.trim()}
            title={t("promptGroupPanel.addTag")}
            aria-label={t("promptGroupPanel.addTag")}
            className="flex h-7 w-7 items-center justify-center rounded border border-primary/30 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="mb-2.5 text-[10px] text-muted-foreground/40">
        {t("groupChip.note")}
      </p>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={handleCancel}
          className="h-7 rounded border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="h-7 rounded border border-primary/50 bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/20"
        >
          {t("groupChip.apply")}
        </button>
      </div>
    </div>
  ) : null;

  const deletePopover = activePopup === "delete" ? (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2.5 text-xs text-foreground/80">
        {t("groupChip.deleteConfirm", {
          name: `@{${token.groupName}}`,
        })}
      </p>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setActivePopup(null)}
          className="h-7 rounded border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePopup(null);
            onDelete?.();
          }}
          className="flex h-7 items-center gap-1 rounded border border-destructive/50 bg-destructive/10 px-2 text-[11px] text-destructive hover:bg-destructive/20"
        >
          <Trash2 className="h-3 w-3" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  ) : null;

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
