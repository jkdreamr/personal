/**
 * Inline markers for editorial suggestions — an underline decoration over each suggestion's target
 * range (Grammarly-style). Ranges are mapped through document edits so the markers follow the text;
 * the React layer re-resolves them from the target quote to detect staleness.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type SuggestionRange = { id: string; from: number; to: number };

export const suggestionMarksKey = new PluginKey<SuggestionRange[]>("suggestionMarks");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMarks: {
      setSuggestionRanges: (ranges: SuggestionRange[]) => ReturnType;
      clearSuggestionRanges: () => ReturnType;
    };
  }
}

export const SuggestionMarks = Extension.create({
  name: "suggestionMarks",
  addProseMirrorPlugins() {
    return [
      new Plugin<SuggestionRange[]>({
        key: suggestionMarksKey,
        state: {
          init: () => [],
          apply(tr, value) {
            const meta = tr.getMeta(suggestionMarksKey) as SuggestionRange[] | undefined;
            if (meta) return meta;
            if (value.length && tr.docChanged) {
              return value
                .map((r) => ({ id: r.id, from: tr.mapping.map(r.from), to: tr.mapping.map(r.to) }))
                .filter((r) => r.to > r.from);
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const ranges = suggestionMarksKey.getState(state);
            if (!ranges?.length) return null;
            return DecorationSet.create(
              state.doc,
              ranges.map((r) => Decoration.inline(r.from, r.to, { class: "rd-suggestion", "data-suggestion-id": r.id }))
            );
          },
        },
      }),
    ];
  },
  addCommands() {
    return {
      setSuggestionRanges:
        (ranges) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(suggestionMarksKey, ranges));
          return true;
        },
      clearSuggestionRanges:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(suggestionMarksKey, []));
          return true;
        },
    };
  },
});
