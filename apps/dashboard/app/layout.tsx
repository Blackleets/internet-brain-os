import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';
import './conversation-shell.css';
import './efesto-product.css';
import './efesto-product-compat.css';
import './efesto-forge-visual.css';
import './efesto-forge-redesign.css';
import './efesto-forge-live.css';
import './efesto-v3.css';
import './efesto-legibility.css';

const geist = localFont({ src: './fonts/Geist-Variable.ttf', variable: '--font-geist', weight: '100 900', display: 'swap' });
const geistMono = localFont({ src: './fonts/GeistMono-Variable.ttf', variable: '--font-geist-mono', weight: '100 900', display: 'swap' });

export const metadata: Metadata = {
  title: 'Efesto · The Intelligence Forge',
  description: 'Goal-first interface for evidence-backed missions, opportunities, agents and controlled memory under Hephaestus Kernel authority.',
  applicationName: 'Efesto',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Efesto',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b0c',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
