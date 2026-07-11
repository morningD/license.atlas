import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LangProvider } from "@/lib/i18n";
import { NavProgress } from "@/components/nav-progress";
import { PageViewTracker } from "@/components/page-view-tracker";
import stats from "@/data/stats.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription = `Browse and explore ${stats.total} software, data, AI model, agent, and terms licenses, with OSI review tracking, OSADL checklist signals, and popularity trends.`;

export const metadata: Metadata = {
  title: "LicenseAtlas — Software, Data, AI Model, and Agent License Explorer",
  description: siteDescription,
  keywords: [
    "license", "open source license", "software license", "SPDX", "OSI", "Creative Commons",
    "MIT", "Apache", "GPL", "BSD", "AI model license", "data license",
    "开源许可证", "许可证大全", "许可图鉴", "软件许可证", "开源协议", "AI模型许可证", "数据许可证",
    "CC许可证", "GPL许可证", "MIT许可证",
  ],
  authors: [{ name: "morningD" }],
  metadataBase: new URL("https://morningd.github.io/license.atlas"),
  openGraph: {
    title: "LicenseAtlas — Software, Data, AI Model, and Agent License Explorer",
    description: siteDescription,
    url: "https://morningd.github.io/license.atlas",
    siteName: "LicenseAtlas",
    type: "website",
    locale: "en_US",
    alternateLocale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "LicenseAtlas",
    description: siteDescription,
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
    <>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "LicenseAtlas",
                alternateName: "许可图鉴",
                url: "https://morningd.github.io/license.atlas",
                description: siteDescription,
                inLanguage: ["en", "zh"],
                author: {
                  "@type": "Person",
                  name: "morningD",
                },
              }),
            }}
          />
        </head>
        <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
          <NavProgress />
          <LangProvider>
            <PageViewTracker />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </LangProvider>
        </body>
      </html>
    </>
  );
}
