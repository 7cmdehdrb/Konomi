import { type ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface Announcement {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Version that fixed this issue — first-run users on this version+ auto-skip. null = always show */
  fixedInVersion: string | null;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "v0.6.0-similarity-fix",
    titleKey: "announcement.v060SimilarityFix.title",
    bodyKey: "announcement.v060SimilarityFix.body",
    fixedInVersion: "0.6.0",
  },
];

function getStorageKey(id: string) {
  return `konomi-announcement-${id}`;
}

/** Simple semver compare: returns -1 | 0 | 1 */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function getLatestUnacknowledged(): Announcement | null {
  const isFirstRun = localStorage.getItem("konomi-tour-completed") !== "true";

  // First-run users on fixedInVersion+ are unaffected — auto-acknowledge
  if (isFirstRun) {
    const appVersion = __APP_VERSION__;
    for (const a of ANNOUNCEMENTS) {
      if (
        a.fixedInVersion &&
        compareSemver(appVersion, a.fixedInVersion) >= 0
      ) {
        try {
          localStorage.setItem(getStorageKey(a.id), "true");
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  }

  for (let i = ANNOUNCEMENTS.length - 1; i >= 0; i--) {
    const a = ANNOUNCEMENTS[i];
    if (localStorage.getItem(getStorageKey(a.id)) !== "true") {
      return a;
    }
  }
  return null;
}

/** Parses `**bold**` markers into <strong> elements */
function renderBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((segment, i) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={i} className="text-red-500">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return segment;
  });
}

interface AnnouncementModalProps {
  disabled?: boolean;
}

export function AnnouncementModal({ disabled }: AnnouncementModalProps) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState(getLatestUnacknowledged);

  if (!announcement || disabled) return null;

  const handleConfirm = () => {
    try {
      localStorage.setItem(getStorageKey(announcement.id), "true");
    } catch {
      /* ignore */
    }
    setAnnouncement(null);
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t(announcement.titleKey)}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed select-none">
          {renderBold(t(announcement.bodyKey))}
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm}>{t("announcement.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
