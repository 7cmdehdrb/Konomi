import { AlertTriangle, ImageIcon, Images, Loader2, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ImageData } from "@/components/image-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Category } from "@preload/index.d";

interface CategoryDialogProps {
  image: ImageData | null;
  images?: ImageData[] | null;
  categories: Category[];
  onClose: () => void;
}

function getImageFileName(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

export function CategoryDialog({
  image,
  images,
  categories,
  onClose,
}: CategoryDialogProps) {
  const { t } = useTranslation();
  const targetImages = useMemo(() => {
    if (images && images.length > 0) return images;
    return image ? [image] : [];
  }, [image, images]);

  const targetImageIds = useMemo(
    () => targetImages.map((img) => parseInt(img.id, 10)),
    [targetImages],
  );
  const isBulk = targetImageIds.length > 1;
  const previewImages = useMemo(() => targetImages.slice(0, 4), [targetImages]);
  const hiddenPreviewCount = Math.max(
    0,
    targetImages.length - previewImages.length,
  );
  const userCategories = useMemo(
    () => categories.filter((category) => !category.isBuiltin),
    [categories],
  );
  const dialogDescription = isBulk
    ? t("categoryDialog.bulkDescription", { count: targetImages.length })
    : t("categoryDialog.singleDescription");

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const checkedCount = checkedIds.size;

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
          t("categoryDialog.addFailed", {
            message: e instanceof Error ? e.message : String(e),
          }),
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
        t("categoryDialog.removeFailed", {
          message: e instanceof Error ? e.message : String(e),
        }),
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
      <DialogContent className="w-[min(95vw,56rem)] max-w-3xl overflow-hidden p-0">
        <div className="flex flex-col">
          <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/14 via-background to-secondary/45 px-6 py-6 sm:px-7">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-12 top-0 h-36 w-36 rounded-full bg-primary/12 blur-3xl" />
              <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-secondary/80 blur-3xl" />
            </div>

            <div className="relative z-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <DialogHeader className="mb-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-primary"
                    >
                      {isBulk ? (
                        <Images className="h-3.5 w-3.5" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                      {targetImages.length}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      <Tag className="h-3.5 w-3.5" />
                      {userCategories.length}
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl tracking-tight">
                    {isBulk
                      ? t("categoryDialog.title.bulk")
                      : t("categoryDialog.title.single")}
                  </DialogTitle>
                  <DialogDescription className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {dialogDescription}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {isBulk ? (
                    <Images className="h-3.5 w-3.5" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  {t("categoryDialog.selectionLabel")}
                </p>

                {isBulk ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {previewImages.map((targetImage, index) => {
                      const fileName = getImageFileName(targetImage.path);
                      const showOverflowCount =
                        hiddenPreviewCount > 0 &&
                        index === previewImages.length - 1;

                      return (
                        <div
                          key={targetImage.id}
                          className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-secondary/30"
                        >
                          {targetImage.src ? (
                            <img
                              src={targetImage.src}
                              alt={fileName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/12 to-secondary/40 text-muted-foreground">
                              <Images className="h-5 w-5" />
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                          <span className="absolute bottom-2 left-2 right-2 truncate text-[11px] font-medium text-white">
                            {fileName}
                          </span>
                          {showOverflowCount && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/72 backdrop-blur-[2px]">
                              <span className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-sm font-semibold text-foreground shadow-sm">
                                +{hiddenPreviewCount}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : targetImages[0] ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
                      {targetImages[0].src ? (
                        <img
                          src={targetImages[0].src}
                          alt={getImageFileName(targetImages[0].path)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/12 to-secondary/40 text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {getImageFileName(targetImages[0].path)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {targetImages[0].prompt?.trim() ||
                          `${targetImages[0].width} x ${targetImages[0].height}`}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-5 px-6 py-5 sm:px-7">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border/60 bg-secondary/20 px-6 py-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("categoryDialog.loading")}
                  </p>
                </div>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <p className="pt-1 text-sm leading-relaxed text-destructive">
                    {loadError}
                  </p>
                </div>
              </div>
            ) : userCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm">
                  <Tag className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  {t("categoryDialog.empty")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("categoryDialog.emptyDescription")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("categoryDialog.categoriesLabel")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isBulk
                        ? t("categoryDialog.commonHint")
                        : t("categoryDialog.liveApply")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {t("categoryDialog.categoryCount", {
                        count: userCategories.length,
                      })}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-primary"
                    >
                      {t("categoryDialog.selectedCount", {
                        count: checkedCount,
                      })}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="max-h-[24rem]">
                  <div className="space-y-2 pr-3">
                    {userCategories.map((category) => {
                      const checked = checkedIds.has(category.id);

                      return (
                        <label
                          key={category.id}
                          className={cn(
                            "group flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                            checked
                              ? "border-primary/35 bg-primary/10 shadow-sm"
                              : "border-border/60 bg-card/60 hover:border-primary/25 hover:bg-secondary/35",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) =>
                              handleToggle(category.id, !!nextChecked)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-medium text-foreground">
                                {category.name}
                              </span>
                              {checked && (
                                <Badge className="rounded-full border border-primary/15 bg-primary/90 px-2.5 py-0.5 text-[11px] text-primary-foreground">
                                  {t("categoryDialog.applied")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <DialogFooter className="mt-0 border-t border-border/60 pt-4">
              <p className="mr-auto text-xs text-muted-foreground">
                {t("categoryDialog.liveApply")}
              </p>
              <Button variant="ghost" onClick={onClose}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
