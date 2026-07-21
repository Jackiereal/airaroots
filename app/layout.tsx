import type { Metadata } from 'next';
import { Rajdhani, Inter, Fraunces, Manrope } from 'next/font/google';
import './globals.css';

const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Marketing-page-only faces (homepage). The app shell (dashboard etc.) keeps
// Rajdhani/Inter — these are scoped to marketing via the --font-fraunces /
// --font-manrope variables, used only inside app/page.tsx.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Airaroots — Property Finance Manager',
  description: 'Multi-property P&L tracker for property owners and managers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script: apply saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${rajdhani.variable} ${inter.variable} ${fraunces.variable} ${manrope.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
