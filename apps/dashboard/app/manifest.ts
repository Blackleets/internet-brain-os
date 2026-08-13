import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Efesto · The Intelligence Forge',
    short_name: 'Efesto',
    description: 'Local-first Goal, Evidence and Find control center under Hephaestus Kernel authority.',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b0b0c',
    theme_color: '#0b0b0c',
    icons: [
      {
        src: '/efesto-smith.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
