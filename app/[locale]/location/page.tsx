// V2 Bohemian Natural — Location page
// Hero / Crossroads (E/W/S/N) / Map + info / POI grid (8 items) / Neighborhood notes (4)

import { useTranslations, useLocale } from 'next-intl';
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
    const locale = useLocale();

    // Google Maps 埋め込み(APIキー不要)。ピン座標は lib/data.ts の LOCATION を使用。
    const mapEmbedSrc = `https://maps.google.com/maps?q=${LOCATION.lat},${LOCATION.lng}&z=15&hl=${locale}&output=embed`;

    // ── バリ島南部 俯瞰マップ(エリア相対図) ───────────────────────────────
    // 緯度経度を viewBox(600x600) に投影し、Puri Liang を基準に主要エリアを配置。
    // km は Puri Liang Residence からのおおよその距離(目安)。
    const MAP_VB = 600;
    const M_LAT_TOP = -8.48, M_LAT_BOTTOM = -8.86, M_LNG_LEFT = 115.06, M_LNG_RIGHT = 115.29;
    const M_PAD_X = 64, M_PAD_Y = 44;
    const m_drawW = MAP_VB - 2 * M_PAD_X;
    const m_drawH = MAP_VB - 2 * M_PAD_Y;
    const m_scale = Math.min(m_drawW / (M_LNG_RIGHT - M_LNG_LEFT), m_drawH / (M_LAT_TOP - M_LAT_BOTTOM));
    const m_offX = M_PAD_X + (m_drawW - (M_LNG_RIGHT - M_LNG_LEFT) * m_scale) / 2;
    const m_offY = M_PAD_Y + (m_drawH - (M_LAT_TOP - M_LAT_BOTTOM) * m_scale) / 2;
    const project = (lat: number, lng: number) => ({
        x: m_offX + (lng - M_LNG_LEFT) * m_scale,
        y: m_offY + (M_LAT_TOP - lat) * m_scale,
    });
    const homePt = project(LOCATION.lat, LOCATION.lng);
    const baliPois: { id: string; name: string; lat: number; lng: number; km: number; side: 'l' | 'r'; lpos?: 'tr' | 'b'; air?: boolean }[] = [
        { id: 'ubud', name: 'Ubud', lat: -8.5069, lng: 115.2625, km: 22, side: 'l' },
        { id: 'canggu', name: 'Canggu', lat: -8.6478, lng: 115.1385, km: 16, side: 'l' },
        { id: 'seminyak', name: 'Seminyak', lat: -8.6905, lng: 115.1656, km: 11, side: 'l' },
        { id: 'kuta', name: 'Kuta', lat: -8.7180, lng: 115.1686, km: 9, side: 'l' },
        { id: 'airport', name: 'Ngurah Rai', lat: -8.7467, lng: 115.1668, km: 9, side: 'l', air: true },
        { id: 'sanur', name: 'Sanur', lat: -8.6878, lng: 115.2625, km: 4, side: 'r', lpos: 'tr' },
        { id: 'nusadua', name: 'Nusa Dua', lat: -8.8008, lng: 115.2317, km: 13, side: 'r' },
        { id: 'uluwatu', name: 'Uluwatu', lat: -8.8291, lng: 115.0849, km: 20, side: 'r' },
    ];
    const poiPts = baliPois.map(p => { const { x, y } = project(p.lat, p.lng); return { ...p, x, y }; });

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
                <div className="v2-balimap-layout">
                    <figure className="v2-balimap">
                        <div className="v2-balimap-wrap">
                            <svg className="v2-balimap-bg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                                <defs>
                                    <linearGradient id="balimapLand" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#f3ecda" />
                                        <stop offset="100%" stopColor="#e7dcc5" />
                                    </linearGradient>
                                    <radialGradient id="balimapOceanSW" cx="0%" cy="100%" r="85%">
                                        <stop offset="0%" stopColor="rgba(93,111,86,0.30)" />
                                        <stop offset="55%" stopColor="rgba(93,111,86,0.12)" />
                                        <stop offset="100%" stopColor="rgba(93,111,86,0)" />
                                    </radialGradient>
                                    <radialGradient id="balimapOceanE" cx="100%" cy="40%" r="55%">
                                        <stop offset="0%" stopColor="rgba(120,140,150,0.20)" />
                                        <stop offset="100%" stopColor="rgba(120,140,150,0)" />
                                    </radialGradient>
                                    <pattern id="balimapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(58,46,34,0.05)" strokeWidth="1" />
                                    </pattern>
                                </defs>
                                <rect width="600" height="600" fill="url(#balimapLand)" />
                                <rect width="600" height="600" fill="url(#balimapOceanSW)" />
                                <rect width="600" height="600" fill="url(#balimapOceanE)" />
                                <rect width="600" height="600" fill="url(#balimapGrid)" />
                                {/* おおまかな海岸線(南西=インド洋) */}
                                <path d="M 0 250 Q 110 300 130 400 Q 150 500 90 600" fill="none" stroke="rgba(93,111,86,0.45)" strokeWidth="1.5" strokeDasharray="2 6" />
                                {/* Puri Liang からの距離コネクタ */}
                                {poiPts.map(p => (
                                    <line key={p.id} x1={homePt.x} y1={homePt.y} x2={p.x} y2={p.y}
                                        stroke="rgba(58,46,34,0.18)" strokeWidth="1" strokeDasharray="3 4" />
                                ))}
                                {/* 方位(N) */}
                                <g transform="translate(548 56)">
                                    <line x1="0" y1="14" x2="0" y2="-14" stroke="var(--v2-mocha)" strokeWidth="1.5" />
                                    <path d="M 0 -18 L 4 -10 L -4 -10 Z" fill="var(--v2-terracotta)" />
                                    <text x="0" y="30" textAnchor="middle" fontSize="13" fontStyle="italic" fill="rgba(58,46,34,0.6)">N</text>
                                </g>
                                <text x="64" y="566" fontSize="11" letterSpacing="2" fill="rgba(93,111,86,0.7)" style={{ textTransform: 'uppercase' }}>Indian Ocean</text>
                            </svg>

                            {poiPts.map(p => (
                                <div key={p.id} className={`v2-balimap-poi side-${p.side}${p.lpos ? ` lpos-${p.lpos}` : ''}${p.air ? ' is-air' : ''}`}
                                    style={{ left: `${(p.x / MAP_VB) * 100}%`, top: `${(p.y / MAP_VB) * 100}%` }}>
                                    <span className="dot" />
                                    <span className="lbl">{p.air ? '✈ ' : ''}{p.name}<small>≈ {p.km} km</small></span>
                                </div>
                            ))}
                            <div className="v2-balimap-poi is-home lpos-b"
                                style={{ left: `${(homePt.x / MAP_VB) * 100}%`, top: `${(homePt.y / MAP_VB) * 100}%` }}>
                                <span className="dot" />
                                <span className="lbl">{t('crossroads.hubLabel')}<small>{LOCATION.area}</small></span>
                            </div>
                        </div>
                        <figcaption className="v2-balimap-cap">{t('crossroads.mapCaption')}</figcaption>
                    </figure>
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
                        <iframe
                            className="v2-locmap-frame"
                            src={mapEmbedSrc}
                            title={t('info.name')}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="v2-locmap-coord">{LOCATION.coord.ns} · {LOCATION.coord.ew}</div>
                    </div>

                    <div className="v2-locinfo">
                        <div className="v2-locinfo-head">
                            <div className="t">{t('info.name')}</div>
                            <div className="addr">{t('info.address')}</div>
                            <div className="v2-locinfo-actions">
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${LOCATION.lat},${LOCATION.lng}`}>{t('info.openInGoogle')}</a>
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href={`https://maps.apple.com/?q=${LOCATION.lat},${LOCATION.lng}`}>{t('info.openInApple')}</a>
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
