// V2 Bohemian Natural — Rooms page
// 3 room detail rows + simulator + amenities + house rules

import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { ROOMS, IMG, type Room, currencyForLocale, formatPrice, roomPriceAmount } from '@/lib/data';
import RoomSimulator from '@/components/pages/v2/RoomSimulator';
import { Link } from '@/navigation';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Rooms' });
    return { title: t('title'), description: t('description') };
}

export default function RoomsPage() {
    const t = useTranslations('Rooms');

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

            {/* Detail rows */}
            <div style={{ padding: '0 56px' }} className="v2-rd-wrap">
                {ROOMS.map((r, i) => (
                    <RoomDetailRow key={r.id} room={r} index={i} reverse={i % 2 === 1} />
                ))}
            </div>

            {/* Simulator */}
            <RoomSimulator />

            {/* Amenities */}
            <section className="v2-section">
                <div className="v2-secthead">
                    <div className="eyebrow">{t('amenitiesHeader.eyebrow')}</div>
                    <h2>{t('amenitiesHeader.title')}</h2>
                    <p>{t('amenitiesHeader.lead')}</p>
                </div>
                <AmenitiesGrid />
            </section>

            {/* House rules */}
            <section className="v2-section" style={{ background: 'var(--v2-sand-light)' }}>
                <div className="v2-secthead">
                    <div className="eyebrow">{t('houseRulesHeader.eyebrow')}</div>
                    <h2>{t('houseRulesHeader.title')}</h2>
                    <p>{t('houseRulesHeader.lead')}</p>
                </div>
                <HouseRulesGrid />
            </section>
        </main>
    );
}

function RoomDetailRow({ room, index, reverse }: { room: Room; index: number; reverse: boolean }) {
    const locale = useLocale();
    const t = useTranslations(`RoomData.${room.id}`);
    const tRooms = useTranslations('Rooms');
    const tCommon = useTranslations('Common');
    const code = currencyForLocale(locale);
    const has = room.photos.length > 0;
    const bullets = t.raw('bullets') as string[];

    return (
        <article className={`v2-rd${reverse ? ' reverse' : ''}`}>
            <div className="v2-rd-imgs">
                {has ? (
                    <>
                        <div style={{ backgroundImage: `url("${IMG[room.photos[0]]}")` }} />
                        {room.photos[1] ? <div style={{ backgroundImage: `url("${IMG[room.photos[1]]}")` }} /> : <div className="placeholder">—</div>}
                        {room.photos[2] ? <div style={{ backgroundImage: `url("${IMG[room.photos[2]]}")` }} /> : <div className="placeholder">—</div>}
                    </>
                ) : (
                    <>
                        <div className="placeholder">
                            <span style={{ fontFamily: 'var(--v2-display)', fontSize: 28 }}>📷</span>
                            <span style={{ fontFamily: 'var(--v2-display)', fontStyle: 'italic', fontSize: 13 }}>{t('available')}</span>
                        </div>
                        <div className="placeholder">—</div>
                        <div className="placeholder">—</div>
                    </>
                )}
            </div>
            <div>
                <div className="v2-rd-meta">
                    <span className="chip">№ {String(index + 1).padStart(2, '0')}</span>
                    <span className="chip">{room.size}{tCommon('metersSq')}</span>
                    <span className="chip">{room.capacity}{tCommon('guestsUnit')}</span>
                </div>
                <h2>
                    {t('name')}
                    <span className="jp">{t('nameLocal')}</span>
                </h2>
                <p className="lead">{t('description')}</p>
                <div className="v2-rd-spec">
                    <div><div className="k">{tRooms('specLabels.size')}</div><div className="v">{room.size}{tCommon('metersSq')}</div></div>
                    <div><div className="k">{tRooms('specLabels.sleeps')}</div><div className="v">{room.capacity}</div></div>
                    <div><div className="k">{tRooms('specLabels.floor')}</div><div className="v">{room.floor}</div></div>
                    <div><div className="k">{tRooms('specLabels.bath')}</div><div className="v">{room.bathrooms}</div></div>
                </div>
                <ul className="v2-rd-bullets">
                    {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                <div className="v2-rd-price">
                    <div>
                        <span className="p">{tCommon('approx')} {formatPrice(code, roomPriceAmount(room, code))}</span>
                        <div className="u">{tRooms('priceNote')}</div>
                        <div style={{ fontSize: 11, color: 'var(--v2-muted)', marginTop: 2 }}>
                            {tCommon('priceRefNote')}
                        </div>
                    </div>
                    <Link href="/reserve" className="v2-btn">{tRooms('reserveCta')}</Link>
                </div>
            </div>
        </article>
    );
}

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

function HouseRulesGrid() {
    const t = useTranslations('HouseRules');
    const items = t.raw('items') as string[];
    const icons = ['◐', '◯', '◇', '◇', '◯'];
    return (
        <div className="v2-rules">
            {items.map((label, i) => (
                <div key={i} className="v2-rule">
                    <span className="ic">{icons[i] || '◯'}</span>
                    <span className="l">{label}</span>
                </div>
            ))}
        </div>
    );
}
