// V2 Bohemian Natural — Location page
// Hero / Crossroads (E/W/S/N) / Map + info / POI grid (8 items) / Neighborhood notes (4)

import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LOCATION, IMG } from '@/lib/data';

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
        access: string;
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

    // Google Maps 埋め込み(APIキー不要)。
    // 座標ではなく場所名+住所で指定することで、ピンに「場所情報」を表示させる
    // (q=緯度,経度 だと "ドロップピン"=場所情報なし になるため)。
    const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(LOCATION.placeQuery)}&z=16&hl=${locale}&output=embed`;

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
                    <figure className="v2-cdial-fig">
                        <div className="v2-cdial">
                            <div className="v2-cdial-hub">
                                <span className="mk">✦</span>
                                <span className="t">{t('crossroads.hubLabel')}</span>
                                <span className="s">{t('crossroads.hubMeta')}</span>
                            </div>
                            {directions.map(d => {
                                const area = d.en.split('·')[1]?.trim() ?? d.title;
                                return (
                                    <div key={d.dir} className={`v2-cdial-poi pos-${d.dir.toLowerCase()}`}>
                                        <div className="h"><span className="d">{d.dir}</span><span className="a">{area}</span></div>
                                        <div className="x">{d.access}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <figcaption className="v2-cdial-cap">{t('crossroads.mapCaption')}</figcaption>
                    </figure>
                    <div className="v2-compass-grid">
                        {directions.map(d => {
                            const DIR_IMGS: Record<string, string> = {
                                'N': IMG.ubud,
                                'E': IMG.sanur,
                                'S': IMG.uluwatu,
                                'W': IMG.canggu,
                            };
                            return (
                                <article key={d.dir} className={`v2-compass-card dir-${d.dir.toLowerCase()}`} style={{ backgroundImage: `url(${DIR_IMGS[d.dir]})` }}>
                                    <div className="v2-compass-card-glass">
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
                                    </div>
                                </article>
                            );
                        })}
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
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href={LOCATION.googleShareUrl}>{t('info.openInGoogle')}</a>
                                <a className="v2-btn outline" style={{ padding: '8px 16px', fontSize: 12 }} target="_blank" rel="noopener" href={`https://maps.apple.com/?q=${encodeURIComponent('Puri Liang Residence')}&ll=${LOCATION.lat},${LOCATION.lng}&z=16`}>{t('info.openInApple')}</a>
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
