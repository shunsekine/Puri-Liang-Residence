// V2 Bohemian Natural — Terms & Conditions page
// Server component — exports generateMetadata.
// Renders the 11 clauses from messages.Terms.items as a numbered list.

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    try {
        const t = await getTranslations({ locale, namespace: 'Metadata.Terms' });
        return { title: t('title'), description: t('description') };
    } catch {
        const t = await getTranslations({ locale, namespace: 'Metadata.Base' });
        return { title: `Terms & Conditions | ${t('siteName')}` };
    }
}

export default function TermsPage() {
    const t = useTranslations('Terms');
    const items = t.raw('items') as string[];

    return (
        <main className="v2">
            <section className="v2-rhero">
                <div className="eyebrow">{t('hero.eyebrow')}</div>
                <h1>{t('hero.title')}</h1>
                <p>{t('hero.lead')}</p>
            </section>

            <section className="v2-section">
                <div className="v2-terms">
                    <ol className="v2-terms-list">
                        {items.map((item, i) => (
                            <li key={i}>
                                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                                <span className="body">{item}</span>
                            </li>
                        ))}
                    </ol>

                    <div className="v2-terms-foot">
                        <p>{t('footNote')}</p>
                        <Link href="/reserve" className="v2-btn outline">
                            {t('footCta')}
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
