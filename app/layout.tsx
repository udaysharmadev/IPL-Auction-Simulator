import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";
import "./phase-one.css";
import "./phase-two.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ipl-auction.vercel.app"),
  title: {
    default: "IPL Auction Simulator 2027",
    template: "%s | IPL Auction Simulator"
  },
  description: "Build a championship IPL squad one bid at a time. Strategic auction simulation with AI-powered rival franchises, real player data, and immersive auction room experience.",
  keywords: ["IPL", "auction", "simulator", "cricket", "fantasy", "2027", "T20", "franchise"],
  authors: [{ name: "IPL Auction Simulator" }],
  creator: "IPL Auction Simulator",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://ipl-auction.vercel.app",
    siteName: "IPL Auction Simulator 2027",
    title: "IPL Auction Simulator 2027",
    description: "Build a championship IPL squad one bid at a time. Strategic auction simulation with AI-powered rival franchises.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "IPL Auction Simulator 2027"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "IPL Auction Simulator 2027",
    description: "Build a championship IPL squad one bid at a time.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#091015",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
