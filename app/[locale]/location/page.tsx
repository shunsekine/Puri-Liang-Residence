// V2 Bohemian Natural — Location page
// Hero / Crossroads (E/W/S/N) / Map + info / POI grid (8 items) / Neighborhood notes (4)

import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LOCATION } from '@/lib/data';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Location' });
    return { title: t('title'), description: t('description') };
}

export default function LocationPage() {
    const t = useTranslations('Location');
    const directions = t.raw('directions') as {
        dir: 'N' | 'E' | 'S' | 'W';
        bearing: string;
        title: string;
        en: string;
        body: string;
        bullets: string[];
    }[];
    const poiItems = t.raw('around.items') as {
        title: string; en: string; detail: string;
        dist: string; unit: string; time: string; mode: string;
    }[];
    const notes = t.raw('neighborhood.notes') as { title: string; body: string }[];
    const stats = t.raw('info.stats') as { k: string; v: string; unit: string }[];

    return (
        <main className="v2">
            {/* Hero */}
            <section className="v2-rhero">
                <div className="eyebrow">{t('hero.eyebrow')}</div>
                <h1>
                    {t('hero.title1')}<br />
                    <em>{t('hero.emphasis')}</em>{t('hero.title2')}
                </h1>
                <p>{t('hero.lead')}</p>
            </section>

            {/* Crossroads — 4 directions */}
            <section className="v2-section" style={{ paddingTop: 48 }}>
                <div className="v2-secthead">
                    <div className="eyebrow">{t('crossroads.eyebrow')}</div>
                    <h2>
                        {t('crossroads.title1')}<br />
                        <em>{t('crossroads.emphasis')}</em>{t('crossroads.title2')}
                    </h2>
                    <p>{t('crossroads.lead')}</p>
                </div>
                <div className="v2-compass">
                    <div className="v2-compass-hub">
                        <div className="v2-compass-hub-inner">
                            <div className="v2-compass-hub-mark">✦</div>
                            <div className="v2-compass-hub-t">{t('crossroads.hubLabel')}</div>
                            <div className="v2-compass-hub-s">{t('crossroads.hubMeta')}</div>
                        </div>
                        <div className="v2-compass-axis v" />
                        <div className="v2-compass-axis h" />
                        <div className="v2-compass-cardinal n">N</div>
                        <div className="v2-compass-cardinal s">S</div>
                        <div className="v2-compass-cardinal e">E</div>
                        <div className="v2-compass-cardinal w">W</div>
                    </div>
                    <div className="v2-compass-grid">
                        {directions.map(d => (
                            <article key={d.dir} className={`v2-compass-card dir-${d.dir.toLowerCase()}`}>
                                <div className="v2-compass-card-head">
                                    <span className="v2-compass-card-dir">{d.dir}</span>
                                    <div>
                                        <div className="bearing">{d.bearing}</div>
                                        <div className="en">{d.en}</div>
                                    </div>
                                </div>
                                <h3>{d.title}</h3>
                                <p>{d.body}</p>
                                <ul>
                                    {d.bullets.map((b, j) => <li key={j}>{b}</li>)}
                                </ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* Map + info */}
            <section className="v2-section">
                <div className="v2-loc-wrap">
                    <div className="v2-locmap">
                        <div className="v2-locmap-bg" />
                        <svg className="v2-locmap-svg" viewBox="0 0 600 480" preserveAspectRatio="xMidYMid slice">
                            <defs>
                                <pattern id="v2locgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(58,46,34,0.06)" strokeWidth="1" />
                                </pattern>
                            </defs>
                            <rect width="600" height="480" fill="url(#v2locgrid)" />
                            <path d="M 0 380 Q 150 360 280 400 Q 420 430 600 410 L 600 480 L 0 480 Z" fill="rgba(196,122,82,0.1)" />
                            <path d="M 0 380 Q 150 360 280 400 Q 420 430 600 410" stroke="rgba(196,122,82,0.4)" strokeWidth="1.5" fill="none" />
                            <path d="M 0 200 Q 180 180 320 220 Q 460 250 600 200" stroke="rgba(58,46,34,0.35)" strokeWidth="2.5" fill="none" />
                            <path d="M 0 280 Q 150 270 300 290 Q 450 300 600 280" stroke="rgba(58,46,34,0.25)" strokeWidth="1.8" fill="none" />
                            <path d="M 280 0 Q 290 150 320 280 Q 340 380 360 480" stroke="rgba(58,46,34,0.3)" strokeWidth="2" fill="none" />
                            <path d="M 100 0 Q 130 100 110 200 Q 90 320 130 480" stroke="rgba(93,111,86,0.4)" strokeWidth="3" fill="none" />
                        </svg>
                        <div className="v2-locmap-pin main" style={{ top: '55%', left: '52%' }}>
                            <div className="dot" />
                            <div className="lbl">{t('crossroads.hubLabel')}</div>
                        </div>
                        <div className="v2-locmap-pin sub" style={{ top: '82%', left: '78%' }}><div className="d" /><div className="lb">{poiItems[0]?.title ?? '—'}</div></div>
                        <div className="v2-locmap-pin sub" style={{ top: '40%', left: '38%' }}><div className="d" /><div className="lb">{poiItems[1]?.title ?? '—'}</div></div>
                        <div className="v2-locmap-pin sub" style={{ top: '62%', left: '38%' }}><div className="d" /><div className="lb">{poiItems[2]?.title ?? '—'}</div></div>
                        <div className="v2-locmap-coord">{LOCATION.coord.ns} · {LOCATION.coord.ew}</div>
                    </div>

                    <div className="v2-locinfo">
                        <div className="v2-locinfo-head">
                            <div className="t">{t('info.name')}</div>
                            <div className="addr">{t('info.address')}</div>
                            <div className="v2-locinfo-actions">
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href="https://maps.google.com">{t('info.openInGoogle')}</a>
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href="https://maps.apple.com">{t('info.openInApple')}</a>
                            </div>
                        </div>
                        <div className="v2-locinfo-stat">
                            {stats.map((s, i) => (
                                <div key={i}>
                                    <div className="k">{s.k}</div>
                                    <div className="v">{s.v}<small>{s.unit}</small></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Around — 8 POI */}
            <section className="v2-section" style={{ background: 'var(--v2-sand-light)' }}>
                <div className="v2-secthead">
                    <div className="eyebrow">{t('around.eyebrow')}</div>
                    <h2>{t('around.title')}</h2>
                    <p>{t('around.lead')}</p>
                </div>
                <div className="v2-poi-grid">
                    {poiItems.map((p, i) => (
                        <article key={i} className="v2-poi">
                            <div className="v2-poi-num">{String(i + 1).padStart(2, '0')}</div>
                            <div>
                                <div className="v2-poi-title">{p.title}</div>
                                <div className="v2-poi-en">{p.en}</div>
                                <div className="v2-poi-detail">{p.detail}</div>
                            </div>
                            <div className="v2-poi-meta">
                                <div className="dist">{p.dist}<small>{p.unit}</small></div>
                                <div className="time">{p.mode} {p.time}</div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* Neighborhood notes */}
            <section className="v2-section" id="neighborhood">
                <div className="v2-secthead">
                    <div className="eyebrow">{t('neighborhood.eyebrow')}</div>
                    <h2>
                        {t('neighborhood.title1')}<br />
                        <em>{t('neighborhood.emphasis')}</em>{t('neighborhood.title2')}
                    </h2>
                    <p>{t('neighborhood.lead')}</p>
                </div>
                <div className="v2-neigh">
                    {notes.map((n, i) => (
                        <article key={i} className="v2-neigh-card">
                            <div className="v2-neigh-num">№ {String(i + 1).padStart(2, '0')}</div>
                            <h3>{n.title}</h3>
                            <p>{n.body}</p>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
