import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { CurbTopBanner, CurbUpgradePopup } from '@/components/CurbUpgradeBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SVG Acquisition Hub',
  description: 'Vehicle acquisition scheduling and routing for SVG Motors',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground flex flex-col">
        <CurbTopBanner />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-auto bg-background">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">{children}</div>
          </main>
        </div>
        <CurbUpgradePopup />
      </body>
    </html>
  );
}
