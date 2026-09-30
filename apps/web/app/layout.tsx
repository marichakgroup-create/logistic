import './globals.css';
import '@fontsource-variable/inter';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'LoadLink', template: '%s · LoadLink' },
  description: 'Find freight that fits your van along the route.',
  applicationName: 'LoadLink',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f8fb' };
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
