import './globals.css';
import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
const manrope=localFont({src:'../../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',weight:'200 800',style:'normal',variable:'--font-manrope',display:'swap'});

export const metadata: Metadata = {
  title: { default: 'LoadLink', template: '%s · LoadLink' },
  description: 'Find freight that fits your van along the route.',
  applicationName: 'LoadLink',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F8F6' };
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" className={manrope.variable}><body>{children}</body></html>;
}
