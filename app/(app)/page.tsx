import Link from "next/link";
import { Shield } from "lucide-react";
import { SERVICE_GROUPS, servicesByGroup } from "@/lib/services";
import { ServiceIcon } from "@/components/ui/icon";
import { Eyebrow } from "@/components/ui/primitives";
import { HomeIntake } from "@/components/home/HomeIntake";
import { RecentWork } from "@/components/home/RecentWork";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <header className="mb-7">
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface px-2 py-0.5 text-meta font-medium text-muted">
          Private beta
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          What are you working on?
        </h1>
        <p className="mt-3 text-lead text-ink/70">
          Start with something you already have. Harbor will help you make it clear.
        </p>
      </header>

      <HomeIntake />

      <div className="mt-12 space-y-10">
        <section>
          <Eyebrow>Most-used services</Eyebrow>
          <div className="mt-3 space-y-6">
            {SERVICE_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-meta font-medium text-muted">{group.label}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {servicesByGroup(group.id).map((s) => (
                    <Link
                      key={s.id}
                      href={`/${s.id}`}
                      className="group flex items-start gap-3 rounded-card border border-line bg-canvas p-3.5 transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-line bg-surface">
                        <ServiceIcon name={s.icon} className="h-[18px] w-[18px] text-ink/70" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{s.label}</span>
                        <span className="mt-0.5 block text-meta text-muted">{s.purpose}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <RecentWork />

        <section className="rounded-card border border-line bg-surface/40 p-4">
          <p className="flex items-start gap-2 text-sm text-ink/80">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              Harbor is a private beta using free third-party providers. Your saved work stays in this browser unless you export it.{" "}
              <Link href="/privacy" className="font-medium text-ink underline underline-offset-2">
                How Harbor handles your work
              </Link>
              .
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
