// V2 Bohemian Natural — FAQ page (NEW in V2)
// Server component — exports generateMetadata.
// Renders into a client component for the accordion behavior.

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { FAQ_CATEGORIES, type FAQCategory } from '@/lib/data';
import FAQAccordionItem from '@/components/pages/v2/FAQAccordionItem';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    // Phase 2.1 — until Metadata.FAQ is added to messages, fall back to Base.
    try {
        const t = await getTranslations({ locale, namespace: 'Metadata.FAQ' });
        return { title: t('title'), description: t('description') };
    } catch {
        const t = await getTranslations({ locale, namespace: 'Metadata.Base' });
        return { title: `FAQ | ${t('siteName')}` };
    }
}

interface FAQItem { category: FAQCategory; q: string; a: string; }

export default function FAQPage() {
    const t = useTranslations('FAQ');
    const items = t.raw('items') as FAQItem[];

    const byCategory = new Map<FAQCategory, FAQItem[]>();
    for (const cat of FAQ_CATEGORIES) byCategory.set(cat.id, []);
    for (const item of items) byCategory.get(item.category)?.push(item);

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
                <div className="v2-faqp-wrap">
                    {/* Side anchor nav */}
                    <aside className="v2-faqp-nav">
                        <div className="v2-faqp-nav-head">{t('sideNav.head')}</div>
                        {FAQ_CATEGORIES.map(g => {
                            const count = byCategory.get(g.id)?.length ?? 0;
                            return (
                                <a key={g.id} href={`#faq-${g.id}`} className="v2-faqp-nav-item">
                                    <span className="ic">{g.icon}</span>
                                    <span className="l">{t(`categories.${g.id}`)}</span>
                                    <span className="c">{count}</span>
                                </a>
                            );
                        })}
                        <div className="v2-faqp-nav-cta">
                            <div className="t">{t('sideNav.ctaTitle')}</div>
                            <div className="e">{t('sideNav.ctaTarget')}</div>
                            <div className="s">{t('sideNav.ctaSubtitle')}</div>
                            <Link href="/reserve" className="v2-faqp-nav-cta-btn">
                                {t('sideNav.ctaButton')}
                            </Link>
                        </div>
                    </aside>

                    {/* Grouped FAQ accordion */}
                    <div className="v2-faqp-body">
                        {FAQ_CATEGORIES.map(g => {
                            const groupItems = byCategory.get(g.id) ?? [];
                            if (groupItems.length === 0) return null;
                            return (
                                <section key={g.id} id={`faq-${g.id}`} className="v2-faqp-group">
                                    <div className="v2-faqp-group-head">
                                        <span className="ic">{g.icon}</span>
                                        <div>
                                            <div className="t">{t(`categories.${g.id}`)}</div>
                                            <div className="c">{groupItems.length}</div>
                                        </div>
                                    </div>
                                    <div className="v2-faqp-items">
                                        {groupItems.map((it, i) => (
                                            <FAQAccordionItem key={i} item={it} index={i} />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            </section>
        </main>
    );
}
