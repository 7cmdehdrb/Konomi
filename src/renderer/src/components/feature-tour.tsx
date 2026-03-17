import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
  panel?: "gallery" | "generator";
  action?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="search"]',
    title: "프롬프트 검색",
    description:
      "이미지에 포함된 프롬프트를 검색할 수 있습니다. 쉼표로 여러 태그를 입력하세요.",
    placement: "bottom",
    panel: "gallery",
  },
  {
    targetSelector: '[data-tour="panel-buttons"]',
    title: "패널 전환",
    description:
      "이미지 생성, 갤러리, 설정, 앱 정보 패널을 전환할 수 있습니다.",
    placement: "bottom",
    panel: "gallery",
  },
  {
    targetSelector: '[data-tour="sidebar-views"]',
    title: "보기 모드",
    description:
      "모든 이미지를 보거나 최근 생성된 이미지만 필터링할 수 있습니다.",
    placement: "right",
    panel: "gallery",
  },
  {
    targetSelector: '[data-tour="sidebar-folders"]',
    title: "폴더 관리",
    description:
      "이미지 폴더를 추가하고, 눈 아이콘으로 표시 여부를 전환하세요.",
    placement: "right",
    panel: "gallery",
  },
  {
    targetSelector: '[data-tour="sidebar-categories"]',
    title: "카테고리",
    description: "즐겨찾기, 랜덤 픽 등 카테고리로 이미지를 분류할 수 있습니다.",
    placement: "right",
    panel: "gallery",
  },
  {
    targetSelector: '[data-tour="gallery-toolbar"]',
    title: "갤러리 도구",
    description:
      "정렬 방식 변경, 뷰 모드 전환, 선택 모드를 사용할 수 있습니다.",
    placement: "bottom",
    panel: "gallery",
  },
  // GenerationView steps
  {
    targetSelector: '[data-tour="gen-prompt-input"]',
    title: "프롬프트 입력",
    description:
      "쉼표(,)로 태그를 구분하면 자동으로 토큰 칩으로 변환됩니다. 각 칩을 더블클릭하면 가중치와 표현식을 편집할 수 있습니다.",
    placement: "bottom",
    panel: "generator",
  },
  {
    targetSelector: '[data-tour="gen-prompt-input"]',
    title: "PromptInput 커서",
    description:
      "토큰 칩을 클릭하면 입력 커서가 이동합니다. 이질감 없이 텍스트를 수정하는 것처럼 토큰 칩을 수정할 수 있습니다.",
    placement: "bottom",
    panel: "generator",
  },
  {
    targetSelector: '[data-tour="gen-prompt-input"]',
    title: "그룹 칩",
    description:
      "@{를 입력하면 프롬프트 그룹 자동완성이 나타납니다. 그룹 칩은 보라색으로 표시되며, 미리 정의한 태그 묶음을 한 번에 삽입합니다. 우측 패널의 그룹 프롬프트 탭에서 그룹을 생성하고 관리할 수 있습니다.",
    placement: "bottom",
    panel: "generator",
  },
  {
    targetSelector: '[data-tour="gen-prompt-group-panel"]',
    title: "그룹 프롬프트 관리",
    description:
      "이 패널에서 프롬프트 그룹을 생성하고 태그를 편집할 수 있습니다. 그룹을 프롬프트 입력 영역으로 드래그하면 그룹 칩으로 삽입됩니다.",
    placement: "left",
    panel: "generator",
    action: "open-prompt-group-panel",
  },
  {
    targetSelector: '[data-tour="gen-prompt-input"]',
    title: "와일드카드",
    description:
      "파이프(|)를 포함한 태그를 입력하면 %{옵션1|옵션2} 형태의 와일드카드 칩이 생성됩니다. 생성할 때마다 옵션 중 하나가 랜덤으로 선택됩니다.",
    placement: "bottom",
    panel: "generator",
  },
  {
    targetSelector: '[data-tour="gen-auto-gen"]',
    title: "자동 생성",
    description:
      "횟수, 딜레이, 시드 모드를 설정하여 여러 장의 이미지를 자동으로 연속 생성할 수 있습니다. 무한 모드로 수동 중지 전까지 생성을 계속할 수도 있습니다.",
    placement: "top",
    panel: "generator",
  },
  {
    targetSelector: '[data-tour="gen-generate-button"]',
    title: "이미지 생성",
    description:
      "프롬프트를 입력한 후 생성 버튼을 눌러 이미지를 생성하세요. 우측 패널에서 API 키와 출력 폴더를 먼저 설정해야 합니다.",
    action: "open-settings-panel",
    placement: "top",
    panel: "generator",
  },
];

