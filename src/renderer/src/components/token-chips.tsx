import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptToken } from "@/lib/token";
import { parseRawToken, tokenToRawString } from "@/lib/token";

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

interface TokenChipsProps {
  tokens: PromptToken[];
  isEditable?: boolean;
  onTokensChange?: (tokens: PromptToken[]) => void;
}

export function TokenChips({
  tokens,
  isEditable = false,
  onTokensChange,
}: TokenChipsProps) {
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [localTokens, setLocalTokens] = useState<PromptToken[]>(tokens);
  const isControlled = typeof onTokensChange === "function";

  useEffect(() => {
    setLocalTokens(tokens);
  }, [tokens]);

  const activeTokens = isControlled ? tokens : localTokens;

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  const pushTokens = (next: PromptToken[]) => {
    if (!isControlled) setLocalTokens(next);
    onTokensChange?.(next);
  };

  const handleCopy = async (key: string, token: PromptToken) => {
    const raw = tokenToRawString(token);
    try {
      await navigator.clipboard.writeText(raw);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  };

  const hasSelection = () => {
    const selection = window.getSelection();
    return !!selection && !selection.isCollapsed;
  };

  const handleChipClick = (key: string, token: PromptToken) => {
    if (hasSelection()) return;
    void handleCopy(key, token);
  };

  const handleChipKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    key: string,
    token: PromptToken,
  ) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    void handleCopy(key, token);
  };

  const handleCopySelectedRaw = (e: ClipboardEvent<HTMLDivElement>) => {
    const root = chipsRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.isCollapsed || selection.rangeCount < 1)
      return;

    const chipNodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-token-chip='true']"),
    );
    const selectedRaw = chipNodes
      .filter((chip) => {
        for (let i = 0; i < selection.rangeCount; i += 1) {
          const range = selection.getRangeAt(i);
          if (range.intersectsNode(chip)) return true;
        }
        return false;
      })
      .map((chip) => chip.dataset.tokenRaw)
      .filter((raw): raw is string => Boolean(raw && raw.trim()));

    if (selectedRaw.length === 0) return;

    e.preventDefault();
    const text = selectedRaw.join(", ");
    e.clipboardData.setData("text/plain", text);
    e.clipboardData.setData("text", text);
  };

  if (isEditable) {
    return (
      <div className="space-y-1.5">
        {activeTokens.map((token, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-1"
          >
            <input
              value={tokenToRawString(token)}
              onChange={(e) =>
                pushTokens(
                  activeTokens.map((x, idx) =>
                    idx === i ? parseRawToken(e.target.value) : x,
                  ),
                )
              }
              placeholder="tag"
              className="flex-1 min-w-0 bg-transparent text-xs text-white/80 outline-none"
            />
            <button
              type="button"
              onClick={() => handleCopy(`editable-${i}`, token)}
              className={cn(
                "h-6 px-1.5 text-[10px] rounded border transition-colors cursor-text",
                copiedKey === `editable-${i}`
                  ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10"
                  : "border-white/15 text-white/50 hover:text-white/80 hover:border-white/30",
              )}
            >
              <span className="flex items-center gap-1">
                <span>Copy</span>
                {copiedKey === `editable-${i}` ? (
                  <Copy className="h-3 w-3 text-emerald-300" />
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                pushTokens(activeTokens.filter((_, idx) => idx !== i))
              }
              className="h-6 px-1.5 text-[10px] rounded border border-rose-500/20 text-rose-300/70 hover:text-rose-200 hover:bg-rose-500/10 transition-colors"
            >
              Del
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => pushTokens([...activeTokens, parseRawToken("")])}
          className="h-6 px-2 text-[10px] rounded border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30 transition-colors"
        >
          + Add Tag
        </button>
      </div>
    );
  }

  if (activeTokens.length === 0) {
    return <span className="text-xs text-white/30">None</span>;
  }

  return (
    <div
      ref={chipsRef}
      onCopy={handleCopySelectedRaw}
      className="flex flex-wrap gap-1"
    >
      {activeTokens.map((token, i) => {
        const key = `view-${i}`;
        const weighted = Math.abs(token.weight - 1.0) > 0.001;
        const copied = copiedKey === key;
        const raw = tokenToRawString(token);
        const chipClass = cn(
          "px-1.5 py-1 text-xs rounded transition-colors cursor-text hover:brightness-110",
          weighted ? weightClass(token.weight) : "bg-white/10 text-white/70",
          copied && "ring-1 ring-emerald-400/50 text-emerald-200",
        );

        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            data-token-chip="true"
            data-token-raw={raw}
            onClick={() => handleChipClick(key, token)}
            onKeyDown={(e) => handleChipKeyDown(e, key, token)}
            className={cn(chipClass, "inline-flex items-center gap-1")}
          >
            <span>{token.text}</span>
            <span className="text-[10px] font-mono text-white/60">
              {`x${formatWeight(token.weight)}`}
            </span>
            {copied ? <Copy className="h-3 w-3" /> : null}
          </div>
        );
      })}
    </div>
  );
}
