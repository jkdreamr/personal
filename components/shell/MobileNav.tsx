"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Settings, LayoutGrid } from "lucide-react";
import { SERVICE_GROUPS, servicesByGroup } from "@/lib/services";
import { ServiceIcon } from "@/components/ui/icon";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", Icon: Home, match: (p: string) => p === "/" },
  { href: "/library", label: "Library", Icon: Library, match: (p: string) => p.startsWith("/library") },
  { href: "/settings", label: "Settings", Icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {ITEMS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-meta font-medium focus-visible:outline-none",
              active ? "text-ink" : "text-muted"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
            {label}
          </Link>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-meta font-medium text-muted focus-visible:outline-none">
            <LayoutGrid className="h-5 w-5" strokeWidth={1.7} aria-hidden />
            Work
          </button>
        </DialogTrigger>
        <DialogContent className="top-auto bottom-0 left-0 w-full max-w-full -translate-x-0 -translate-y-0 rounded-b-none rounded-t-card">
          <DialogTitle>Start new work</DialogTitle>
          <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pb-2">
            {SERVICE_GROUPS.map((g) => (
              <div key={g.id}>
                <p className="pb-1.5 text-meta font-semibold text-muted">{g.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {servicesByGroup(g.id).map((s) => (
                    <Link
                      key={s.id}
                      href={`/${s.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/[0.05]"
                    >
                      <ServiceIcon name={s.icon} className="h-[18px] w-[18px] text-ink/60" />
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
