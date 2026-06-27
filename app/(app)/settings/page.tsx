"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Mail, ShieldOff, Database, LogOut } from "lucide-react";
import { getBudget } from "@/lib/db/tasks";
import { db } from "@/lib/db";
import { FREE_DAILY_TASK_BUDGET } from "@/lib/client/config";
import { Button } from "@/components/ui/button";
import { Badge, Eyebrow } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Health = { demo: boolean; gateEnabled: boolean; dailyBudget: number; searchProvider: string; search: string };

const SEARCH_LABEL: Record<string, string> = {
  none: "off",
  wikipedia: "Wikipedia (key-less). Add a Brave key for full web results.",
  brave: "Brave (full web)",
  duckduckgo: "DuckDuckGo (often blocked from servers)",
};

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [health, setHealth] = React.useState<Health | null>(null);
  const budget = useLiveQuery(() => getBudget(FREE_DAILY_TASK_BUDGET), [], undefined);
  const [confirmClear, setConfirmClear] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const remaining = budget ? Math.max(0, budget.limit - budget.used) : null;

  const clearAll = async () => {
    await db().delete();
    setConfirmClear(false);
    toast({ title: "Local data cleared", description: "This browser no longer holds any Harbor work." });
    setTimeout(() => location.reload(), 600);
  };

  const signOut = async () => {
    await fetch("/api/access", { method: "DELETE" }).catch(() => {});
    router.push("/access");
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-muted">Harbor keeps your work in this browser. There&apos;s nothing to configure to get started.</p>

      <div className="mt-6 space-y-4">
        <section className="rounded-card border border-line bg-canvas p-4">
          <Eyebrow>Status</Eyebrow>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{health?.demo ? "Demo mode" : "Connected to a model"}</p>
              <p className="text-meta text-muted">
                {health?.demo
                  ? "Results are built locally from your input. Add an OpenRouter key to enable full drafting and research."
                  : "Harbor is using its free model providers. Availability and speed can vary."}
              </p>
            </div>
            <Badge tone={health?.demo ? "warning" : "success"}>{health?.demo ? "Demo" : "Live"}</Badge>
          </div>
          {health && (
            <p className="mt-3 border-t border-line pt-3 text-meta text-muted">
              Web search: <span className="text-ink">{SEARCH_LABEL[health.search] ?? health.search}</span>
            </p>
          )}
          {remaining !== null && (
            <p className="mt-2 text-meta text-muted">
              Today&apos;s usage: <span className="tnum text-ink">{budget?.used ?? 0}</span> of{" "}
              <span className="tnum">{budget?.limit}</span> tasks. This is a soft daily limit for the free beta.
            </p>
          )}
        </section>

        <section className="rounded-card border border-line bg-canvas p-4">
          <Eyebrow>Integrations</Eyebrow>
          <div className="mt-2 flex items-center justify-between opacity-70">
            <div className="flex items-center gap-2.5">
              <Mail className="h-5 w-5 text-muted" />
              <div>
                <p className="text-sm font-medium text-ink">Gmail</p>
                <p className="text-meta text-muted">Bring email context in directly.</p>
              </div>
            </div>
            <Badge tone="neutral">Coming later</Badge>
          </div>
          <p className="mt-2 text-meta text-muted">
            For now, paste email text or upload an .eml file. Harbor never sends email on your behalf.
          </p>
        </section>

        <section className="rounded-card border border-line bg-canvas p-4">
          <Eyebrow>Your data</Eyebrow>
          <div className="mt-2 space-y-2 text-sm text-ink/80">
            <p className="flex items-start gap-2">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              All your work is stored locally in this browser. Back it up or move it between devices from the{" "}
              <Link href="/library" className="font-medium text-ink underline underline-offset-2">
                Library
              </Link>
              .
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
              <ShieldOff className="h-4 w-4" /> Clear all local data
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out of private beta
            </Button>
          </div>
        </section>

        <p className="text-meta text-muted">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            Read how Harbor handles your work
          </Link>
        </p>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogTitle>Clear all local data?</DialogTitle>
          <DialogDescription>
            This permanently removes every saved task, voice profile, and preference from this browser. Export a backup
            first if you want to keep anything. This can&apos;t be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Keep my work
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={clearAll}>
              Clear everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
