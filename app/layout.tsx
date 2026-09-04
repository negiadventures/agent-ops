import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  // Without this, every relative Open Graph URL resolves against
  // whatever host served the page, including preview deployments.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  title: "Agent Ops · observability for coding agents",
  description:
    "A demo dashboard replaying simulated coding-agent runs: tool latency, token spend, policy gates, approvals and failures.",
};

export const viewport: Viewport = { themeColor: "#07080a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}<Analytics /></body>
    </html>
  );
}
