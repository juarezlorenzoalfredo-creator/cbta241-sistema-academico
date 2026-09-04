import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: { default: 'Sistema Académico | CBTA 241', template: '%s | CBTA 241' },
  description: 'Sistema Académico Digital de Calificaciones del CBTA 241',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/institution/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/institution/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/institution/icon-192.png' }
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, themeColor: '#365b34', colorScheme: 'light'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <ServiceWorkerRegistration />
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
