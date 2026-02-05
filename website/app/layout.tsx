import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://leadrscribe.vercel.app"),
  title: "LeadrScribe - Free Offline Speech to Text",
  description:
    "Open source, 100% offline speech-to-text for Windows, macOS, and Linux. Your voice never leaves your device.",
  keywords: [
    "speech to text",
    "offline transcription",
    "voice typing",
    "dictation",
    "open source",
    "privacy",
    "whisper",
    "voice recognition",
    "free",
  ],
  authors: [{ name: "LeadrScribe" }],
  openGraph: {
    title: "LeadrScribe - Free Offline Speech to Text",
    description: "Your voice, your device. 100% offline transcription.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadrScribe - Free Offline Speech to Text",
    description: "Your voice, your device. 100% offline transcription.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
