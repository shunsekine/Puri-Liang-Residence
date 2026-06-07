// V2 Bohemian Natural — Reserve page (server wrapper)
// Pure server component for SEO metadata. The actual form lives in
// components/pages/ReserveForm.tsx as a client component.

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import ReserveForm from '@/components/pages/ReserveForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Reserve' });
    return { title: t('title'), description: t('description') };
}

export default function ReservePage() {
    const t = useTranslations('Reserve');
    return (
        <main className="v2">
            <section className="v2-rhero">
                <div className="eyebrow">{t('hero.eyebrow')}</div>
                <h1>
                    {t('hero.title1')}<br />
                    <em>{t('hero.emphasis')}</em>{t('hero.title2')}
                </h1>
                <p>{t('hero.lead')}</p>
            </section>

            <ReserveForm />
        </main>
    );
}
