import { memo, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PromptCategory, PromptGroup } from "@preload/index.d";

const DRAG_MIME = "application/x-konomi-token";

interface PromptGroupPanelProps {
  categories: PromptCategory[];
  onCategoriesChange: (categories: PromptCategory[]) => void;
}

function DraggableGroupChip({ groupName }: { groupName: string }) {
  const { t } = useTranslation();
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
        "bg-group/14 text-group border-group/35",
        dragging && "opacity-40",
      )}
      title={t("promptGroupPanel.dragGroupToPrompt")}
    >
      <GripVertical className="h-2.5 w-2.5 text-group/70 shrink-0 -ml-0.5" />
      <span className="font-semibold text-group">@</span>
      <span className="truncate max-w-20">{`{${groupName}}`}</span>
    </div>
  );
}

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
  const { t } = useTranslation();
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
      <div className="mb-2 flex items-center gap-1">
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
          placeholder={t("promptGroupPanel.groupNamePlaceholder")}
          className="flex-1 min-w-0 h-6 rounded border border-border/60 bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary/60"
        />
        <button
          type="button"
          onClick={onClose}
          title={t("common.close")}
          aria-label={t("common.close")}
          className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
        >
          x
        </button>
      </div>

      {group.tokens.length === 0 ? (
        <p className="py-1 text-center text-[11px] text-muted-foreground/40">
          {t("promptGroupPanel.noTags")}
        </p>
      ) : (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {group.tokens.map((token) => (
            <div
              key={token.id}
              className="group/token inline-flex items-center gap-0.5 rounded border border-border/40 bg-muted px-1.5 py-0.5 text-xs text-foreground/80"
            >
              <span>{token.label}</span>
              <button
                type="button"
                onClick={() => onDeleteToken(token.id)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/token:opacity-100"
                title={t("common.delete")}
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-2 w-2" />
              </button>
            </div>
          ))}
        </div>
      )}

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
          placeholder={t("promptGroupPanel.addTagPlaceholder")}
          className="flex-1 min-w-0 h-6 rounded border border-border/60 bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary/60 placeholder:text-muted-foreground/40"
        />
        <button
          type="button"
          onClick={handleAddToken}
          disabled={!newTokenDraft.trim()}
          className="flex h-6 w-6 items-center justify-center rounded border border-primary/30 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
          title={t("promptGroupPanel.addTag")}
          aria-label={t("promptGroupPanel.addTag")}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

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
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <div className="group/grow flex items-center gap-1 px-2 py-0.5">
        <DraggableGroupChip groupName={group.name} />

        <span className="flex-1 min-w-0 truncate select-none text-[11px] text-muted-foreground/50">
          {group.tokens.length > 0
            ? group.tokens.map((token) => token.label).join(", ")
            : ""}
        </span>

        {!editing && !confirmDelete && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/grow:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title={t("promptGroupPanel.editGroup")}
              aria-label={t("promptGroupPanel.editGroup")}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title={t("common.delete")}
              aria-label={t("common.delete")}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {confirmDelete && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="h-5 rounded border border-destructive/30 bg-destructive/15 px-1.5 text-[10px] text-destructive transition-colors hover:bg-destructive/25"
            >
              {t("common.delete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              title={t("common.close")}
              aria-label={t("common.close")}
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
            >
              x
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

const BUILTIN_PROMPT_CATEGORY_KEYS = [
  "peopleCount",
  "rating",
  "artStyle",
  "composition",
  "location",
  "effects",
  "qualityTags",
  "characterGender",
  "characterSpecific",
  "characterAge",
  "characterHairEyes",
  "characterOutfit",
  "characterPose",
  "characterAction",
  "characterBodyPart",
  "characterFace",
  "characterEffects",
] as const;

function getDisplayCategoryName(
  category: PromptCategory,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!category.isBuiltin) return category.name;

  const builtinKey = BUILTIN_PROMPT_CATEGORY_KEYS[category.order];
  if (!builtinKey) return category.name;

  return t(`promptGroupPanel.builtinCategories.${builtinKey}`);
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
  const { t } = useTranslation();
  const displayName = getDisplayCategoryName(category, t);
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
      <div className="group/cat flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/80 hover:text-foreground"
          title={
            expanded
              ? t("promptGroupPanel.collapse")
              : t("promptGroupPanel.expand")
          }
          aria-label={
            expanded
              ? t("promptGroupPanel.collapse")
              : t("promptGroupPanel.expand")
          }
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
            className="flex-1 min-w-0 h-5 rounded border border-primary/60 bg-background px-1.5 text-xs text-foreground outline-none"
          />
        ) : (
          <span
            className="flex-1 min-w-0 cursor-pointer truncate select-none text-xs font-medium text-foreground/80"
            onClick={() => setExpanded((value) => !value)}
          >
            {displayName}
          </span>
        )}

        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/80">
          {category.groups.length}
        </span>

        {!renaming && !confirmDelete && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setAddingGroup(true);
              }}
              title={t("promptGroupPanel.addGroup")}
              aria-label={t("promptGroupPanel.addGroup")}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
            {!category.isBuiltin && (
              <button
                type="button"
                onClick={() => setRenaming(true)}
                title={t("promptGroupPanel.renameCategory")}
                aria-label={t("promptGroupPanel.renameCategory")}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
            {!category.isBuiltin && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title={t("common.delete")}
                aria-label={t("common.delete")}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {confirmDelete && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="h-5 rounded border border-destructive/30 bg-destructive/15 px-1.5 text-[10px] text-destructive transition-colors hover:bg-destructive/25"
            >
              {t("common.delete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              title={t("common.close")}
              aria-label={t("common.close")}
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
            >
              x
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="bg-secondary/10">
          {category.groups.length === 0 && !addingGroup ? (
            <p className="py-1.5 text-center text-[11px] text-muted-foreground/60">
              {t("promptGroupPanel.noGroups")}
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
                  onDeleteToken={(tokenId) => onDeleteToken(group.id, tokenId)}
                />
              ))}
            </div>
          )}

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
                placeholder={t("promptGroupPanel.newGroupPlaceholder")}
                className="flex-1 min-w-0 h-6 rounded border border-border/60 bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary/60 placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={!newGroupDraft.trim()}
                title={t("promptGroupPanel.addGroup")}
                aria-label={t("promptGroupPanel.addGroup")}
                className="flex h-6 w-6 items-center justify-center rounded border border-primary/30 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingGroup(false);
                  setNewGroupDraft("");
                }}
                title={t("common.close")}
                aria-label={t("common.close")}
                className="flex h-6 w-6 items-center justify-center rounded text-xs text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
              >
                x
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const PromptGroupPanel = memo(function PromptGroupPanel({
  categories,
  onCategoriesChange,
}: PromptGroupPanelProps) {
  const { t } = useTranslation();
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
      categories.map((category) =>
        category.id === id ? { ...category, name } : category,
      ),
    );
  };

  const handleDeleteCategory = async (id: number) => {
    await window.promptBuilder.deleteCategory(id);
    onCategoriesChange(categories.filter((category) => category.id !== id));
  };

  const handleAddGroup = async (categoryId: number, name: string) => {
    const group = await window.promptBuilder.createGroup(categoryId, name);
    onCategoriesChange(
      categories.map((category) =>
        category.id === categoryId
          ? { ...category, groups: [...category.groups, group] }
          : category,
      ),
    );
  };

  const handleDeleteGroup = async (categoryId: number, groupId: number) => {
    await window.promptBuilder.deleteGroup(groupId);
    onCategoriesChange(
      categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              groups: category.groups.filter((group) => group.id !== groupId),
            }
          : category,
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
      categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              groups: category.groups.map((group) =>
                group.id === groupId ? { ...group, name } : group,
              ),
            }
          : category,
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
      categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              groups: category.groups.map((group) =>
                group.id === groupId
                  ? { ...group, tokens: [...group.tokens, token] }
                  : group,
              ),
            }
          : category,
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
      categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              groups: category.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      tokens: group.tokens.filter(
                        (token) => token.id !== tokenId,
                      ),
                    }
                  : group,
              ),
            }
          : category,
      ),
    );
  };

  const handleResetCategories = async () => {
    await window.promptBuilder.resetCategories();
    const nextCategories = await window.promptBuilder.listCategories();
    onCategoriesChange(nextCategories);
    setConfirmReset(false);
  };

  useEffect(() => {
    if (categories.length > 0) return;
    window.promptBuilder
      .listCategories()
      .then((nextCategories) => onCategoriesChange(nextCategories))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 pt-2.5 pb-1.5">
        <p className="select-none text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("promptGroupPanel.title")}
        </p>
        {confirmReset ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-destructive">
              {t("promptGroupPanel.resetDescription")}
            </span>
            <button
              type="button"
              onClick={() => void handleResetCategories()}
              className="h-5 rounded border border-destructive/30 bg-destructive/15 px-1.5 text-[10px] text-destructive transition-colors hover:bg-destructive/25"
            >
              {t("generation.dialogs.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              title={t("common.close")}
              aria-label={t("common.close")}
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
            >
              x
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            title={t("promptGroupPanel.resetToDefault")}
            aria-label={t("promptGroupPanel.resetToDefault")}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="shrink-0 border-b border-border/20 px-3 py-1.5 text-xs text-muted-foreground/80 select-none">
        {t("promptGroupPanel.dragHint")}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground/40">
            {t("promptGroupPanel.noCategories")}
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
            placeholder={t("promptGroupPanel.newCategoryPlaceholder")}
            className="flex-1 min-w-0 h-7 rounded border border-border/60 bg-secondary/60 px-2 text-xs text-foreground outline-none focus:border-primary/60 placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={() => void handleCreateCategory()}
            disabled={!newCategoryName.trim()}
            title={t("promptGroupPanel.createCategory")}
            aria-label={t("promptGroupPanel.createCategory")}
            className="flex h-7 w-7 items-center justify-center rounded border border-primary/30 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
