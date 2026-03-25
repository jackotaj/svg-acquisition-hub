import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SVG Acquisition Hub',
  description: 'Vehicle acquisition scheduling and routing for SVG Motors',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-50">
        <Sidebar />
        {/* Top bar (mobile) */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-20 h-12 bg-orange flex items-center justify-center">
          <span className="text-white font-semibold text-sm">
            SVG Acquisition Hub
          </span>
        </header>
        <main className="lg:ml-60 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
