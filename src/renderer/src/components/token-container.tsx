import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptToken } from "@/lib/token";
import { parseRawToken, tokenToRawString } from "@/lib/token";
import { TokenChip } from "./token-chip";

interface TokenContainerProps {
  tokens: PromptToken[];
  isEditable?: boolean;
  onTokensChange?: (tokens: PromptToken[]) => void;
}

export function TokenContainer({
  tokens,
  isEditable = false,
  onTokensChange,
}: TokenContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const handleChipCopy = (key: string, token: PromptToken) => {
    if (hasSelection()) return;
    void handleCopy(key, token);
  };

  const handleCopySelectedRaw = (e: ClipboardEvent<HTMLDivElement>) => {
    const root = containerRef.current;
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
      ref={containerRef}
      onCopy={handleCopySelectedRaw}
      className="flex flex-wrap gap-1"
    >
      {activeTokens.map((token, i) => {
        const key = `view-${i}`;
        const raw = tokenToRawString(token);
        return (
          <TokenChip
            key={i}
            token={token}
            raw={raw}
            copied={copiedKey === key}
            onCopy={() => handleChipCopy(key, token)}
          />
        );
      })}
    </div>
  );
}
