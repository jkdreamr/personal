"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  SquareCode,
  Link2,
  Minus,
  Undo2,
  Redo2,
  Sigma,
  Type,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { WRITING_FONTS } from "@/lib/client/writing-fonts";
import { cn } from "@/lib/utils";

/** A single icon button. Toggles expose aria-pressed; all have a tooltip + accessible label. */
function TBtn({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      // Buttons inside the toolbar must not steal the editor selection on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-ink/80 transition-colors",
        "hover:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
        active && "bg-ink/[0.10] text-ink",
        disabled && "opacity-40"
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-line" />;
}

/** Formatting toolbar bound to a Tiptap editor. Compact; scrolls horizontally on small screens. */
export function EditorToolbar({ editor, className }: { editor: Editor | null; className?: string }) {
  // Re-render on every editor transaction so active states stay in sync.
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!editor) return;
    editor.on("transaction", force);
    editor.on("selectionUpdate", force);
    return () => {
      editor.off("transaction", force);
      editor.off("selectionUpdate", force);
    };
  }, [editor]);

  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");

  if (!editor) return null;
  const can = editor.can();

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) editor.chain().focus().setLink({ href: url }).run();
    else editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
    setLinkUrl("");
  };

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className={cn(
        "no-print flex items-center gap-0.5 overflow-x-auto rounded-t-card border border-b-0 border-line bg-canvas/80 px-1.5 py-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]{display:none}",
        className
      )}
    >
      <TBtn icon={Undo2} label="Undo" shortcut="⌘Z" onClick={() => editor.chain().focus().undo().run()} disabled={!can.undo()} />
      <TBtn icon={Redo2} label="Redo" shortcut="⌘⇧Z" onClick={() => editor.chain().focus().redo().run()} disabled={!can.redo()} />
      <Divider />
      <TBtn icon={Heading1} label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} />
      <TBtn icon={Heading2} label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} />
      <TBtn icon={Heading3} label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} />
      <Divider />
      <TBtn icon={Bold} label="Bold" shortcut="⌘B" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} />
      <TBtn icon={Italic} label="Italic" shortcut="⌘I" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} />
      <TBtn icon={Underline} label="Underline" shortcut="⌘U" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} />
      <TBtn icon={Strikethrough} label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} />
      <TBtn icon={Code} label="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} />
      <Divider />
      <TBtn icon={List} label="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} />
      <TBtn icon={ListOrdered} label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} />
      <TBtn icon={ListChecks} label="Checklist" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} />
      <Divider />
      <TBtn icon={Quote} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} />
      <TBtn icon={SquareCode} label="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} />
      <TBtn icon={Minus} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <TBtn
        icon={Sigma}
        label="Insert math"
        onClick={() => editor.chain().focus().insertInlineMath({ latex: "x" }).run()}
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Font for selected text"
            title="Font (selected text)"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-ink/80 hover:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            <Type className="h-[18px] w-[18px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52">
          <p className="px-2 pb-1 text-meta text-muted">Font for the selected text</p>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetFontFamily().run()}
            className="flex w-full items-center rounded-btn px-2.5 py-1.5 text-left text-sm text-ink hover:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            Default
          </button>
          {WRITING_FONTS.map((f) => {
            const active = editor.getAttributes("textStyle").fontFamily === f.stack;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => editor.chain().focus().setFontFamily(f.stack).run()}
                aria-pressed={active}
                style={{ fontFamily: f.stack }}
                className={cn(
                  "flex w-full items-center rounded-btn px-2.5 py-1.5 text-left text-sm text-ink hover:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
                  active && "bg-ink/[0.08] font-medium"
                )}
              >
                {f.label.replace(" (default)", "")}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <Popover
        open={linkOpen}
        onOpenChange={(o) => {
          setLinkOpen(o);
          if (o) setLinkUrl((editor.getAttributes("link").href as string) ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Add or edit link"
            aria-pressed={editor.isActive("link")}
            title="Link (⌘K)"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-ink/80 hover:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
              editor.isActive("link") && "bg-ink/[0.10] text-ink"
            )}
          >
            <Link2 className="h-[18px] w-[18px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <label className="mb-1 block text-meta text-muted" htmlFor="rd-link-url">
            Link URL
          </label>
          <div className="flex gap-1.5">
            <input
              id="rd-link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
              placeholder="https://…"
              inputMode="url"
              className="min-w-0 flex-1 rounded-btn border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            />
            <Button size="sm" onClick={applyLink}>
              {linkUrl.trim() ? "Apply" : "Remove"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
