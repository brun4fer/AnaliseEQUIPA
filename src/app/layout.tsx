import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/app-shell";
import { PwaRegistrar } from "@/components/pwa-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feirense — Team Analysis",
  description: "Moments, submoments, video and occurrence maps.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = { themeColor: "#0b281d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegistrar /><AppShell>{children}</AppShell></body></html>;
}
