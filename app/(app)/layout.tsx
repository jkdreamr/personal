import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { Providers } from "@/components/providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-btn focus:bg-ink focus:px-3 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </Providers>
  );
}
