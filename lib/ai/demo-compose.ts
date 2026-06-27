import type { ComposeMode } from "./compose-prompts";

/**
 * Demo-mode composition. Builds a local draft from the user's own goal/notes/context and
 * yields it in small chunks so the editor streams it in (no model, no fabricated facts).
 */

function chunk(text: string): string[] {
  // Emit ~4 words at a time to simulate live writing.
  const words = text.split(/(\s+)/); // keep whitespace tokens
  const out: string[] = [];
  let buf = "";
  let count = 0;
  for (const w of words) {
    buf += w;
    if (/\S/.test(w)) count++;
    if (count >= 4) {
      out.push(buf);
      buf = "";
      count = 0;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function firstSentences(text: string, n: number): string {
  const s = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return s.slice(0, n).join(" ");
}

export function composeDemo(opts: {
  mode: ComposeMode;
  goal?: string;
  context?: string;
  currentText?: string;
  selection?: string;
}): string[] {
  const { mode, goal, context, currentText, selection } = opts;
  const material = [currentText, context].filter(Boolean).join("\n\n").trim();

  if (mode === "improve") {
    // A light, real local cleanup: collapse whitespace and soften a couple of clichés.
    const cleaned = (selection ?? "")
      .replace(/\s+/g, " ")
      .replace(/\bleverage\b/gi, "use")
      .replace(/\butilize\b/gi, "use")
      .replace(/\bin order to\b/gi, "to")
      .trim();
    return chunk(cleaned || (selection ?? ""));
  }

  if (mode === "continue") {
    const tail = firstSentences(currentText ?? "", 1);
    const text = tail
      ? ` The next step is to make this concrete — name who does what, and by when.`
      : `Start with the single point you most want the reader to take away.`;
    return chunk(text);
  }

  // mode === "write"
  const lead = goal?.trim() ? goal.trim().replace(/\.$/, "") : "Here is a first draft from your material";
  const ideas = material
    ? material.split(/\r?\n/).map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter((l) => l.length > 2).slice(0, 4)
    : [];
  const body = [
    `${lead}.`,
    ideas[0] ? `\n\n${ideas[0]}` : "",
    ideas[1] ? ` ${ideas[1]}` : "",
    ideas.length > 2 ? `\n\nA few specifics worth keeping:` : "",
    ...ideas.slice(2).map((i) => `\n- ${i}`),
    `\n\n_(Demo draft built locally from your input. Connect a model key for full drafting.)_`,
  ]
    .filter(Boolean)
    .join("");
  return chunk(body);
}
