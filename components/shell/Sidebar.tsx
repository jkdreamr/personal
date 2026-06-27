"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Mic, Settings, ChevronDown } from "lucide-react";
import { SERVICE_LIST } from "@/lib/services";
import { cn } from "@/lib/utils";

const TOP = [
  { href: "/", label: "Home", Icon: Home, match: (p: string) => p === "/" },
  { href: "/library", label: "Library", Icon: Library, match: (p: string) => p.startsWith("/library") },
];

const BOTTOM = [
  { href: "/voice", label: "Voice", Icon: Mic },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = React.useState(true);

  // Remember whether Tools is collapsed.
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("harbor.toolsOpen") : null;
    if (saved != null) setToolsOpen(saved === "1");
  }, []);
  const toggleTools = () => {
    setToolsOpen((o) => {
      const next = !o;
      try {
        window.localStorage.setItem("harbor.toolsOpen", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const rowBase =
    "flex items-center gap-2.5 rounded-btn px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70";

  return (
    <aside className="hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-canvas md:flex">
      <div className="px-4 pb-2 pt-5">
        <Link href="/" className="rounded text-lg font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
          Harbor
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Main">
        <ul className="space-y-0.5">
          {TOP.map(({ href, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn(rowBase, active ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/75 hover:bg-ink/[0.05] hover:text-ink")}>
                  <Icon className="h-[18px] w-[18px] text-ink/55" strokeWidth={1.6} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-4">
          <button
            onClick={toggleTools}
            aria-expanded={toolsOpen}
            className="flex w-full items-center gap-1 rounded px-2.5 py-1 text-meta font-medium text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !toolsOpen && "-rotate-90")} />
            Tools
          </button>
          {toolsOpen && (
            <ul className="mt-0.5 space-y-px">
              {SERVICE_LIST.map((s) => {
                const href = `/${s.id}`;
                const active = pathname === href;
                return (
                  <li key={s.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn("block rounded-btn px-2.5 py-1.5 pl-7 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70", active ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink")}
                    >
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-line px-2.5 py-2">
        <ul className="space-y-0.5">
          {BOTTOM.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn(rowBase, "text-meta", active ? "font-medium text-ink" : "text-muted hover:text-ink")}>
                  <Icon className="h-4 w-4" strokeWidth={1.6} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/privacy" className="mt-1 block rounded px-2.5 py-1 text-meta text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70">
          Private beta · Privacy
        </Link>
      </div>
    </aside>
  );
}
