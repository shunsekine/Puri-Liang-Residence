// V2 Bohemian Natural — Room preview card (used on Home, Rooms list)
// Pure presentational component that resolves the localized name + bullets
// from messages.RoomData.{id} and renders the V2-styled card.

'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { IMG, type Room, currencyForLocale, formatPrice, roomPriceAmount } from '@/lib/data';

export default function RoomPreviewCard({ room }: { room: Room }) {
    const locale = useLocale();
    const t = useTranslations(`RoomData.${room.id}`);
    const tCommon = useTranslations('Common');
    const code = currencyForLocale(locale);

    const has = room.photos.length > 0;
    const bullets = t.raw('bullets') as string[];

    return (
        <article className="v2-room">
            <div
                className={`v2-room-img${has ? '' : ' placeholder'}`}
                style={has ? { backgroundImage: `url("${IMG[room.photos[0]]}")` } : undefined}
            >
                {has ? (
                    <span className="v2-room-tag">{room.size}{tCommon('metersSq')} · {room.capacity}{tCommon('guestsUnit')}</span>
                ) : (
                    <>
                        <span style={{ fontFamily: 'var(--v2-display)', fontSize: 28, color: 'var(--v2-terracotta-dark)', opacity: 0.7 }}>📷</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--v2-display)', fontStyle: 'italic' }}>{t('available')}</span>
                    </>
                )}
            </div>
            <div className="v2-room-body">
                <div>
                    <h3>{t('name')}</h3>
                    <div className="jp">{t('nameLocal')}</div>
                </div>
                <div className="v2-room-meta">
                    <span className="chip">{room.size}{tCommon('metersSq')}</span>
                    <span className="chip">{room.capacity}{tCommon('guestsUnit')}</span>
                    <span className="chip">{room.floor}</span>
                </div>
                <ul className="v2-room-bullets">
                    {bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                <div className="v2-room-foot">
                    <div>
                        <span className="p">{tCommon('approx')} {formatPrice(code, roomPriceAmount(room, code))}</span>
                        <span className="u">/ {tCommon('monthsUnit')}</span>
                    </div>
                    <Link href="/rooms" className="v2-btn" style={{ padding: '8px 16px', fontSize: 12 }}>→</Link>
                </div>
            </div>
        </article>
    );
}
