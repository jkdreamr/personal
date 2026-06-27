/**
 * A ProseMirror decoration that keeps the "Improve selection" target visibly highlighted while the
 * Improve panel is open and the native text selection has moved to the panel's inputs. The range is
 * mapped through document changes so it never goes stale (rule: robust editor positions, not string
 * indexes).
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const improveHighlightKey = new PluginKey<{ from: number; to: number } | null>("improveHighlight");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    improveHighlight: {
      setImproveHighlight: (range: { from: number; to: number }) => ReturnType;
      clearImproveHighlight: () => ReturnType;
    };
  }
}

export const ImproveHighlight = Extension.create({
  name: "improveHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<{ from: number; to: number } | null>({
        key: improveHighlightKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(improveHighlightKey);
            if (meta !== undefined) return meta as { from: number; to: number } | null;
            if (value && tr.docChanged) {
              return { from: tr.mapping.map(value.from), to: tr.mapping.map(value.to) };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const range = improveHighlightKey.getState(state);
            if (!range || range.from >= range.to) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, { class: "rd-improve-target" }),
            ]);
          },
        },
      }),
    ];
  },
  addCommands() {
    return {
      setImproveHighlight:
        (range) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(improveHighlightKey, range));
          return true;
        },
      clearImproveHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(improveHighlightKey, null));
          return true;
        },
    };
  },
});
