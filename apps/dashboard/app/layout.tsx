import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './conversation-shell.css';
import './efesto-product.css';
import './efesto-product-compat.css';

export const metadata: Metadata = {
  title: 'Efesto · The Intelligence Forge',
  description: 'Goal-first interface for evidence-backed missions, opportunities, agents and controlled memory under Hephaestus Kernel authority.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
