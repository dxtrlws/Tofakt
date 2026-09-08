import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { AuthDisabledBanner } from "@/components/auth-disabled-banner";
import { isAuthDisabled } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#03141C",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Watchlog",
  description: "tofa plays, synced to Trakt, with timestamps you can trust.",
  applicationName: "Watchlog",
  appleWebApp: {
    capable: true,
    title: "Watchlog",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-base text-fg">
        {isAuthDisabled() ? <AuthDisabledBanner /> : null}
        {children}
      </body>
    </html>
  );
}
