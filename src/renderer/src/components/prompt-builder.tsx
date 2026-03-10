import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Plus,
  Trash2,
  X,
  Wand2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
type PromptToken = {
  id: number;
  label: string;
  order: number;
  groupId: number;
};
type PromptGroup = {
  id: number;
  name: string;
  type: string;
  order: number;
  tokens: PromptToken[];
};

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Sortable Token Chip ──────────────────────────────────────────────────────

function SortableToken({
  token,
  selected,
  onToggle,
  onDelete,
}: {
  token: PromptToken;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: token.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/token relative", isDragging && "z-50 opacity-75")}
    >
      <button
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all select-none",
          selected
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-secondary text-secondary-foreground border-border hover:border-primary/60 hover:text-foreground",
        )}
        onClick={onToggle}
      >
        <span
          className="cursor-grab active:cursor-grabbing touch-none opacity-40 hover:opacity-80"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </span>
        {token.label}
      </button>
      <button
        className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground hidden group-hover/token:flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <X className="h-2 w-2" />
      </button>
    </div>
  );
}

// ── Sortable Group ───────────────────────────────────────────────────────────

function SortableGroup({
  group,
  selectedSequence,
  onToggleToken,
  onDeleteToken,
  onDeleteGroup,
  onRenameGroup,
  onAddToken,
  onReorderTokens,
}: {
  group: PromptGroup;
  selectedSequence: number[];
  onToggleToken: (tokenId: number) => void;
  onDeleteToken: (groupId: number, tokenId: number) => void;
  onDeleteGroup: (id: number) => void;
  onRenameGroup: (id: number, name: string) => void;
  onAddToken: (groupId: number, label: string) => void;
  onReorderTokens: (groupId: number, newOrder: PromptToken[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(group.name);
  const [addingToken, setAddingToken] = useState(false);
  const newTokenRef = useRef("");
  const tokenSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleTokenDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = group.tokens.findIndex((t) => t.id === active.id);
    const newIdx = group.tokens.findIndex((t) => t.id === over.id);
    onReorderTokens(group.id, arrayMove(group.tokens, oldIdx, newIdx));
  };

  const commitName = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== group.name) onRenameGroup(group.id, trimmed);
    else setNameVal(group.name);
    setEditingName(false);
  };

  const commitToken = () => {
    const label = newTokenRef.current.trim();
    newTokenRef.current = "";
    setAddingToken(false);
    if (label) onAddToken(group.id, label);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border border-border rounded-lg overflow-hidden",
        isDragging && "opacity-60 z-50",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        {editingName ? (
          <input
            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-primary outline-none text-foreground"
            value={nameVal}
            autoFocus
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setNameVal(group.name);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-foreground cursor-text select-none truncate"
            onClick={() => setEditingName(true)}
          >
            {group.name}
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {group.tokens.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDeleteGroup(group.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="p-3 flex flex-wrap gap-2">
        <DndContext
          sensors={tokenSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleTokenDragEnd}
        >
          <SortableContext
            items={group.tokens.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {group.tokens.map((token) => (
              <SortableToken
                key={token.id}
                token={token}
                selected={selectedSequence.includes(token.id)}
                onToggle={() => onToggleToken(token.id)}
                onDelete={() => onDeleteToken(group.id, token.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {addingToken ? (
          <input
            className="px-3 py-1 rounded-full text-xs border border-primary bg-transparent outline-none text-foreground w-28"
            placeholder="토큰 입력..."
            autoFocus
            onChange={(e) => {
              newTokenRef.current = e.target.value;
            }}
            onBlur={commitToken}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitToken();
              if (e.key === "Escape") {
                newTokenRef.current = "";
                setAddingToken(false);
              }
            }}
          />
        ) : (
          <button
            className="px-3 py-1 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
            onClick={() => {
              newTokenRef.current = "";
              setAddingToken(true);
            }}
          >
            <Plus className="h-3 w-3" />
            추가
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sortable Group List ──────────────────────────────────────────────────────

function GroupList({
  type,
  groups,
  selectedSequence,
  onToggleToken,
  onDeleteToken,
  onDeleteGroup,
  onRenameGroup,
  onAddToken,
  onReorderGroups,
  onReorderTokens,
}: {
  type: string;
  groups: PromptGroup[];
  selectedSequence: number[];
  onToggleToken: (tokenId: number) => void;
  onDeleteToken: (groupId: number, tokenId: number) => void;
  onDeleteGroup: (id: number) => void;
  onRenameGroup: (id: number, name: string) => void;
  onAddToken: (groupId: number, label: string) => void;
  onReorderGroups: (type: string, newOrder: PromptGroup[]) => void;
  onReorderTokens: (groupId: number, newOrder: PromptToken[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.id === active.id);
    const newIdx = groups.findIndex((g) => g.id === over.id);
    onReorderGroups(type, arrayMove(groups, oldIdx, newIdx));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleGroupDragEnd}
    >
      <SortableContext
        items={groups.map((g) => g.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {groups.map((group) => (
            <SortableGroup
              key={group.id}
              group={group}
              selectedSequence={selectedSequence}
              onToggleToken={onToggleToken}
              onDeleteToken={onDeleteToken}
              onDeleteGroup={onDeleteGroup}
              onRenameGroup={onRenameGroup}
              onAddToken={onAddToken}
              onReorderTokens={onReorderTokens}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PromptBuilder() {
  const [groups, setGroups] = useState<PromptGroup[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<number[]>([]);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    window.promptBuilder.listGroups().then(setGroups);
  }, []);

  const baseGroups = useMemo(
    () => groups.filter((g) => g.type === "base"),
    [groups],
  );
  const charGroups = useMemo(
    () => groups.filter((g) => g.type === "character"),
    [groups],
  );

  const buildPrompt = useCallback(
    (sectionGroups: PromptGroup[]) => {
      const labelMap = new Map<number, string>();
      for (const g of sectionGroups)
        for (const t of g.tokens) labelMap.set(t.id, t.label);
      return selectedSequence
        .filter((id) => labelMap.has(id))
        .map((id) => labelMap.get(id)!)
        .join(", ");
    },
    [selectedSequence],
  );

  const basePrompt = useMemo(
    () => buildPrompt(baseGroups),
    [buildPrompt, baseGroups],
  );
  const charPrompt = useMemo(
    () => buildPrompt(charGroups),
    [buildPrompt, charGroups],
  );

  const toggleToken = useCallback((tokenId: number) => {
    setSelectedSequence((prev) =>
      prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : [...prev, tokenId],
    );
  }, []);

  const handleDeleteToken = useCallback(
    async (groupId: number, tokenId: number) => {
      await window.promptBuilder.deleteToken(tokenId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, tokens: g.tokens.filter((t) => t.id !== tokenId) }
            : g,
        ),
      );
      setSelectedSequence((prev) => prev.filter((id) => id !== tokenId));
    },
    [],
  );

  const handleDeleteGroup = useCallback(
    async (id: number) => {
      const group = groups.find((g) => g.id === id);
      await window.promptBuilder.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (group)
        setSelectedSequence((prev) =>
          prev.filter((sid) => !group.tokens.some((t) => t.id === sid)),
        );
    },
    [groups],
  );

  const handleRenameGroup = useCallback(async (id: number, name: string) => {
    await window.promptBuilder.renameGroup(id, name);
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
  }, []);

  const handleAddToken = useCallback(async (groupId: number, label: string) => {
    const token = await window.promptBuilder.createToken(groupId, label);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, tokens: [...g.tokens, token] } : g,
      ),
    );
  }, []);

  const handleAddGroup = useCallback(async (type: string) => {
    const name = type === "base" ? "새 그룹" : "새 캐릭터 그룹";
    const group = await window.promptBuilder.createGroup(name, type);
    setGroups((prev) => [...prev, group]);
  }, []);

  const handleReorderGroups = useCallback(
    async (type: string, newOrder: PromptGroup[]) => {
      setGroups((prev) => [
        ...prev.filter((g) => g.type !== type),
        ...newOrder,
      ]);
      await window.promptBuilder.reorderGroups(newOrder.map((g) => g.id));
    },
    [],
  );

  const handleReorderTokens = useCallback(
    async (groupId: number, newOrder: PromptToken[]) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, tokens: newOrder } : g)),
      );
      await window.promptBuilder.reorderTokens(
        groupId,
        newOrder.map((t) => t.id),
      );
    },
    [],
  );

  const handleCopy = useCallback((type: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }, []);

  const sharedProps = {
    selectedSequence,
    onToggleToken: toggleToken,
    onDeleteToken: handleDeleteToken,
    onDeleteGroup: handleDeleteGroup,
    onRenameGroup: handleRenameGroup,
    onAddToken: handleAddToken,
    onReorderGroups: handleReorderGroups,
    onReorderTokens: handleReorderTokens,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            프롬프트 빌더
          </span>
          {selectedSequence.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({selectedSequence.length}개 선택)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setSelectedSequence([])}
          disabled={selectedSequence.length === 0}
        >
          초기화
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-6">
          {/* Base Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                베이스 프롬프트
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => handleAddGroup("base")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  그룹
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleCopy("base", basePrompt)}
                  disabled={!basePrompt}
                >
                  {copiedType === "base" ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      복사
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-secondary font-mono text-xs text-foreground leading-relaxed min-h-8 break-all">
              {basePrompt || (
                <span className="text-muted-foreground">
                  토큰을 선택하면 생성됩니다
                </span>
              )}
            </div>
            <GroupList type="base" groups={baseGroups} {...sharedProps} />
          </div>

          <div className="border-t border-border" />

          {/* Character Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                캐릭터 프롬프트
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => handleAddGroup("character")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  그룹
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleCopy("character", charPrompt)}
                  disabled={!charPrompt}
                >
                  {copiedType === "character" ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      복사
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-secondary font-mono text-xs text-foreground leading-relaxed min-h-8 break-all">
              {charPrompt || (
                <span className="text-muted-foreground">
                  토큰을 선택하면 생성됩니다
                </span>
              )}
            </div>
            <GroupList type="character" groups={charGroups} {...sharedProps} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
