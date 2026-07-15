import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Intelligence OS",
  description: "Deterministic travel planner and routes orchestrator.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full"
      style={{
        // Fallback font variables bypass offline google font download limits during build
        ["--font-heading" as any]: "Outfit, system-ui, sans-serif",
        ["--font-sans" as any]: "Inter, system-ui, sans-serif",
      }}
    >
      <body className="h-full bg-background text-foreground font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
