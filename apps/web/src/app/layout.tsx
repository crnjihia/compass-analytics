import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'Compass Analytics | M-Pesa Revenue & SME Intelligence',
  description: 'Production-grade multi-tenant analytics SaaS for Kenyan SMEs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
