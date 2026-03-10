export type PromptToken = { text: string; weight: number };

const MULT = 1.05;

function parseBracketWeight(raw: string): PromptToken {
  let text = raw.trim();
  let power = 0;

  let changed = true;
  while (changed) {
    changed = false;
    if (text.startsWith("{") && text.endsWith("}") && text.length > 1) {
      power++;
      text = text.slice(1, -1).trim();
      changed = true;
    } else if (text.startsWith("[") && text.endsWith("]") && text.length > 1) {
      power--;
      text = text.slice(1, -1).trim();
      changed = true;
    }
  }

  // Remove (tag:weight) style weight suffixes (SD/NAI hybrid syntax)
  text = text
    .replace(/:[\d.]+\s*(?=[)}\]>])/g, "")
    .trim()
    .replace(/\s+/g, " ");

  return { text, weight: Math.pow(MULT, power) };
}

export function parsePromptTokens(prompt: string): PromptToken[] {
  const result: PromptToken[] = [];

  // Extract explicit weight::content:: blocks before comma-splitting
  const segments: Array<{ text: string; explicitWeight: number | null }> = [];
  const re = /(-?[\d.]+)::([\s\S]*?)::/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(prompt)) !== null) {
    if (m.index > lastIdx)
      segments.push({
        text: prompt.slice(lastIdx, m.index),
        explicitWeight: null,
      });
    segments.push({ text: m[2], explicitWeight: parseFloat(m[1]) });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < prompt.length)
    segments.push({ text: prompt.slice(lastIdx), explicitWeight: null });

  for (const seg of segments) {
    for (const part of seg.text.split(",")) {
      const token = parseBracketWeight(part);
      if (!token.text) continue;
      result.push({
        text: token.text,
        weight: seg.explicitWeight !== null ? seg.explicitWeight : token.weight,
      });
    }
  }

  return result;
}
