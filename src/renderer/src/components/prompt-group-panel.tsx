import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptCategory, PromptGroup } from "@preload/index.d";

const DRAG_MIME = "application/x-konomi-token";

interface PromptGroupPanelProps {
  categories: PromptCategory[];
  onCategoriesChange: (categories: PromptCategory[]) => void;
}

// Draggable chip shown inside the panel (not in prompt input)
function DraggableGroupChip({ groupName }: { groupName: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          DRAG_MIME,
          JSON.stringify({ kind: "group", groupName }),
        );
        e.dataTransfer.effectAllowed = "copy";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs",
        "cursor-grab active:cursor-grabbing select-none transition-opacity shrink-0",
        "bg-violet-100 text-violet-800 border-violet-300/60",
        "dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/30",
        dragging && "opacity-40",
      )}
      title="드래그해서 프롬프트에 추가"
    >
      <GripVertical className="h-2.5 w-2.5 text-violet-400/60 shrink-0 -ml-0.5" />
      <span className="font-semibold text-violet-500 dark:text-violet-400">
        @
      </span>
      <span className="truncate max-w-20">{`{${groupName}}`}</span>
    </div>
  );
}

// Inline edit area for a single group's name + tokens
interface GroupEditAreaProps {
  group: PromptGroup;
  onRename: (name: string) => void;
  onAddToken: (label: string) => void;
  onDeleteToken: (tokenId: number) => void;
  onClose: () => void;
}

