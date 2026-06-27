import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harbor — Make sense of the work in front of you",
  description:
    "Harbor turns the material already on your desk into clear work you can understand, edit, send, or act on. A calm, private-beta workbench.",
  applicationName: "Harbor",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F7F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
