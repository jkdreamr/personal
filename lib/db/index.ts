import Dexie, { type Table } from "dexie";
import type { Task, VoiceProfile, UsageBudget } from "@/lib/types";

/**
 * Local-first store. All user work lives here in the browser. No account, no server DB.
 * Tasks embed their attachments and artifact so a workspace is fully self-contained and
 * survives refreshes/restarts.
 */

export type Preference = { key: string; value: unknown };

export class HarborDB extends Dexie {
  tasks!: Table<Task, string>;
  voiceProfiles!: Table<VoiceProfile, string>;
  preferences!: Table<Preference, string>;
  budget!: Table<UsageBudget, string>;

  constructor() {
    super("harbor");
    this.version(1).stores({
      tasks: "id, workspaceId, service, updatedAt, createdAt",
      voiceProfiles: "id, updatedAt",
      preferences: "key",
      budget: "day",
    });
  }
}

let _db: HarborDB | null = null;

/** Lazily create the DB on the client only. */
export function db(): HarborDB {
  if (typeof window === "undefined") {
    throw new Error("HarborDB is only available in the browser.");
  }
  if (!_db) _db = new HarborDB();
  return _db;
}
