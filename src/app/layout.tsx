import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ApkForge — Build Android APKs Without Coding",
  description: "Turn your website or code into an Android APK in minutes. Online code editor, templates store, instant builds — no coding required.",
  keywords: ["ApkForge", "APK builder", "webview app", "HTML to APK", "Kotlin", "no-code", "Android"],
  authors: [{ name: "ApkForge" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ApkForge — Build Android APKs Without Coding",
    description: "Turn your website or code into an Android APK in minutes.",
    siteName: "ApkForge",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
