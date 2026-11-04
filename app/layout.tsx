import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/inter-tight";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Intelligence Desk — Andrew Porter Fine Clothiers",
  description:
    "A Sirrom Studios concept demo: AI-assisted prospect research and decision support for Andrew Porter Fine Clothiers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
