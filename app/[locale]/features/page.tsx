// V2 Bohemian Natural — Features page
// 4 feature groups (Workspace / Living / Laundry / Neighborhood) + inclusions list + reviews

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { IMG } from '@/lib/data';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Features' });
    return { title: t('title'), description: t('description') };
}

// 2026-05 V2 update — Connectivity and Community groups replaced with
// Workspace / Living / Laundry / Neighborhood. See messages.Features.groups.
const GROUP_IMG_KEYS = ['villa3', 'villa1', 'twin1', 'villa2'] as const;

export default function FeaturesPage() {
    const t = useTranslations('Features');
    const groups = t.raw('groups') as {
        eyebrow: string;
        title: string;
        lead: string;
        bullets: { k: string; v: string }[];
    }[];

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
                {groups.map((g, i) => {
                    const imgKey = GROUP_IMG_KEYS[i] ?? GROUP_IMG_KEYS[0];
                    return (
                        <article key={i} className={`v2-feat-row${i % 2 === 1 ? ' rev' : ''}`}>
                            <div className="v2-feat-img" style={{ backgroundImage: `url(${IMG[imgKey]})` }}>
                                <div className="v2-feat-tag">{String(i + 1).padStart(2, '0')} / {groups.length}</div>
                            </div>
                            <div className="v2-feat-body">
                                <div className="eyebrow">{g.eyebrow}</div>
                                <h2>{g.title}</h2>
                                <p className="lead">{g.lead}</p>
                                <div className="v2-feat-grid">
                                    {g.bullets.map((b, j) => (
                                        <div key={j} className="v2-feat-row-row">
                                            <div className="k">{b.k}</div>
                                            <div className="v">{b.v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* Inclusions (9 items) */}
            <section className="v2-section" style={{ background: 'var(--v2-sand-light)' }}>
                <div className="v2-secthead">
                    <div className="eyebrow">{t('included.eyebrow')}</div>
                    <h2>{t('included.title')}</h2>
                    <p>{t('included.lead')}</p>
                </div>
                <AmenitiesGridWithChecks />
            </section>

            {/* Voices */}
            <section className="v2-section">
                <div className="v2-secthead">
                    <div className="eyebrow">{t('voices.eyebrow')}</div>
                    <h2>
                        {t('voices.title1')}<br />
                        <em>{t('voices.emphasis')}</em>{t('voices.title2')}
                    </h2>
                    <p>{t('voices.lead')}</p>
                </div>
                <ReviewGrid />
                <div style={{
                    marginTop: 28, textAlign: 'center', fontSize: 11,
                    letterSpacing: '0.12em', color: 'var(--v2-muted)', textTransform: 'uppercase',
                }}>
                    {t('voices.rating')}
                </div>
            </section>
        </main>
    );
}

function AmenitiesGridWithChecks() {
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
                    <div className="v2-amen-check">✓</div>
                </div>
            ))}
        </div>
    );
}

function ReviewGrid() {
    const t = useTranslations('ReviewPlaceholders');
    // ReviewPlaceholders is an array, fetch via t.raw at root
    const items = (useTranslations() as unknown as { raw: (k: string) => unknown }).raw('ReviewPlaceholders') as {
        stay: string;
        role: string;
        headline: string;
        body: string;
    }[];
    void t;
    return (
        <div className="v2-revs" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
        }}>
            {items.map((r, i) => (
                <article key={i} className="v2-rev" style={{
                    background: 'var(--v2-cream)', borderRadius: 20, padding: 28,
                    border: '1px solid var(--v2-rule)', position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', top: 14, right: 24, fontFamily: 'var(--v2-display)',
                        fontSize: 48, color: 'var(--v2-terracotta)', opacity: 0.4, lineHeight: 1,
                    }}>❝</div>
                    <div style={{ fontFamily: 'var(--v2-display)', fontSize: 20, lineHeight: 1.3, margin: '12px 0 14px', color: 'var(--v2-mocha)' }}>
                        {r.headline}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--v2-mocha-soft)' }}>{r.body}</div>
                    <div style={{
                        marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--v2-rule)',
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 11, letterSpacing: '0.08em', color: 'var(--v2-muted)', textTransform: 'uppercase',
                    }}>
                        <span>{r.stay}</span><span>{r.role}</span>
                    </div>
                </article>
            ))}
        </div>
    );
}
