// Privacy policy (ja/en/id). Content lives in messages.Privacy; styles reuse the FAQ terms block.
// What the policy says must match what the code does: the fields the reservation route forwards
// (app/api/reserve/route.ts), what GAS stores and when it anonymizes rows (gas-booking-automation),
// and the analytics loaded in app/[locale]/layout.tsx. Change them together.

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Privacy' });
    return { title: t('title'), description: t('description') };
}

export default function PrivacyPage() {
    const t = useTranslations('Privacy');
    const sections = t.raw('sections') as { title: string; items: string[] }[];

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

            <section className="v2-section">
                <div className="v2-faqp-body" style={{ maxWidth: 880, margin: '0 auto' }}>
                    {sections.map((s, i) => (
                        <section key={i} className="v2-faqp-group">
                            <div className="v2-faqp-group-head">
                                <span className="ic">{i + 1}</span>
                                <h2 className="t" style={{ margin: 0 }}>{s.title}</h2>
                            </div>
                            <div className="v2-faqp-terms-body">
                                <ul className="v2-terms-list">
                                    {s.items.map((item, j) => (
                                        <li key={j}>
                                            <span className="num">{i + 1}.{j + 1}</span>
                                            <span className="body">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>
                    ))}
                    <p className="v2-faqp-terms-lead" style={{ textAlign: 'right' }}>{t('updated')}</p>
                </div>
            </section>
        </main>
    );
}
