import type { Metadata } from "next";
import { AppProviders } from "@/lib/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Million Dollar Crypto Grid",
  description: "A one-million-pixel ad grid (1400px wide) marketplace powered by crypto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
