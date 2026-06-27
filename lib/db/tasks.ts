import type { ServiceId } from "@/lib/services";
import type { Artifact, Attachment, Adjustments, Task, VoiceProfile, UsageBudget } from "@/lib/types";
import { uid } from "@/lib/utils";
import { db, type Preference } from "./index";

/** Create a fresh task (also acts as its own workspace for V1 simplicity). */
export function newTask(service: ServiceId, partial?: Partial<Task>): Task {
  const now = new Date().toISOString();
  const id = partial?.id ?? uid("task");
  return {
    id,
    workspaceId: partial?.workspaceId ?? id,
    service,
    title: partial?.title ?? "Untitled",
    goal: partial?.goal ?? "",
    attachments: partial?.attachments ?? [],
    adjustments: partial?.adjustments ?? {},
    artifact: partial?.artifact,
    editedBody: partial?.editedBody,
    state: partial?.state ?? "idle",
    error: partial?.error,
    createdAt: partial?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function saveTask(task: Task): Promise<void> {
  task.updatedAt = new Date().toISOString();
  // Storage-quota errors must never silently lose work — surface to caller.
  await db().tasks.put(task);
}

export async function getTask(id: string): Promise<Task | undefined> {
  return db().tasks.get(id);
}

export async function listTasks(): Promise<Task[]> {
  return db().tasks.orderBy("updatedAt").reverse().toArray();
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const existing = await db().tasks.get(id);
  await db().tasks.delete(id);
  return existing; // returned so the UI can offer Undo
}

export async function duplicateTask(id: string): Promise<Task | undefined> {
  const existing = await db().tasks.get(id);
  if (!existing) return undefined;
  const copy = newTask(existing.service, {
    ...existing,
    id: uid("task"),
    workspaceId: uid("ws"),
    title: `${existing.title} (copy)`,
    state: existing.artifact ? "done" : "idle",
  });
  copy.workspaceId = copy.id;
  await saveTask(copy);
  return copy;
}

// ---- Voice profiles ----
export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  return db().voiceProfiles.orderBy("updatedAt").reverse().toArray();
}
export async function saveVoiceProfile(p: VoiceProfile): Promise<void> {
  p.updatedAt = new Date().toISOString();
  await db().voiceProfiles.put(p);
}
export async function deleteVoiceProfile(id: string): Promise<void> {
  await db().voiceProfiles.delete(id);
}

// ---- Preferences ----
export async function getPreference<T>(key: string, fallback: T): Promise<T> {
  const row = (await db().preferences.get(key)) as Preference | undefined;
  return row ? (row.value as T) : fallback;
}
export async function setPreference(key: string, value: unknown): Promise<void> {
  await db().preferences.put({ key, value });
}

// ---- Usage budget (per browser, per day) ----
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export async function getBudget(limit: number): Promise<UsageBudget> {
  const day = today();
  const existing = await db().budget.get(day);
  if (existing) return { ...existing, limit };
  const fresh: UsageBudget = { day, used: 0, limit };
  await db().budget.put(fresh);
  return fresh;
}
export async function incrementBudget(limit: number): Promise<UsageBudget> {
  const day = today();
  const current = await getBudget(limit);
  const next: UsageBudget = { day, used: current.used + 1, limit };
  await db().budget.put(next);
  return next;
}

// ---- Backup / restore ----
export type HarborBackup = {
  kind: "harbor-backup";
  version: 1;
  exportedAt: string;
  tasks: Task[];
  voiceProfiles: VoiceProfile[];
  preferences: Preference[];
};

export async function exportAll(): Promise<HarborBackup> {
  const [tasks, voiceProfiles, preferences] = await Promise.all([
    db().tasks.toArray(),
    db().voiceProfiles.toArray(),
    db().preferences.toArray() as Promise<Preference[]>,
  ]);
  return { kind: "harbor-backup", version: 1, exportedAt: new Date().toISOString(), tasks, voiceProfiles, preferences };
}

export async function importAll(backup: HarborBackup): Promise<{ tasks: number }> {
  if (backup?.kind !== "harbor-backup") throw new Error("That file isn't a Harbor backup.");
  await db().transaction("rw", db().tasks, db().voiceProfiles, db().preferences, async () => {
    if (backup.tasks?.length) await db().tasks.bulkPut(backup.tasks);
    if (backup.voiceProfiles?.length) await db().voiceProfiles.bulkPut(backup.voiceProfiles);
    if (backup.preferences?.length) await db().preferences.bulkPut(backup.preferences);
  });
  return { tasks: backup.tasks?.length ?? 0 };
}

export type { Artifact, Attachment, Adjustments };
