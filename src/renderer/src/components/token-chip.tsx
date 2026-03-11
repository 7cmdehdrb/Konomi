import type { KeyboardEvent } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptToken } from "@/lib/token";

function weightClass(w: number): string {
  if (w >= 1.3) return "bg-amber-500/20 text-amber-300";
  if (w > 1.0) return "bg-orange-500/15 text-orange-200";
  if (w < 0) return "bg-rose-500/20 text-rose-300";
  if (w < 0.75) return "bg-blue-500/20 text-blue-300";
  if (w < 1.0) return "bg-sky-500/15 text-sky-200";
  return "bg-white/10 text-white/70";
}

function formatWeight(weight: number): string {
  if (!Number.isFinite(weight)) return "1";
  return weight.toFixed(2).replace(/\.?0+$/, "");
}

interface TokenChipProps {
  token: PromptToken;
  raw: string;
  copied?: boolean;
  onCopy: () => void;
}

export function TokenChip({
  token,
  raw,
  copied = false,
  onCopy,
}: TokenChipProps) {
  const weighted = Math.abs(token.weight - 1.0) > 0.001;
  const chipClass = cn(
    "px-1.5 py-1 text-xs rounded transition-colors cursor-text hover:brightness-110",
    weighted ? weightClass(token.weight) : "bg-white/10 text-white/70",
    copied && "ring-1 ring-emerald-400/50 text-emerald-200",
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onCopy();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-token-chip="true"
      data-token-raw={raw}
      onClick={onCopy}
      onKeyDown={handleKeyDown}
      className={cn(chipClass, "inline-flex items-center gap-1 cursor-pointer")}
    >
      <span>{token.text}</span>
      <span className="text-[10px] font-mono text-white/60">
        {`x${formatWeight(token.weight)}`}
      </span>
      {copied ? <Copy className="h-3 w-3" /> : null}
    </div>
  );
}