interface FeatureTourProps {
  open: boolean;
  onClose: () => void;
  onPanelChange?: (panel: "gallery" | "generator") => void;
  onAction?: (action: string) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const GAP = 12;
const POPOVER_WIDTH = 320;

function computePopoverPosition(
  spotRect: Rect,
  placement: TourStep["placement"],
  popoverHeight: number,
) {
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = spotRect.top + spotRect.height + PADDING + GAP;
      left =
        spotRect.left +
        spotRect.width / 2 -
        PADDING -
        POPOVER_WIDTH / 2;
      break;
    case "top":
      top = spotRect.top - PADDING - GAP - popoverHeight;
      left =
        spotRect.left +
        spotRect.width / 2 -
        PADDING -
        POPOVER_WIDTH / 2;
      break;
    case "right":
      top =
        spotRect.top +
        spotRect.height / 2 -
        PADDING -
        popoverHeight / 2;
      left = spotRect.left + spotRect.width + PADDING + GAP;
      break;
    case "left":
      top =
        spotRect.top +
        spotRect.height / 2 -
        PADDING -
        popoverHeight / 2;
      left = spotRect.left - PADDING - GAP - POPOVER_WIDTH;
      break;
  }

  // Viewport clamping
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left < 8) left = 8;
  if (left + POPOVER_WIDTH > vw - 8) left = vw - 8 - POPOVER_WIDTH;
  if (top < 8) top = 8;
  if (top + popoverHeight > vh - 8) top = vh - 8 - popoverHeight;

  return { top, left };
}

export function FeatureTour({ open, onClose, onPanelChange, onAction }: FeatureTourProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const currentStep = TOUR_STEPS[step];

  const updateRect = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [currentStep]);

  // Switch panel / fire action if needed, then recalculate target rect
  useEffect(() => {
    if (!open || !currentStep) return undefined;
    let cancelled = false;
    if (currentStep.panel || currentStep.action) {
      if (currentStep.panel) onPanelChange?.(currentStep.panel);
      if (currentStep.action) onAction?.(currentStep.action);
      // Retry until element appears (action may need multiple render cycles)
      const tryFind = (attempt: number) => {
        if (cancelled) return;
        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
          updateRect();
        } else if (attempt < 10) {
          setTimeout(() => tryFind(attempt + 1), 50);
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(() => tryFind(0));
      });
    } else {
      updateRect();
    }
    return () => {
      cancelled = true;
    };
  }, [open, currentStep, onPanelChange, onAction, updateRect]);

  // Recalculate on resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [open, updateRect]);

  // Recalculate popover position after rect or popover height changes
  useEffect(() => {
    if (!targetRect || !currentStep) {
      setPopoverPos(null);
      return;
    }
    const popoverHeight = popoverRef.current?.offsetHeight ?? 160;
    setPopoverPos(
      computePopoverPosition(targetRect, currentStep.placement, popoverHeight),
    );
  }, [targetRect, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Reset step when opening
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open || !currentStep) return null;

  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const overlay = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop - no click to close */}
      <div className="absolute inset-0" />

      {/* Spotlight */}
      {targetRect && (
        <div
          className="absolute rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - PADDING,
            left: targetRect.left - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            transition: "all 300ms ease",
          }}
        />
      )}

      {/* Popover card */}
      {popoverPos && (
        <div
          ref={popoverRef}
          className="absolute bg-popover border border-border rounded-xl shadow-lg p-4"
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
            width: POPOVER_WIDTH,
            transition: "all 300ms ease",
          }}
        >
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {currentStep.title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {currentStep.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {step + 1} / {TOUR_STEPS.length}
            </span>
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </Button>
              )}
              {isLast ? (
                <Button size="sm" className="h-7 px-3" onClick={onClose}>
                  완료
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setStep((s) => s + 1)}
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {isLast && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              우측 상단 ℹ 버튼 → &quot;기능 둘러보기&quot;에서 다시 볼 수
              있습니다
            </p>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
