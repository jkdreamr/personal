"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Mic, Settings, Shield } from "lucide-react";
import { SERVICE_GROUPS, servicesByGroup } from "@/lib/services";
import { ServiceIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const PERSONAL = [
  { href: "/library", label: "Library", Icon: Library },
  { href: "/voice", label: "Voice", Icon: Mic },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-canvas md:flex">
      <div className="px-5 pb-3 pt-5">
        <Link href="/" className="inline-flex items-baseline gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">Harbor</span>
        </Link>
        <p className="mt-1 text-meta text-muted">Make sense of the work in front of you.</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Services">
        {SERVICE_GROUPS.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="px-2 pb-1.5 pt-2 text-meta font-semibold uppercase tracking-wide text-muted">{group.label}</p>
            <ul className="space-y-0.5">
              {servicesByGroup(group.id).map((s) => {
                const href = `/${s.id}`;
                const active = pathname === href;
                return (
                  <li key={s.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-btn px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
                        active ? "bg-ink/[0.07] text-ink" : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
                      )}
                    >
                      <ServiceIcon name={s.icon} className={cn("h-[18px] w-[18px]", active ? "text-ink" : "text-ink/55")} />
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mb-2">
          <p className="px-2 pb-1.5 pt-2 text-meta font-semibold uppercase tracking-wide text-muted">Personal</p>
          <ul className="space-y-0.5">
            {PERSONAL.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-btn px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70",
                      active ? "bg-ink/[0.07] text-ink" : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] text-ink/55" strokeWidth={1.6} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line px-4 py-3">
        <Link
          href="/privacy"
          className="flex items-center gap-2 text-meta text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 rounded"
        >
          <Shield className="h-3.5 w-3.5" aria-hidden />
          Private beta · Privacy
        </Link>
      </div>
    </aside>
  );
}
