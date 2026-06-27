"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { VoiceProfile } from "@/lib/types";
import { listVoiceProfiles, saveVoiceProfile, deleteVoiceProfile } from "@/lib/db/tasks";
import { emptyVoiceProfile, suggestFromSamples, MAX_SAMPLES } from "@/lib/editorial/voice-profile";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, HelperText } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-meta text-muted">{label}</Label>
        <span className="text-meta text-muted tnum">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--harbor-ink)]"
        aria-label={label}
      />
    </div>
  );
}

export default function VoicePage() {
  const profiles = useLiveQuery(() => listVoiceProfiles(), [], undefined);
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<VoiceProfile | null>(null);

  const startNew = () => setEditing(emptyVoiceProfile());
  const save = async () => {
    if (!editing) return;
    await saveVoiceProfile(editing);
    toast({ title: "Voice profile saved", description: "Stored only in this browser.", tone: "success" });
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Voice</h1>
      <p className="mt-1 text-sm text-muted">
        Optional. Teach Harbor how you like to write. Profiles are stored only in this browser and used only when you turn
        them on for a task. Harbor never claims to copy your voice perfectly.
      </p>

      {!editing && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <Eyebrow>Your profiles</Eyebrow>
            <Button size="sm" variant="secondary" onClick={startNew}>
              <Plus className="h-4 w-4" /> New profile
            </Button>
          </div>

          {profiles && profiles.length > 0 ? (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 bg-canvas px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-meta text-muted">{p.enabled ? "On" : "Off"} · {p.samples?.length ?? 0} samples</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label="Delete profile"
                      onClick={() => deleteVoiceProfile(p.id).then(() => toast({ title: "Profile deleted." }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-card border border-dashed border-line bg-surface/40 p-6 text-sm text-muted">
              No voice profiles yet. Harbor writes in a clear, neutral voice by default — a profile is entirely optional.
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-6 space-y-5 rounded-card border border-line bg-canvas p-5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                className="h-4 w-4 accent-[var(--harbor-ink)]"
              />
              Turn this profile on
            </Label>
          </div>
          <HelperText>Even when on, Harbor only applies it to a task after you confirm — and you can always choose “No voice profile”.</HelperText>

          <div>
            <Label htmlFor="vp-name">Name</Label>
            <Input id="vp-name" className="mt-1.5" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vp-greeting">Preferred greeting</Label>
              <Input id="vp-greeting" className="mt-1.5" placeholder="Hi {name}," value={editing.greeting ?? ""} onChange={(e) => setEditing({ ...editing, greeting: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="vp-signoff">Preferred sign-off</Label>
              <Input id="vp-signoff" className="mt-1.5" placeholder="Best," value={editing.signoff ?? ""} onChange={(e) => setEditing({ ...editing, signoff: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Slider label="Directness" value={editing.directness ?? 60} onChange={(n) => setEditing({ ...editing, directness: n })} />
            <Slider label="Formality" value={editing.formality ?? 50} onChange={(n) => setEditing({ ...editing, formality: n })} />
            <Slider label="Warmth" value={editing.warmth ?? 55} onChange={(n) => setEditing({ ...editing, warmth: n })} />
            <Slider label="Confidence" value={editing.confidence ?? 60} onChange={(n) => setEditing({ ...editing, confidence: n })} />
          </div>

          <div>
            <Label htmlFor="vp-avoid">Words to avoid (comma separated)</Label>
            <Input
              id="vp-avoid"
              className="mt-1.5"
              value={(editing.wordsToAvoid ?? []).join(", ")}
              onChange={(e) => setEditing({ ...editing, wordsToAvoid: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="vp-sample">Writing sample (up to {MAX_SAMPLES})</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const s = suggestFromSamples(editing.samples ?? []);
                  setEditing({ ...editing, ...s });
                  toast({ title: "Filled in suggestions", description: "Edit anything that isn't right." });
                }}
              >
                <Wand2 className="h-4 w-4" /> Suggest settings
              </Button>
            </div>
            <Textarea
              id="vp-sample"
              className="mt-1.5 min-h-[120px]"
              placeholder="Paste something you wrote that sounds like you…"
              value={editing.samples?.[0] ?? ""}
              onChange={(e) => setEditing({ ...editing, samples: [e.target.value] })}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
