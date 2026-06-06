// V2 Bohemian Natural — Home page
// Sections: Hero / Manifesto / Story / Rooms preview / Amenities / Trust band / CTA
// (Workspace section removed per V2 2026-05.)

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { ROOMS, IMG } from '@/lib/data';
import RoomPreviewCard from '@/components/pages/v2/RoomPreviewCard';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Home' });
    return { title: t('title'), description: t('description') };
}

export default function HomePage() {
    const t = useTranslations('Home');
    const tCommon = useTranslations('Common');
    const tBrand = useTranslations('Brand');

    return (
        <main className="v2">
            {/* ── Hero ───────────────────────────────────────────────── */}
            <section className="v2-hero">
                <div className="v2-hero-frame">
                    <div className="v2-hero-img" style={{ backgroundImage: `url(${IMG.hero})` }} />
                    <div className="v2-hero-text">
                        <div>
                            <div className="badge">
                                <span className="dot" />
                                {t('hero.badge')}
                            </div>
                            <h1>
                                {t('hero.title1')}<br />
                                <em>{t('hero.title2')}</em><br />
                                {t('hero.title3')}
                            </h1>
                            <p className="lead">{t('hero.lead')}</p>
                        </div>
                        <div>
                            <div className="price">
                                <span className="eyebrow">{tCommon('from')}</span>
                                <span className="p">{tCommon('approx')} ¥48,000</span>
                                <span className="u">{t('hero.priceUnit')}</span>
                            </div>
                            <div className="cta-row">
                                <Link href="/rooms" className="v2-btn">{t('hero.ctaPrimary')}</Link>
                                <Link href="/rooms" className="v2-btn outline">{t('hero.ctaSecondary')}</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Manifesto ──────────────────────────────────────────── */}
            <section className="v2-manifesto">
                <div className="v2-manifesto-mark">{t('manifesto.mark')}</div>
                <p>
                    {t('manifesto.line1')}<br />
                    {t('manifesto.line2')}<em>{t('manifesto.emphasis')}</em>{t('manifesto.lineSuffix')}
                </p>
                <div className="v2-manifesto-sig">{t('manifesto.signature')}</div>
            </section>

            {/* ── Story ──────────────────────────────────────────────── */}
            <section className="v2-section" id="story">
                <div className="v2-story">
                    <div className="v2-story-img" style={{ backgroundImage: `url(${IMG.villa3})` }} />
                    <div className="v2-story-text">
                        <div className="eyebrow">{t('story.eyebrow')}</div>
                        <h2>
                            {t('story.title1')}<br />
                            <em>{t('story.emphasis')}</em>{t('story.title2')}
                        </h2>
                        <p>{t('story.p1')}</p>
                        <p>{t('story.p2')}</p>
                        <div className="v2-story-quote">{t('story.quote')}</div>
                    </div>
                </div>
            </section>

            {/* ── Rooms preview ──────────────────────────────────────── */}
            <section className="v2-section" style={{ background: 'var(--v2-sand-light)' }}>
                <div className="v2-secthead">
                    <div className="eyebrow">{t('roomsPreview.eyebrow')}</div>
                    <h2>{t('roomsPreview.title')}</h2>
                    <p>{t('roomsPreview.lead')}</p>
                </div>
                <div className="v2-rooms">
                    {ROOMS.map(r => (
                        <RoomPreviewCard key={r.id} room={r} />
                    ))}
                </div>
            </section>

            {/* ── Amenities (9 items) ────────────────────────────────── */}
            <section className="v2-section">
                <div className="v2-secthead">
                    <div className="eyebrow">{t('amenities.eyebrow')}</div>
                    <h2>{t('amenities.title')}</h2>
                    <p>{t('amenities.lead')}</p>
                </div>
                <AmenitiesGrid />
            </section>

            {/* ── Trust band ─────────────────────────────────────────── */}
            <section className="v2-section">
                <div className="v2-trust">
                    <div className="v2-trust-stat">
                        <div className="big">
                            <span style={{ color: 'var(--v2-terracotta-dark)' }}>★</span> {t('trust.rating')}
                        </div>
                        <div className="lbl">{t('trust.ratingMeta')}</div>
                    </div>
                    <div className="v2-trust-divider" />
                    <div className="v2-trust-text">
                        <div className="eyebrow">{t('trust.eyebrow')}</div>
                        <p>{t('trust.lead')}</p>
                    </div>
                    <Link href="/features" className="v2-btn outline">{t('trust.cta')}</Link>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────────── */}
            <section className="v2-cta">
                <div className="v2-cta-inner">
                    <div className="eyebrow" style={{ color: 'rgba(250,245,234,0.7)' }}>{t('cta.eyebrow')}</div>
                    <h2>
                        {t('cta.title1')}<br />
                        <em>{t('cta.emphasis')}</em>
                    </h2>
                    <p>{t('cta.lead')}</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/reserve" className="v2-btn">{t('cta.ctaPrimary')}</Link>
                        <a href={`mailto:${tBrand('email')}`} className="v2-btn ghost">{t('cta.ctaSecondary')}</a>
                    </div>
                </div>
            </section>
        </main>
    );
}

// 9-item inclusions grid (also used on /rooms, /features)
function AmenitiesGrid() {
    const t = useTranslations('Amenities');
    const items = t.raw('items') as { label: string; tag: string }[];
    return (
        <div className="v2-amen">
            {items.map((a, i) => (
                <div key={i} className="v2-amen-card">
                    <div className="v2-amen-ico">{String(i + 1).padStart(2, '0')}</div>
                    <div style={{ flex: 1 }}>
                        <div className="l">{a.label}</div>
                        <div className="t">{a.tag}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
