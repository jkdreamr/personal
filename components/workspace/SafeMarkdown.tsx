"use client";

import * as React from "react";

/**
 * Render the restricted markdown Harbor uses in section bodies: paragraphs, "- " / "1." lists,
 * and **bold** / *italic* inline. No raw HTML is ever interpreted — content is untrusted.
 */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** and *italic* while keeping delimiters.
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) nodes.push(<strong key={`${keyBase}-b${i}`}>{token.slice(2, -2)}</strong>);
    else nodes.push(<em key={`${keyBase}-i${i}`}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function SafeMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(text ?? ""), [text]);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        if (block.type === "ul") {
          return (
            <ul key={bi}>
              {block.items.map((it, ii) => (
                <li key={ii}>{renderInline(it, `${bi}-${ii}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={bi}>
              {block.items.map((it, ii) => (
                <li key={ii}>{renderInline(it, `${bi}-${ii}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "h") {
          const Tag = (`h${block.level}` as "h2" | "h3");
          return <Tag key={bi}>{renderInline(block.text, `${bi}`)}</Tag>;
        }
        return <p key={bi}>{renderInline(block.text, `${bi}`)}</p>;
      })}
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "h"; level: 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: list.type, items: list.items });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "h", level: h[1].length === 2 ? 2 : 3, text: h[2] });
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    if (ol) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