function GroupEditArea({
  group,
  onRename,
  onAddToken,
  onDeleteToken,
  onClose,
}: GroupEditAreaProps) {
  const [nameDraft, setNameDraft] = useState(group.name);
  const [newTokenDraft, setNewTokenDraft] = useState("");
  const newTokenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => newTokenInputRef.current?.focus());
  }, []);

  const commitRename = () => {
    const name = nameDraft.trim();
    if (name && name !== group.name) onRename(name);
  };

  const handleAddToken = () => {
    const label = newTokenDraft.trim();
    if (!label) return;
    onAddToken(label);
    setNewTokenDraft("");
    requestAnimationFrame(() => newTokenInputRef.current?.focus());
  };

  return (
    <div className="mx-2 mb-2 rounded border border-border/40 bg-secondary/30 p-2">
      {/* Group name */}
      <div className="flex items-center gap-1 mb-2">
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") onClose();
          }}
          onBlur={commitRename}
          placeholder="그룹명"
          className="flex-1 min-w-0 h-6 px-1.5 text-xs bg-background border border-border/60 rounded outline-none focus:border-primary/60 text-foreground"
        />
        <button
          type="button"
          onClick={onClose}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors text-xs"
        >
          ×
        </button>
      </div>

      {/* Token list */}
      {group.tokens.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/40 py-1 text-center">
          태그 없음
        </p>
      ) : (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {group.tokens.map((token) => (
            <div
              key={token.id}
              className="group/token inline-flex items-center gap-0.5 bg-muted border border-border/40 rounded px-1.5 py-0.5 text-xs text-foreground/80"
            >
              <span>{token.label}</span>
              <button
                type="button"
                onClick={() => onDeleteToken(token.id)}
                className="opacity-0 group-hover/token:opacity-100 transition-opacity h-3.5 w-3.5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 className="h-2 w-2" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add token */}
      <div className="flex gap-1">
        <input
          ref={newTokenInputRef}
          value={newTokenDraft}
          onChange={(e) => setNewTokenDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddToken();
            }
          }}
          placeholder="태그 추가..."
          className="flex-1 min-w-0 h-6 px-2 text-[11px] bg-background border border-border/60 rounded outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground/40"
        />
        <button
          type="button"
          onClick={handleAddToken}
          disabled={!newTokenDraft.trim()}
          className="h-6 w-6 flex items-center justify-center rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// Single group row inside a category
interface GroupRowProps {
  group: PromptGroup;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddToken: (label: string) => void;
  onDeleteToken: (tokenId: number) => void;
}

function GroupRow({
  group,
  onRename,
  onDelete,
  onAddToken,
  onDeleteToken,
}: GroupRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-0.5 group/grow">
        <DraggableGroupChip groupName={group.name} />

        <span className="flex-1 min-w-0 text-[11px] text-muted-foreground/50 truncate select-none">
          {group.tokens.length > 0
            ? group.tokens.map((t) => t.label).join(", ")
            : ""}
        </span>

        {!editing && !confirmDelete && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/grow:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              className="h-5 px-1.5 text-[10px] rounded bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors text-xs"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {editing && (
        <GroupEditArea
          group={group}
          onRename={onRename}
          onAddToken={onAddToken}
          onDeleteToken={onDeleteToken}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// Category section
interface CategoryItemProps {
  category: PromptCategory;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddGroup: (name: string) => void;
  onDeleteGroup: (groupId: number) => void;
  onRenameGroup: (groupId: number, name: string) => void;
  onAddToken: (groupId: number, label: string) => void;
  onDeleteToken: (groupId: number, tokenId: number) => void;
}

function CategoryItem({
  category,
  onRename,
  onDelete,
  onAddGroup,
  onDeleteGroup,
  onRenameGroup,
  onAddToken,
  onDeleteToken,
}: CategoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(category.name);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupDraft, setNewGroupDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const newGroupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming) {
      setRenameDraft(category.name);
      requestAnimationFrame(() => renameInputRef.current?.select());
    }
  }, [renaming, category.name]);

  useEffect(() => {
    if (addingGroup) {
      requestAnimationFrame(() => newGroupInputRef.current?.focus());
    }
  }, [addingGroup]);

  const commitRename = () => {
    const name = renameDraft.trim();
    if (name && name !== category.name) onRename(name);
    setRenaming(false);
  };

  const handleAddGroup = () => {
    const name = newGroupDraft.trim();
    if (!name) return;
    onAddGroup(name);
    setNewGroupDraft("");
    setAddingGroup(false);
  };

  return (
    <div className="border-b border-border/20 last:border-b-0">
      {/* Category header */}
      <div className="flex items-center gap-1 px-2 py-1.5 group/cat">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-foreground shrink-0"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={commitRename}
            className="flex-1 min-w-0 h-5 px-1.5 text-xs bg-background border border-primary/60 rounded outline-none text-foreground"
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs font-medium text-foreground/80 truncate select-none cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {category.name}
          </span>
        )}

        <span className="text-[10px] text-muted-foreground/30 shrink-0 tabular-nums">
          {category.groups.length}
        </span>

        {!renaming && !confirmDelete && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setAddingGroup(true);
              }}
              title="그룹 추가"
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            {!category.isBuiltin && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              className="h-5 px-1.5 text-[10px] rounded bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors text-xs"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Expanded: groups + add group input */}
      {expanded && (
        <div className="bg-secondary/10">
          {category.groups.length === 0 && !addingGroup ? (
            <p className="text-[11px] text-muted-foreground/30 py-1.5 text-center">
              그룹 없음 — + 버튼으로 추가
            </p>
          ) : (
            <div className="py-0.5">
              {category.groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  onRename={(name) => onRenameGroup(group.id, name)}
                  onDelete={() => onDeleteGroup(group.id)}
                  onAddToken={(label) => onAddToken(group.id, label)}
                  onDeleteToken={(tokenId) =>
                    onDeleteToken(group.id, tokenId)
                  }
                />
              ))}
            </div>
          )}

          {/* Add group input */}
          {addingGroup ? (
            <div className="flex gap-1 px-2 pb-2">
              <input
                ref={newGroupInputRef}
                value={newGroupDraft}
                onChange={(e) => setNewGroupDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddGroup();
                  }
                  if (e.key === "Escape") {
                    setAddingGroup(false);
                    setNewGroupDraft("");
                  }
                }}
                placeholder="그룹명 (= @{그룹명})..."
                className="flex-1 min-w-0 h-6 px-2 text-[11px] bg-background border border-border/60 rounded outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={!newGroupDraft.trim()}
                className="h-6 w-6 flex items-center justify-center rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingGroup(false);
                  setNewGroupDraft("");
                }}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors text-xs"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingGroup(true)}
              className="w-full text-left px-3 pb-1.5 text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors flex items-center gap-1"
            >
              <Plus className="h-2.5 w-2.5" />
              그룹 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PromptGroupPanel({
  categories,
  onCategoriesChange,
}: PromptGroupPanelProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const created = await window.promptBuilder.createCategory(name);
    onCategoriesChange([...categories, created]);
    setNewCategoryName("");
  };

  const handleRenameCategory = async (id: number, name: string) => {
    await window.promptBuilder.renameCategory(id, name);
    onCategoriesChange(
      categories.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  };

  const handleDeleteCategory = async (id: number) => {
    await window.promptBuilder.deleteCategory(id);
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const handleAddGroup = async (categoryId: number, name: string) => {
    const group = await window.promptBuilder.createGroup(categoryId, name);
    onCategoriesChange(
      categories.map((c) =>
        c.id === categoryId ? { ...c, groups: [...c.groups, group] } : c,
      ),
    );
  };

  const handleDeleteGroup = async (categoryId: number, groupId: number) => {
    await window.promptBuilder.deleteGroup(groupId);
    onCategoriesChange(
      categories.map((c) =>
        c.id === categoryId
          ? { ...c, groups: c.groups.filter((g) => g.id !== groupId) }
          : c,
      ),
    );
  };

  const handleRenameGroup = async (
    categoryId: number,
    groupId: number,
    name: string,
  ) => {
    await window.promptBuilder.renameGroup(groupId, name);
    onCategoriesChange(
      categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              groups: c.groups.map((g) =>
                g.id === groupId ? { ...g, name } : g,
              ),
            }
          : c,
      ),
    );
  };

  const handleAddToken = async (
    categoryId: number,
    groupId: number,
    label: string,
  ) => {
    const token = await window.promptBuilder.createToken(groupId, label);
    onCategoriesChange(
      categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              groups: c.groups.map((g) =>
                g.id === groupId
                  ? { ...g, tokens: [...g.tokens, token] }
                  : g,
              ),
            }
          : c,
      ),
    );
  };

  const handleDeleteToken = async (
    categoryId: number,
    groupId: number,
    tokenId: number,
  ) => {
    await window.promptBuilder.deleteToken(tokenId);
    onCategoriesChange(
      categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              groups: c.groups.map((g) =>
                g.id === groupId
                  ? { ...g, tokens: g.tokens.filter((t) => t.id !== tokenId) }
                  : g,
              ),
            }
          : c,
      ),
    );
  };

  const handleResetCategories = async () => {
    await window.promptBuilder.resetCategories();
    const cs = await window.promptBuilder.listCategories();
    onCategoriesChange(cs);
    setConfirmReset(false);
  };

  // Load on mount if empty
  useEffect(() => {
    if (categories.length > 0) return;
    window.promptBuilder
      .listCategories()
      .then((cs) => onCategoriesChange(cs))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 pt-2.5 pb-1.5 flex items-center justify-between border-b border-border/30">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          그룹 프롬프트
        </p>
        {confirmReset ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/60">
              모든 설정을 초기화합니다.
            </span>
            <button
              type="button"
              onClick={() => void handleResetCategories()}
              className="h-5 px-1.5 text-[10px] rounded bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors text-xs"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            title="기본값으로 초기화"
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Hint */}
      <p className="text-[9px] text-muted-foreground/40 px-3 py-1.5 shrink-0 border-b border-border/20">
        칩을 드래그해서 프롬프트 입력란에 추가하세요
      </p>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 text-center py-6">
            카테고리 없음 — 아래에서 추가하세요
          </p>
        ) : (
          categories.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              onRename={(name) => void handleRenameCategory(category.id, name)}
              onDelete={() => void handleDeleteCategory(category.id)}
              onAddGroup={(name) => void handleAddGroup(category.id, name)}
              onDeleteGroup={(groupId) =>
                void handleDeleteGroup(category.id, groupId)
              }
              onRenameGroup={(groupId, name) =>
                void handleRenameGroup(category.id, groupId, name)
              }
              onAddToken={(groupId, label) =>
                void handleAddToken(category.id, groupId, label)
              }
              onDeleteToken={(groupId, tokenId) =>
                void handleDeleteToken(category.id, groupId, tokenId)
              }
            />
          ))
        )}
      </div>

      {/* New category input */}
      <div className="shrink-0 border-t border-border/40 p-2">
        <div className="flex gap-1">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreateCategory();
              }
            }}
            placeholder="새 카테고리 이름..."
            className="flex-1 min-w-0 h-7 px-2 text-xs bg-secondary/60 border border-border/60 rounded outline-none focus:border-primary/60 text-foreground placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={() => void handleCreateCategory()}
            disabled={!newCategoryName.trim()}
            className="h-7 w-7 flex items-center justify-center rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
