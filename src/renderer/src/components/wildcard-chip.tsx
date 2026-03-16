import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Dices, Plus, Trash2 } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { WildcardToken } from "@/lib/token";

const POPOVER_WIDTH = 240;
const POPOVER_GAP = 6;
const POPOVER_EDGE_PADDING = 8;

interface SortableBindings {
  setNodeRef: (node: HTMLDivElement | null) => void;
  attributes: DraggableAttributes;
  listeners: ReturnType<typeof useSortable>["listeners"];
  style: CSSProperties;
  isDragging: boolean;
}

interface WildcardChipProps {
  token: WildcardToken;
  onChange?: (token: WildcardToken) => void;
  onDelete?: () => void;
  chipRef?: (node: HTMLDivElement | null) => void;
  onTokenFocus?: () => void;
  onTokenKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  isSortable?: boolean;
  sortableId?: string;
  sortableDisabled?: boolean;
}

function WildcardChipCore({
  token,
  onChange,
  onDelete,
  chipRef,
  onTokenFocus,
  onTokenKeyDown,
  sortable,
}: Omit<WildcardChipProps, "isSortable" | "sortableId" | "sortableDisabled"> & {
  sortable?: SortableBindings;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const newOptionInputRef = useRef<HTMLInputElement | null>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [newOptionDraft, setNewOptionDraft] = useState("");

  const previewText =
    token.options.length > 0
      ? token.options.join("|")
      : "옵션 없음";

  const openPopover = () => {
    setDraftOptions([...token.options]);
    setNewOptionDraft("");
    setPopoverOpen(true);
  };

  const handleApply = () => {
    onChange?.({ ...token, options: draftOptions.filter((o) => o.trim()) });
    setPopoverOpen(false);
  };

  const handleCancel = () => {
    setPopoverOpen(false);
  };

  const handleAddOption = () => {
    const opt = newOptionDraft.trim();
    if (!opt) return;
    setDraftOptions((prev) => [...prev, opt]);
    setNewOptionDraft("");
    requestAnimationFrame(() => newOptionInputRef.current?.focus());
  };

  const handleDeleteOption = (index: number) => {
    setDraftOptions((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!popoverOpen) return;
    const raf = window.requestAnimationFrame(() => {
      newOptionInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;

    const updatePosition = () => {
      const triggerNode = triggerRef.current;
      if (!triggerNode) return;
      const rect = triggerNode.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 240;

      let left = rect.left;
      left = Math.max(POPOVER_EDGE_PADDING, left);
      left = Math.min(left, viewportWidth - POPOVER_WIDTH - POPOVER_EDGE_PADDING);

      const spaceBelow = viewportHeight - rect.bottom - POPOVER_EDGE_PADDING;
      const spaceAbove = rect.top - POPOVER_EDGE_PADDING;
      const shouldOpenAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

      let top = shouldOpenAbove
        ? rect.top - popoverHeight - POPOVER_GAP
        : rect.bottom + POPOVER_GAP;
      top = Math.max(POPOVER_EDGE_PADDING, top);
      top = Math.min(top, viewportHeight - popoverHeight - POPOVER_EDGE_PADDING);

      setPopoverStyle({ position: "fixed", top, left, width: POPOVER_WIDTH, zIndex: 3000 });
    };

    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setPopoverOpen(false);
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
  }, [popoverOpen]);

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
        data-token-raw={`%{${token.options.join("|")}}`}
        onClick={() => {
          if (popoverOpen) return;
          openPopover();
        }}
        onFocus={onTokenFocus}
        onKeyDown={(e) => {
          onTokenKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPopover();
          }
        }}
        {...sortable?.attributes}
        {...(!popoverOpen ? sortable?.listeners : {})}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-1 text-xs rounded border transition-colors cursor-pointer touch-none select-none",
          "bg-amber-100 text-amber-800 border-amber-300/60",
          "dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30",
          "hover:brightness-105",
          sortable?.isDragging && "opacity-70",
        )}
      >
        <Dices className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
        <span
          className={cn(
            "max-w-[120px] truncate",
            token.resolved ? "text-amber-700 dark:text-amber-200 font-medium" : "text-amber-700/70 dark:text-amber-400/70",
          )}
        >
          {token.resolved ?? previewText}
        </span>
      </div>
    </div>
  );

  const popover = popoverOpen && (
    <div
      ref={popoverRef}
      style={popoverStyle ?? hiddenStyle}
      className="rounded-md border border-border bg-popover p-2.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        와일드카드 옵션
      </p>

      {/* Option list */}
      <div className="space-y-1 max-h-36 overflow-y-auto mb-2">
        {draftOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 text-center py-2">옵션 없음</p>
        ) : (
          draftOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5 group/opt">
              <span className="flex-1 min-w-0 text-xs text-foreground/80 truncate px-1.5 py-0.5 rounded bg-muted border border-border/40">
                {opt}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteOption(i)}
                className="opacity-0 group-hover/opt:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add option */}
      <div className="flex gap-1 mb-2.5">
        <input
          ref={newOptionInputRef}
          value={newOptionDraft}
          onChange={(e) => setNewOptionDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddOption();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
          }}
          placeholder="옵션 추가..."
          className="flex-1 min-w-0 h-7 px-2 text-xs bg-background border border-border/60 rounded outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground/40"
        />
        <button
          type="button"
          onClick={handleAddOption}
          disabled={!newOptionDraft.trim()}
          className="h-7 w-7 flex items-center justify-center rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {token.resolved && (
        <p className="text-[10px] text-amber-500/80 mb-2">
          마지막 선택: <span className="font-medium">{token.resolved}</span>
        </p>
      )}

      <div className="flex items-center justify-between">
        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              onDelete();
            }}
            className="h-7 rounded border border-destructive/40 px-2 text-[11px] text-destructive/80 hover:bg-destructive/10 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
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
    </div>
  );

  return (
    <>
      {chip}
      {popoverOpen && typeof document !== "undefined"
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}

function SortableWildcardChip({
  sortableId,
  sortableDisabled = false,
  ...props
}: Omit<WildcardChipProps, "isSortable"> & { sortableId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId, disabled: sortableDisabled });

  return (
    <WildcardChipCore
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

export function WildcardChip({
  isSortable = false,
  sortableId,
  sortableDisabled = false,
  ...props
}: WildcardChipProps) {
  if (isSortable && sortableId !== undefined) {
    return (
      <SortableWildcardChip
        {...props}
        sortableId={sortableId}
        sortableDisabled={sortableDisabled}
      />
    );
  }
  return <WildcardChipCore {...props} />;
}
