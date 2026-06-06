import type { Metadata } from "next";
import "../globals.css";
import "../globals.v2.css";        // V2 Bohemian Natural design system
import "../globals.v2.pages.css";  // V2 page-specific styles
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import Header from '../../components/common/Header';
import Footer from '../../components/common/Footer';
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';


type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Omit<Props, 'children'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata.Base' });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://puri-liang-residence.vercel.app';

  return {
    metadataBase: new URL(baseUrl),
    title: {
      template: `%s | ${t('siteName')}`,
      default: t('siteName'),
    },
    alternates: {
      canonical: '/',
      languages: {
        // 2026-05 update: id を alternates に追加
        'ja': '/ja',
        'en': '/en',
        'id': '/id',
      },
    },
    verification: {
      google: 'NaGMClFV2UBOpjtvmu5z3Mnf2Kj9jUdOvV_fRc8JG3Q',
    },
  };
}

export default async function RootLayout({
  children,
  params
}: Readonly<Props>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 2026-05 update: V2 Bohemian Natural の DM Serif Display + Outfit に変更
            Indonesian (id) も Noto Sans JP / Noto Serif JP でフォールバック可 */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Header />
          {/* V2 pages use their own .v2 wrapper which handles top spacing; the
              legacy 70px padding stays here for any page that still renders the
              legacy header styling. */}
          <div style={{ paddingTop: '0' }}>
            {children}
          </div>
          <Footer />
        </NextIntlClientProvider>
        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="clarity-script" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
