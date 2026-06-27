/**
 * Cursor-anchored ghost-text autocomplete. A subtle grey suggestion is rendered as a widget
 * decoration AT the caret (not appended to the document end), accepted with Tab and dismissed with
 * Esc. The suggestion is anchored to a position and invalidated the moment the document changes or
 * the caret moves, so a stale completion can never be inserted. When no ghost is showing, Tab falls
 * through to normal editor behavior (e.g. list indentation).
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type GhostState = { text: string; pos: number } | null;

export const ghostKey = new PluginKey<GhostState>("ghostText");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ghostText: {
      setGhostText: (text: string) => ReturnType;
      clearGhostText: () => ReturnType;
      acceptGhostText: () => ReturnType;
    };
  }
}

export const GhostText = Extension.create({
  name: "ghostText",
  // Run our Tab/Escape before list-indent and other handlers so we can decide first.
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostState>({
        key: ghostKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(ghostKey) as GhostState | undefined;
            if (meta !== undefined) return meta; // explicit set (object) or clear (null)
            if (!value) return null;
            // Typing or a caret move invalidates a stale suggestion.
            if (tr.docChanged) return null;
            if (tr.selection.head !== value.pos) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const g = ghostKey.getState(state);
            if (!g || !g.text || !state.selection.empty || state.selection.head !== g.pos) return null;
            const span = document.createElement("span");
            span.className = "rd-ghost-text";
            span.textContent = g.text;
            span.setAttribute("aria-hidden", "true");
            // side:1 places the widget after the caret on the same line.
            return DecorationSet.create(state.doc, [Decoration.widget(g.pos, span, { side: 1, marks: [] })]);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setGhostText:
        (text) =>
        ({ state, tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(ghostKey, { text, pos: state.selection.head }).setMeta("addToHistory", false));
          return true;
        },
      clearGhostText:
        () =>
        ({ state, tr, dispatch }) => {
          if (!ghostKey.getState(state)) return false;
          if (dispatch) dispatch(tr.setMeta(ghostKey, null).setMeta("addToHistory", false));
          return true;
        },
      acceptGhostText:
        () =>
        ({ state, tr, dispatch }) => {
          const g = ghostKey.getState(state);
          if (!g || !g.text) return false;
          if (dispatch) {
            tr.setMeta(ghostKey, null);
            tr.insertText(g.text, g.pos);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!ghostKey.getState(this.editor.state)) return false; // let list indentation handle Tab
        return this.editor.commands.acceptGhostText();
      },
      Escape: () => {
        if (!ghostKey.getState(this.editor.state)) return false;
        return this.editor.commands.clearGhostText();
      },
    };
  },
});

/** Read the current ghost suggestion (if any) from an editor state — used by tests/orchestration. */
export function currentGhost(state: Parameters<typeof ghostKey.getState>[0]): GhostState {
  return ghostKey.getState(state) ?? null;
}
