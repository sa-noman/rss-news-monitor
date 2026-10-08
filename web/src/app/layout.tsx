import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { fetchSources } from '@/lib/data';
import { t, UI_LANG } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_SITE_NAME ?? 'News Monitor — আন্তর্জাতিক সংবাদ এক জায়গায়',
    template: '%s · News Monitor',
  },
  description:
    'International news headlines aggregated from 18 public RSS feeds, refreshed every 30 minutes. Headlines, summaries and links only — never full articles.',
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { sources } = await fetchSources();
  const activeCount = sources.filter((s) => s.is_active).length;

  return (
    <html lang={UI_LANG === 'bn' ? 'bn' : 'en'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('news-monitor-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}" }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Header sourceCount={activeCount} query={{}} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <Footer sourceCount={activeCount} />
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
