"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function AccessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.replace(next.startsWith("/") ? next : "/");
        router.refresh();
      } else {
        setError(data.error || "That access code wasn't recognized.");
      }
    } catch {
      setError("Couldn't reach Harbor. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-7 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-card border border-line bg-surface">
          <Anchor className="h-6 w-6 text-ink" strokeWidth={1.6} />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Harbor</h1>
        <p className="mt-1.5 text-sm text-muted">Private beta. Enter your access code to continue.</p>
      </div>

      <Label htmlFor="code">Access code</Label>
      <Input
        id="code"
        type="password"
        autoFocus
        autoComplete="off"
        className="mt-1.5"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "code-error" : undefined}
      />
      {error && (
        <p id="code-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" className="mt-4 w-full" loading={loading} disabled={!code.trim()}>
        Enter
      </Button>

      <p className="mt-5 text-center text-meta text-muted">
        Harbor is a calm workbench for the work already on your desk. Your work stays in your browser.
      </p>
    </form>
  );
}

export default function AccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Suspense fallback={null}>
        <AccessForm />
      </Suspense>
    </main>
  );
}
