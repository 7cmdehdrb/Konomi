import {
  Settings as SettingsIcon,
  X,
  FolderOpen,
  RotateCcw,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Settings } from "@/hooks/useSettings";
import { THEMES } from "@/lib/themes";

interface SettingsViewProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onReset: (keys?: (keyof Settings)[]) => void;
  onClose: () => void;
  outputFolder: string;
  onOutputFolderChange: (outputFolder: string) => void;
  onResetOutputFolder: () => void;
  onResetHashes: () => Promise<void>;
  isAnalyzing: boolean;
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="기본값으로 초기화"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );
}

function SectionHeader({
  children,
  onReset,
}: {
  children: React.ReactNode;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-medium text-foreground select-none">
        {children}
      </h2>
      <ResetButton onClick={onReset} />
    </div>
  );
}

function OptionGroup<T extends number>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: T[];
  label: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
          )}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  );
}

export function SettingsView({
  settings,
  onUpdate,
  onReset,
  onClose,
  outputFolder,
  onOutputFolderChange,
  onResetOutputFolder,
  onResetHashes,
  isAnalyzing,
}: SettingsViewProps) {
  const [resetting, setResetting] = useState(false);
  const [ignoredDuplicates, setIgnoredDuplicates] = useState<string[]>([]);
  const [ignoredLoading, setIgnoredLoading] = useState(false);
  const [ignoredClearing, setIgnoredClearing] = useState(false);
  const [ignoredError, setIgnoredError] = useState<string | null>(null);

  const loadIgnoredDuplicates = async () => {
    setIgnoredLoading(true);
    setIgnoredError(null);
    try {
      const rows = await window.image.listIgnoredDuplicates();
      setIgnoredDuplicates(rows);
    } catch (e: unknown) {
      setIgnoredError(
        e instanceof Error
          ? e.message
          : "무시 목록을 불러오는 중 오류가 발생했습니다.",
      );
    } finally {
      setIgnoredLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    const dir = await window.dialog.selectDirectory();
    if (dir) onOutputFolderChange(dir);
  };

  const handleResetAll = () => {
    onReset();
    onResetOutputFolder();
  };

  const handleReset = async () => {
    setResetting(true);
    await onResetHashes();
    setResetting(false);
  };

  const handleClearIgnoredDuplicates = async () => {
    setIgnoredClearing(true);
    setIgnoredError(null);
    try {
      await window.image.clearIgnoredDuplicates();
      await loadIgnoredDuplicates();
    } catch (e: unknown) {
      setIgnoredError(
        e instanceof Error
          ? e.message
          : "무시 목록 초기화 중 오류가 발생했습니다.",
      );
    } finally {
      setIgnoredClearing(false);
    }
  };

  useEffect(() => {
    void loadIgnoredDuplicates();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground select-none">
              설정
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              className="text-xs h-8 gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              모든 설정 초기화
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <SectionHeader onReset={() => onReset(["theme"])}>테마</SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            앱의 색상 테마를 선택합니다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onUpdate({ theme: theme.id })}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition-colors",
                  settings.theme === theme.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
                )}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <SectionHeader onReset={() => onReset(["pageSize"])}>
            페이지당 이미지 수
          </SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            갤러리에서 한 번에 표시할 이미지 수입니다.
          </p>
          <OptionGroup
            value={settings.pageSize}
            options={[10, 20, 50, 100] as number[]}
            label={(v) => `${v}개`}
            onChange={(v) => onUpdate({ pageSize: v })}
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <SectionHeader onReset={() => onReset(["recentDays"])}>
            최근 생성 범위
          </SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            최근 생성 뷰에서 표시할 기간입니다.
          </p>
          <OptionGroup
            value={settings.recentDays}
            options={[1, 3, 7, 14, 30, 60, 90] as number[]}
            label={(v) => `${v}일`}
            onChange={(v) => onUpdate({ recentDays: v })}
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <SectionHeader onReset={() => onReset(["similarPageSize"])}>
            유사 이미지 패널 페이지 크기
          </SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            이미지 상세 화면의 유사 이미지 패널에서 한 페이지에 표시할 이미지
            수입니다.
          </p>
          <OptionGroup
            value={settings.similarPageSize}
            options={[5, 10, 20, 50] as number[]}
            label={(v) => `${v}개`}
            onChange={(v) => onUpdate({ similarPageSize: v })}
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <SectionHeader onReset={() => onReset(["similarityThreshold"])}>
            유사 이미지 판별 정확도
          </SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            값이 높을수록 비슷한 이미지끼리만 묶입니다.
          </p>
          <OptionGroup
            value={settings.similarityThreshold}
            // 18 이상부터는 거의 모든 이미지가 유사하다고 나옴. 8은 너무 엄격해서 거의 묶이는 게 없음. 10~16 사이가 적당해 보임.
            options={[16, 14, 12, 10, 8] as number[]}
            label={(v) =>
              ({ 16: "최하", 14: "하", 12: "중간", 10: "상", 8: "최상" })[v] ??
              String(v)
            }
            onChange={(v) => onUpdate({ similarityThreshold: v })}
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <SectionHeader onReset={onResetOutputFolder}>
            다운로드 폴더
          </SectionHeader>
          <p className="text-xs text-muted-foreground select-none">
            NAI 생성 이미지가 저장될 폴더입니다.
          </p>
          <div className="flex gap-2">
            <input
              value={outputFolder}
              onChange={(e) => onOutputFolderChange(e.target.value)}
              placeholder="경로 선택..."
              className="flex-1 min-w-0 h-9 px-3 text-sm bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSelectFolder}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground select-none">
            해시 재계산
          </h2>
          <p className="text-xs text-muted-foreground select-none">
            유사 이미지 판별에 사용되는 Perceptual Hash를 초기화하고 다시
            계산합니다.
          </p>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetting || isAnalyzing}
          >
            {resetting
              ? "초기화 중..."
              : isAnalyzing
                ? "계산 중..."
                : "초기화 및 재계산"}
          </Button>
        </div>

        <Separator className="bg-border" />

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground select-none">
            중복 무시 목록
          </h2>
          <p className="text-xs text-muted-foreground select-none">
            중복 처리에서 &quot;무시&quot;를 선택한 파일 목록입니다. 목록을
            초기화하면 다음 스캔/감시부터 다시 수집 대상이 됩니다.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadIgnoredDuplicates}
              disabled={ignoredLoading || ignoredClearing}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-1.5",
                  ignoredLoading && "animate-spin",
                )}
              />
              새로고침
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearIgnoredDuplicates}
              disabled={ignoredClearing || ignoredLoading}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {ignoredClearing ? "초기화 중..." : "목록 초기화"}
            </Button>
          </div>
          {ignoredError && (
            <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              {ignoredError}
            </p>
          )}
          <div className="rounded-md border border-border/60 bg-secondary/10">
            <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
              총 {ignoredDuplicates.length}개
            </div>
            <div className="max-h-40 overflow-auto px-3 py-2">
              {ignoredDuplicates.length === 0 ? (
                <p className="text-xs text-muted-foreground">비어 있습니다.</p>
              ) : (
                <ul className="space-y-1">
                  {ignoredDuplicates.map((filePath) => (
                    <li
                      key={filePath}
                      className="text-xs text-muted-foreground font-mono break-all"
                    >
                      {filePath}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
