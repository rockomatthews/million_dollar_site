import type { Metadata } from "next";
import { AppProviders } from "@/lib/providers/AppProviders";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "millions.auction · Million Dollar Crypto Grid",
    template: "%s · millions.auction",
  },
  description:
    "Own a piece of the grid. 1,000,000 pixels, crypto checkout, settle in USDC. millions.auction",
  icons: {
    icon: "/millionsAuction.png",
    apple: "/millionsAuction.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "millions.auction",
    title: "millions.auction · Million Dollar Crypto Grid",
    description:
      "Own pixels on a 1000×1000 canvas. Pay with crypto, settle in USDC. The modern million-dollar homepage.",
    images: [
      {
        url: "/millionsAuction.png",
        alt: "millions.auction — Million Dollar Crypto Grid",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "millions.auction · Million Dollar Crypto Grid",
    description:
      "Own pixels on a 1000×1000 canvas. Pay with crypto, settle in USDC.",
    images: ["/millionsAuction.png"],
  },
  appleWebApp: {
    capable: true,
    title: "millions.auction",
    statusBarStyle: "black-translucent",
  },
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
