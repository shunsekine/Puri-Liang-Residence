// V2 Bohemian Natural — Monthly price simulator (used on /rooms)

'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ROOMS, SIMULATOR_DEFAULTS, type RoomId, currencyForLocale, formatPrice, roomPriceAmount, roomPrice2WeeksAmount, electricityAmount } from '@/lib/data';

function getDiscount(months: number) {
    for (const tier of SIMULATOR_DEFAULTS.discounts) {
        if (months >= tier.months) return tier.rate;
    }
    return 0;
}

export default function RoomSimulator() {
    const locale = useLocale();
    const code = currencyForLocale(locale);
    const t = useTranslations('Simulator');
    const tRoom = useTranslations('RoomData');
    const tCommon = useTranslations('Common');

    const [months, setMonths] = useState(3);
    const [roomId, setRoomId] = useState<RoomId>('villa');

    const r = ROOMS.find(x => x.id === roomId)!;
    const rent = months === 0.5 ? roomPrice2WeeksAmount(r, code) : roomPriceAmount(r, code) * months;
    const elec = electricityAmount(code) * months;
    const discount = getDiscount(months);
    const disc = Math.round(rent * discount);
    const total = rent - disc + elec;

    return (
        <section className="v2-section" style={{ background: 'var(--v2-sand-light)' }}>
            <div className="v2-secthead">
                <div className="eyebrow">{t('eyebrow')}</div>
                <h2>
                    {t('title1')}<br />
                    <em style={{ color: 'var(--v2-terracotta-dark)' }}>{t('emphasis')}</em>{t('title2')}
                </h2>
                <p>{t('lead')}</p>
            </div>
            <div className="v2-simx">
                <div className="v2-simx-left">
                    <div className="v2-simx-field">
                        <span className="v2-simx-lbl">{t('roomLabel')}</span>
                        <div className="v2-simx-opts">
                            {ROOMS.map(rr => (
                                <button
                                    key={rr.id}
                                    type="button"
                                    className={`v2-simx-opt${rr.id === roomId ? ' on' : ''}`}
                                    onClick={() => setRoomId(rr.id)}
                                >
                                    <div className="n">{tRoom(`${rr.id}.name`)}</div>
                                    <div className="s">{rr.size}{tCommon('metersSq')} · {rr.capacity}{tCommon('guestsUnit')}</div>
                                    <div className="p">{tCommon('approx')} {formatPrice(code, roomPriceAmount(rr, code))}<span> / {tCommon('monthsUnit')}</span></div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="v2-simx-field">
                        <span className="v2-simx-lbl">{t('monthsLabel')}</span>
                        <div className="v2-simx-stepper">
                            <button type="button" onClick={() => setMonths(months === 1 ? 0.5 : Math.max(0.5, months - 1))} aria-label="−">−</button>
                            <div className="num">
                                <span className="big">{months === 0.5 ? '2' : months}</span>
                                <span className="unit">{months === 0.5 ? tCommon('weeksUnit') : tCommon('monthsUnit')}</span>
                            </div>
                            <button type="button" onClick={() => setMonths(months === 0.5 ? 1 : Math.min(12, months + 1))} aria-label="+">＋</button>
                        </div>
                        <div className="v2-simx-disc">
                            <span className={`tag${discount >= 0.1 ? ' on' : ''}`}>{t('discount3m')}</span>
                            <span className={`tag${discount >= 0.15 ? ' on' : ''}`}>{t('discount6m')}</span>
                        </div>
                    </div>
                </div>

                <div className="v2-simx-right">
                    <div className="v2-simx-head">
                        <div className="t">{t('estimateTitle')}</div>
                        <div className="s">{tRoom(`${r.id}.name`)} × {months === 0.5 ? '2' + tCommon('weeksUnit') : months + tCommon('monthsUnit')}</div>
                    </div>
                    <div className="v2-simx-line">
                        <span className="l">{t('rent')}</span>
                        <span className="r">{tCommon('approx')} {formatPrice(code, rent)}</span>
                    </div>
                    {disc > 0 && (
                        <div className="v2-simx-line disc">
                            <span className="l">{t('discountRow')} ({discount * 100}%)</span>
                            <span className="r">−{formatPrice(code, disc)}</span>
                        </div>
                    )}
                    <div className="v2-simx-line">
                        <span className="l">{t('electricity')}</span>
                        <span className="r">{tCommon('approx')} {formatPrice(code, elec)}</span>
                    </div>
                    <div className="v2-simx-line">
                        <span className="l">{t('includedRow1')}</span>
                        <span className="inc">{t('included')}</span>
                    </div>
                    <div className="v2-simx-line">
                        <span className="l">{t('includedRow2')}</span>
                        <span className="inc">{t('included')}</span>
                    </div>
                    <div className="v2-simx-total">
                        <div>
                            <div className="lbl">{t('totalMonths', { months })}</div>
                            <div className="avg">{t('monthlyAvg')} {tCommon('approx')} {formatPrice(code, Math.round(total / months))}</div>
                        </div>
                        <div className="big">{tCommon('approx')} {formatPrice(code, total)}</div>
                    </div>
                    <div className="v2-simx-note">{t('note')}</div>
                </div>
            </div>
        </section>
    );
}
