import type { VoiceProfile } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Local-only voice profiles. Strict opt-in: a profile is only ever applied when it both
 * exists, is `enabled`, AND the user confirmed it for this task. We never claim perfect
 * voice imitation, and "No voice profile" is always available.
 */

export const MAX_SAMPLES = 5;

export function emptyVoiceProfile(name = "My voice"): VoiceProfile {
  const now = new Date().toISOString();
  return {
    id: uid("voice"),
    name,
    enabled: false,
    directness: 60,
    formality: 50,
    warmth: 55,
    confidence: 60,
    sentenceLength: "medium",
    favoritePhrases: [],
    wordsToAvoid: [],
    samples: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Decide whether a profile may be used for a task. Requires explicit opt-in at BOTH the
 * profile level (`enabled`) and the task level (`confirmedForTask`).
 */
export function canUseVoiceProfile(profile: VoiceProfile | null | undefined, confirmedForTask: boolean): boolean {
  return Boolean(profile && profile.enabled && confirmedForTask);
}

/**
 * Suggest editable preferences from writing samples. These are SUGGESTIONS the user can
 * edit or reject — nothing is auto-applied. Heuristic and transparent (no model needed).
 */
export function suggestFromSamples(samples: string[]): Partial<VoiceProfile> {
  const text = samples.join("\n").trim();
  if (!text) return {};
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const avgWords = sentences.length
    ? Math.round(sentences.reduce((n, s) => n + s.trim().split(/\s+/).length, 0) / sentences.length)
    : 0;
  const sentenceLength: VoiceProfile["sentenceLength"] = avgWords <= 12 ? "short" : avgWords >= 22 ? "long" : "medium";

  // Greeting / sign-off detection (very light touch).
  const greetMatch = text.match(/^(hi|hello|hey|dear)\b[^\n]{0,30}/i);
  const signMatch = text.match(/\b(best|regards|thanks|cheers|sincerely)[^\n]{0,30}$/im);

  const formality = /\b(regards|sincerely|dear|furthermore|kindly)\b/i.test(text) ? 70 : /\b(hey|cheers|gonna|yeah)\b/i.test(text) ? 35 : 50;

  return {
    sentenceLength,
    formality,
    greeting: greetMatch ? greetMatch[0].trim() : undefined,
    signoff: signMatch ? signMatch[0].trim() : undefined,
  };
}
