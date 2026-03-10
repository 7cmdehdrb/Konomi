import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { ImageData } from "@/components/image-card";
import type { Category } from "@preload/index.d";

interface CategoryDialogProps {
  image: ImageData | null;
  images?: ImageData[] | null;
  categories: Category[];
  onClose: () => void;
}

export function CategoryDialog({
  image,
  images,
  categories,
  onClose,
}: CategoryDialogProps) {
  const targetImages = useMemo(() => {
    if (images && images.length > 0) return images;
    return image ? [image] : [];
  }, [image, images]);

  const targetImageIds = useMemo(
    () => targetImages.map((img) => parseInt(img.id, 10)),
    [targetImages],
  );
  const isBulk = targetImageIds.length > 1;

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (targetImageIds.length === 0) {
      setCheckedIds(new Set());
      setLoading(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const loadPromise =
      targetImageIds.length === 1
        ? window.category.forImage(targetImageIds[0])
        : window.category.commonForImages(targetImageIds);

    loadPromise
      .then((ids) => setCheckedIds(new Set(ids)))
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoading(false));
  }, [targetImageIds]);

  const userCategories = categories.filter((c) => !c.isBuiltin);

  const handleToggle = (categoryId: number, checked: boolean) => {
    if (targetImageIds.length === 0) return;

    const applyPromise =
      targetImageIds.length === 1
        ? checked
          ? window.category.addImage(targetImageIds[0], categoryId)
          : window.category.removeImage(targetImageIds[0], categoryId)
        : checked
          ? window.category.addImages(targetImageIds, categoryId)
          : window.category.removeImages(targetImageIds, categoryId);

    if (checked) {
      setCheckedIds((prev) => new Set([...prev, categoryId]));
      applyPromise.catch((e: unknown) => {
        toast.error(
          `카테고리 추가 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
        setCheckedIds((prev) => {
          const next = new Set(prev);
          next.delete(categoryId);
          return next;
        });
      });
      return;
    }

    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });

    applyPromise.catch((e: unknown) => {
      toast.error(
        `카테고리 제거 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      setCheckedIds((prev) => new Set([...prev, categoryId]));
    });
  };

  return (
    <Dialog
      open={targetImages.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBulk ? "카테고리 일괄 변경" : "카테고리 변경"}
          </DialogTitle>
        </DialogHeader>

        {isBulk && (
          <p className="text-sm text-muted-foreground">
            선택된 {targetImages.length}개 이미지에 카테고리를 일괄 적용합니다.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {loadError}
          </p>
        ) : userCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            생성된 카테고리가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {userCategories.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={checkedIds.has(cat.id)}
                  onCheckedChange={(checked) => handleToggle(cat.id, !!checked)}
                />
                <span className="text-sm text-foreground">{cat.name}</span>
              </label>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
