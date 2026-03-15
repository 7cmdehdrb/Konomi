import { useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptToken } from "@/lib/token";
import { tokenToRawString } from "@/lib/token";
import type { ImageData } from "./image-card";

const DRAG_MIME = "application/x-konomi-token";

interface DraggableTokenChipProps {
  token: PromptToken;
}

function DraggableTokenChip({ token }: DraggableTokenChipProps) {
  const [dragging, setDragging] = useState(false);
  const raw = tokenToRawString(token);
  const hasWeight = Math.abs(token.weight - 1.0) > 0.001;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(token));
        e.dataTransfer.effectAllowed = "copy";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/60 bg-secondary px-2 py-0.5 text-xs cursor-grab active:cursor-grabbing select-none transition-opacity",
        dragging && "opacity-40",
      )}
      title={raw}
    >
      <GripVertical className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0 -ml-0.5" />
      <span className="text-foreground/90 max-w-[140px] truncate">{token.text}</span>
      {hasWeight && (
        <span className="text-[10px] text-primary/70 font-mono shrink-0">
          {token.weight.toFixed(2)}
        </span>
      )}
    </div>
  );
}

interface TokenSectionProps {
  label: string;
  tokens: PromptToken[];
}

function TokenSection({ label, tokens }: TokenSectionProps) {
  if (tokens.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
      <div className="flex flex-wrap gap-1">
        {tokens.map((token, i) => (
          <DraggableTokenChip key={i} token={token} />
        ))}
      </div>
    </div>
  );
}

interface PromptSourcePanelProps {
  image: ImageData;
}

export function PromptSourcePanel({ image }: PromptSourcePanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thumbnail */}
      {image.src && (
        <div className="shrink-0 px-3 pt-2.5 pb-2">
          <div
            className="w-full rounded-md overflow-hidden border border-border/40 bg-secondary/30"
            style={{ maxHeight: 140 }}
          >
            <img
              src={image.src}
              alt="참고 이미지"
              className="w-full h-full object-contain"
              style={{ maxHeight: 140 }}
            />
          </div>
        </div>
      )}

      {/* Tokens - scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 min-h-0">
        <p className="text-[9px] text-muted-foreground/40 mb-2">
          칩을 드래그해서 프롬프트 입력란에 추가하세요
        </p>
        <TokenSection label="프롬프트" tokens={image.tokens} />
        <TokenSection label="네거티브" tokens={image.negativeTokens} />
        {image.characterTokens.length > 0 && (
          <TokenSection label="캐릭터" tokens={image.characterTokens} />
        )}
        {image.tokens.length === 0 &&
          image.negativeTokens.length === 0 &&
          image.characterTokens.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-4">
              프롬프트 정보가 없습니다
            </p>
          )}
      </div>
    </div>
  );
}
