"use client";

import {
  PenLine,
  ListChecks,
  Presentation,
  FileText,
  Telescope,
  ShieldAlert,
  BadgeCheck,
  Columns3,
  Newspaper,
  Users,
  Scale,
  BookOpen,
  Library,
  Mic,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** Resolve a service/nav icon name to a Lucide component. Single, consistent icon family. */
const ICONS: Record<string, LucideIcon> = {
  PenLine,
  ListChecks,
  Presentation,
  FileText,
  Telescope,
  ShieldAlert,
  BadgeCheck,
  Columns3,
  Newspaper,
  Users,
  Scale,
  BookOpen,
  Library,
  Mic,
  Settings,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? FileText;
  return <Cmp className={className} strokeWidth={1.6} aria-hidden />;
}
