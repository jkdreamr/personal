import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SERVICE_LIST } from "@/lib/services";
import { HomeIntake } from "@/components/home/HomeIntake";
import { RecentWork } from "@/components/home/RecentWork";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">What are you working on?</h1>
        <p className="mt-2 text-base text-ink/65">Add something you have. Harbor takes it from there.</p>
      </header>

      <HomeIntake />

      <div className="mt-10">
        <RecentWork />
      </div>

      <details className="group mt-8">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Browse tools
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SERVICE_LIST.map((s) => (
            <Link
              key={s.id}
              href={`/${s.id}`}
              className="rounded-btn border border-line bg-canvas px-3 py-2.5 transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <span className="block text-sm font-medium text-ink">{s.label}</span>
              <span className="mt-0.5 block text-meta text-muted">{s.purpose}</span>
            </Link>
          ))}
        </div>
      </details>

      <p className="mt-10 text-meta text-muted">
        Private beta. Your work stays in this browser.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
          How Harbor handles it
        </Link>
        .
      </p>
    </div>
  );
}
