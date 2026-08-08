import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './conversation-shell.css';

export const metadata: Metadata = {
  title: 'Efesto · Hephaestus Control Center',
  description: 'Interfaz local-first para conversar con modelos, dirigir Hermes y auditar evidencia bajo autoridad del Kernel.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
