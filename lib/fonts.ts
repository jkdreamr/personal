import { Hanken_Grotesk, Newsreader } from "next/font/google";

// Body / UI: a warm humanist grotesque — legible and trustworthy, not Inter.
export const sans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

// Display only: an editorial serif for the rare large statement (home hero, slide titles).
export const display = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});
