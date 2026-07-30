'use client';
// V2 Reserve form — GAS Webhook backend + house-rules modal + i18n.
// Direct port of the prototype's src/v2-reserve.jsx into next-intl + TS.
//
// Key behaviors:
//   - controlled inputs (name/email/phone/nationality/purposes/notes/agreements)
//   - 4-state submission: idle / sending / success / error
//   - honeypot field to filter bots
//   - house-rules modal: click the underlined link in step 3 to open;
//     Esc / × / "got it" button closes; form state is preserved
//   - single consent checkbox; house-rules modal + /faq#terms link (new tab)
//   - localized via messages.Reserve.* / messages.HouseRules.items / messages.Terms
//   - live price summary (sticky on desktop, top-floating on mobile)
//
// Setup:
//   1. Deploy the GAS backend in gas-booking-automation/
//   2. Set the env var GAS_WEBHOOK_URL=<your-url> in Vercel.
//   3. If unset, this form falls back to a mock success response.

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { ROOMS, IMG, SIMULATOR_DEFAULTS, type RoomId, currencyForLocale, formatPrice, roomPriceAmount, roomPrice2WeeksAmount, electricityAmount } from '@/lib/data';

type Status = 'idle' | 'sending' | 'success' | 'error';

function getDiscount(months: number): number {
    for (const tier of SIMULATOR_DEFAULTS.discounts) {
        if (months >= tier.months) return tier.rate;
    }
    return 0;
}

function addMonths(dateStr: string, months: number): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    if (months === 0.5) {
        d.setDate(d.getDate() + 14);
    } else {
        d.setMonth(d.getMonth() + months);
    }
    return d.toISOString().slice(0, 10);
}

export default function ReserveForm() {
    const locale = useLocale();
    const code = currencyForLocale(locale);
    const t = useTranslations('Reserve');
    const tHouseRules = useTranslations('HouseRules');
    const tRoom = useTranslations('RoomData');
    const tCommon = useTranslations('Common');

    // --- Stay (Step 1) ---
    const [room, setRoom] = useState<RoomId>('villa');
    const [months, setMonths] = useState(3);
    const [checkin, setCheckin] = useState('2026-06-15');
    const [guests, setGuests] = useState(2);

    // --- Contact (Step 2) ---
    const [name, setName] = useState('');
    const [nationality, setNationality] = useState('JP');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [purposes, setPurposes] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    // --- Terms (Step 3) ---
    const [agree, setAgree] = useState(false);

    // --- House rules modal ---
    const [rulesOpen, setRulesOpen] = useState(false);
    useEffect(() => {
        if (!rulesOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRulesOpen(false); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [rulesOpen]);

    // --- Submission ---
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const honeypotRef = useRef<HTMLInputElement>(null);

    const r = ROOMS.find(x => x.id === room)!;
    const unitPrice = roomPriceAmount(r, code);
    const rent = months === 0.5 ? roomPrice2WeeksAmount(r, code) : unitPrice * months;
    const elec = electricityAmount(code) * months;
    const discount = getDiscount(months);
    const disc = Math.round(rent * discount);
    const total = rent - disc + elec;
    const checkout = addMonths(checkin, months);

    // IDR calculations for the payload (actual billing is always in IDR)
    const rentIDR = months === 0.5 ? r.price2WeeksIDR! : r.priceIDR * months;
    const elecIDR = SIMULATOR_DEFAULTS.electricityIDR * months;
    const discIDR = Math.round(rentIDR * discount);
    const totalIDR = rentIDR - discIDR + elecIDR;

    const togglePurpose = (label: string) => {
        setPurposes(p => p.includes(label) ? p.filter(x => x !== label) : [...p, label]);
    };

    const validate = (): string | null => {
        if (!name.trim()) return t('errors.nameRequired');
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('errors.emailInvalid');
        if (!phone.trim()) return t('errors.phoneRequired');
        if (!agree) return t('errors.agreeRequired');
        return null;
    };

    const canSubmit = agree && status !== 'sending';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        // Bot honeypot
        if (honeypotRef.current && honeypotRef.current.value) {
            setStatus('success');
            return;
        }

        const err = validate();
        if (err) {
            setStatus('error');
            setErrorMsg(err);
            return;
        }

        setStatus('sending');
        setErrorMsg('');

        const localizedRoom = tRoom(`${r.id}.name`);

        const payload = {
            subject: `【予約問い合わせ】${name} 様 / ${localizedRoom} / ${months === 0.5 ? '2週間' : months + 'ヶ月'}`,
            from_name: 'Puri Liang Residence — Reservation Form',
            name,
            nationality,
            email,
            phone,
            room: localizedRoom,
            room_id: r.id,
            checkin,
            checkout,
            months,
            guests,
            stay_purposes: purposes.length ? purposes.join(', ') : '(none)',
            notes: notes || '(none)',
            language: locale,
            currency: code,
            rent_amount: rent,
            discount_pct: discount * 100,
            discount_amount: disc,
            electricity_amount: elec,
            total_amount: total,
            total_idr: totalIDR,
            rent_idr: rentIDR,
            electricity_idr: elecIDR,
            discount_idr: discIDR,
            submitted_at: new Date().toISOString(),
            page: typeof location !== 'undefined' ? location.href : '',
        };

        try {
            const res = await fetch('/api/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data?.success) {
                setStatus('success');
            } else {
                setStatus('error');
                setErrorMsg(data?.message ?? t('errors.submitFailed'));
            }
        } catch {
            setStatus('error');
            setErrorMsg(t('errors.networkError'));
        }
    };

    // ─── Success view ────────────────────────────────────────────────────
    if (status === 'success') {
        const nextSteps = t.raw('success.nextSteps') as string[];
        return (
            <section className="v2-section">
                <div className="v2-res-success">
                    <div className="v2-res-success-card">
                        <div className="v2-res-success-mark">✓</div>
                        <div className="v2-res-success-t">
                            {name || t('success.salutationDefault')}{t('success.salutation')}
                        </div>
                        <div className="v2-res-success-s">
                            {t('success.leadPrefix')}{email || t('success.leadDefault')}{t('success.leadSuffix')}
                        </div>

                        <div className="v2-res-success-grid">
                            <div><span className="k">{t('success.grid.room')}</span><span className="v">{tRoom(`${r.id}.name`)}</span></div>
                            <div><span className="k">{t('success.grid.period')}</span><span className="v">{months === 0.5 ? '2 ' + tCommon('weeksUnit') : months + ' ' + tCommon('monthsUnit')}</span></div>
                            <div><span className="k">{t('success.grid.checkin')}</span><span className="v">{checkin}</span></div>
                            <div><span className="k">{t('success.grid.checkout')}</span><span className="v">{checkout}</span></div>
                            <div><span className="k">{t('success.grid.guests')}</span><span className="v">{guests} {tCommon('guestsUnit')}</span></div>
                            <div><span className="k">{t('success.grid.total')}</span><span className="v">{tCommon('approx')} {formatPrice(code, total)}</span></div>
                        </div>

                        <div className="v2-res-success-next">
                            <div className="t">{t('success.nextStepsTitle')}</div>
                            <ol>{nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button type="button" className="v2-btn outline" onClick={() => setStatus('idle')}>
                                {t('success.resendButton')}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    const purposesList = t.raw('purposes') as string[];
    const nationalities = t.raw('nationalities') as Record<string, string>;
    const houseRulesItems = tHouseRules.raw('items') as string[];

    return (
        <>
            <section className="v2-section">
                <div className="v2-res-wrap">
                    {/* ─── Left: Form ──────────────────────────────────── */}
                    <form className="v2-res-form" onSubmit={handleSubmit} noValidate>
                        {/* Honeypot (visually hidden, bot-only) */}
                        <input
                            ref={honeypotRef}
                            type="text"
                            name="botcheck"
                            tabIndex={-1}
                            autoComplete="off"
                            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                            aria-hidden="true"
                        />

                        {/* Step 1: Stay */}
                        <div className="v2-res-step">
                            <div className="v2-res-step-head">
                                <div className="num">{t('steps.step1.num')}</div>
                                <div>
                                    <div className="t">{t('steps.step1.title')}</div>
                                    <div className="s">{t('steps.step1.subtitle')}</div>
                                </div>
                            </div>
                            <div className="v2-res-step-body">
                                <div className="v2-res-field">
                                    <label>{t('fields.roomType')}</label>
                                    <div className="v2-res-rooms">
                                        {ROOMS.map(rr => (
                                            <button
                                                key={rr.id}
                                                type="button"
                                                className={`v2-res-room${rr.id === room ? ' on' : ''}`}
                                                onClick={() => setRoom(rr.id)}
                                            >
                                                <div className="n">{tRoom(`${rr.id}.name`)}</div>
                                                <div className="s">{rr.size}{tCommon('metersSq')} · {rr.capacity}{tCommon('guestsUnit')} · {rr.floor}</div>
                                                <div className="p">{tCommon('approx')} {formatPrice(code, roomPriceAmount(rr, code))}<span>{tCommon('perMonth')}</span></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="v2-res-row">
                                    <div className="v2-res-field">
                                        <label>{t('fields.checkin')}</label>
                                        <input type="date" value={checkin} onChange={e => setCheckin(e.target.value)} />
                                    </div>
                                    <div className="v2-res-field">
                                        <label>{t('fields.stayMonths')}</label>
                                        <div className="v2-res-stepper">
                                            <button type="button" onClick={() => setMonths(months === 1 ? 0.5 : Math.max(0.5, months - 1))} aria-label="−">−</button>
                                            <span className="n">{months === 0.5 ? '2' : months}<small>{months === 0.5 ? tCommon('weeksUnit') : tCommon('monthsUnit')}</small></span>
                                            <button type="button" onClick={() => setMonths(months === 0.5 ? 1 : Math.min(12, months + 1))} aria-label="+">＋</button>
                                        </div>
                                    </div>
                                    <div className="v2-res-field">
                                        <label>{t('fields.guests')}</label>
                                        <div className="v2-res-stepper">
                                            <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="−">−</button>
                                            <span className="n">{guests}<small>{tCommon('guestsUnit')}</small></span>
                                            <button type="button" onClick={() => setGuests(Math.min(r.capacity, guests + 1))} aria-label="+">＋</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="v2-res-hint">
                                    {t('fields.checkoutLabel')}: <strong>{checkout}</strong> · {tRoom(`${r.id}.name`)} {t('fields.capacityHint')} {r.capacity}{t('fields.guestsUnit')}
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Contact */}
                        <div className="v2-res-step">
                            <div className="v2-res-step-head">
                                <div className="num">{t('steps.step2.num')}</div>
                                <div>
                                    <div className="t">{t('steps.step2.title')}</div>
                                    <div className="s">{t('steps.step2.subtitle')}</div>
                                </div>
                            </div>
                            <div className="v2-res-step-body">
                                <div className="v2-res-row cols2">
                                    <div className="v2-res-field">
                                        <label>{t('fields.name')} <span className="req">{t('fields.required')}</span></label>
                                        <input type="text" placeholder={t('fields.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} required />
                                    </div>
                                    <div className="v2-res-field">
                                        <label>{t('fields.nationality')}</label>
                                        <select value={nationality} onChange={e => setNationality(e.target.value)}>
                                            {Object.entries(nationalities).map(([code, label]) => (
                                                <option key={code} value={code}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="v2-res-row cols2">
                                    <div className="v2-res-field">
                                        <label>{t('fields.email')} <span className="req">{t('fields.required')}</span></label>
                                        <input type="email" placeholder={t('fields.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} required />
                                    </div>
                                    <div className="v2-res-field">
                                        <label>{t('fields.phone')} <span className="req">{t('fields.required')}</span></label>
                                        <input type="tel" placeholder={t('fields.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="v2-res-field">
                                    <label>{t('fields.stayPurpose')}</label>
                                    <div className="v2-res-chips">
                                        {purposesList.map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`v2-res-chip${purposes.includes(p) ? ' on' : ''}`}
                                                onClick={() => togglePurpose(p)}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="v2-res-field">
                                    <label>{t('fields.otherRequests')}</label>
                                    <textarea rows={3} placeholder={t('fields.otherRequestsPlaceholder')} value={notes} onChange={e => setNotes(e.target.value)} />
                                </div>
                                <div className="v2-res-hint">
                                    {t('fields.idNote')}
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Terms */}
                        <div className="v2-res-step">
                            <div className="v2-res-step-head">
                                <div className="num">{t('steps.step3.num')}</div>
                                <div>
                                    <div className="t">{t('steps.step3.title')}</div>
                                    <div className="s">{t('steps.step3.subtitle')}</div>
                                </div>
                            </div>
                            <div className="v2-res-step-body">
                                <label className="v2-res-check">
                                    <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                                    <div>
                                        <div className="t">
                                            <button
                                                type="button"
                                                className="v2-res-rules-link"
                                                onClick={e => { e.preventDefault(); setRulesOpen(true); }}
                                            >
                                                {t('terms.rulesLinkText')}
                                            </button>
                                            {t('terms.joiner')}
                                            <Link
                                                href="/faq#terms"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="v2-res-rules-link"
                                            >
                                                {t('terms.termsLinkText')}
                                            </Link>
                                            {t('terms.agreeSuffix')} <span className="req">{t('fields.required')}</span>
                                        </div>
                                        <div className="s">{t('terms.agreeDescription')}</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="v2-res-error" role="alert">
                                <div className="v2-res-error-ic">!</div>
                                <div>
                                    <div className="t">{t('errors.errorTitle')}</div>
                                    <div className="s">{errorMsg}</div>
                                </div>
                            </div>
                        )}

                        <div className="v2-res-submit">
                            <button
                                type="submit"
                                className={`v2-btn${canSubmit ? '' : ' is-disabled'}`}
                                disabled={!canSubmit}
                                style={{ padding: '16px 28px', fontSize: 14, width: '100%' }}
                            >
                                {status === 'sending' ? t('submit.sending') : t('submit.idle')}
                            </button>
                            <div style={{ fontSize: 11.5, color: 'var(--v2-muted)', marginTop: 10, textAlign: 'center' }}>
                                {t('submit.disclaimer1')}<br />
                                {t('submit.disclaimer2Prefix')}
                                <a href="#" style={{ color: 'var(--v2-mocha)', textDecoration: 'underline' }}>
                                    {t('submit.disclaimer2Link')}
                                </a>
                                {t('submit.disclaimer2Suffix')}
                            </div>
                        </div>
                    </form>

                    {/* ─── Right: Live summary ─────────────────────────── */}
                    <aside className="v2-res-summary">
                        <div className="v2-res-summary-card">
                            <div
                                className="v2-res-summary-img"
                                style={{
                                    background: r.photos.length
                                        ? `url("${IMG[r.photos[0]]}") center/cover`
                                        : `repeating-linear-gradient(135deg, var(--v2-sand-light) 0 14px, var(--v2-sand) 14px 28px)`,
                                }}
                            >
                                {!r.photos.length && (
                                    <span style={{
                                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--v2-muted)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                                    }}>
                                        {tRoom(`${r.id}.available`)}
                                    </span>
                                )}
                            </div>
                            <div className="v2-res-summary-body">
                                <div className="v2-res-summary-name">{tRoom(`${r.id}.name`)}</div>
                                <div className="v2-res-summary-meta">{r.size}{tCommon('metersSq')} · {r.capacity}{tCommon('guestsUnit')} · {r.floor}</div>
                            </div>
                            <div className="v2-res-summary-stay">
                                <div><span className="k">{t('summary.stayKeys.in')}</span><span className="v">{checkin}</span></div>
                                <div><span className="k">{t('summary.stayKeys.out')}</span><span className="v">{checkout}</span></div>
                                <div><span className="k">{t('summary.stayKeys.period')}</span><span className="v">{months === 0.5 ? '2' + tCommon('weeksUnit') : months + tCommon('monthsUnit')}</span></div>
                                <div><span className="k">{t('summary.stayKeys.guests')}</span><span className="v">{guests}{tCommon('guestsUnit')}</span></div>
                            </div>
                            <div className="v2-res-summary-pricing">
                                <div className="line">
                                    <span className="l">{t('summary.rentLine')} {months === 0.5 ? '' : `${tCommon('approx')} ${formatPrice(code, unitPrice)} × ${months}`}</span>
                                    <span className="r">{tCommon('approx')} {formatPrice(code, rent)}</span>
                                </div>
                                {disc > 0 && (
                                    <div className="line disc">
                                        <span className="l">{t('summary.discountLine')} {discount * 100}%</span>
                                        <span className="r">−{formatPrice(code, disc)}</span>
                                    </div>
                                )}
                                <div className="line">
                                    <span className="l">{t('summary.electricityLine')}</span>
                                    <span className="r">{tCommon('approx')} {formatPrice(code, elec)}</span>
                                </div>
                                <div className="line">
                                    <span className="l">{t('summary.includedLine')}</span>
                                    <span className="r inc">{t('summary.included')}</span>
                                </div>
                                <div className="line total">
                                    <span className="l">{t('summary.total')}</span>
                                    <span className="r">{tCommon('approx')} {formatPrice(code, total)}</span>
                                </div>
                                <div className="avg">
                                    {t('summary.monthlyAvg')} {tCommon('approx')} {formatPrice(code, Math.round(total / months))} · {tCommon('currencyNote')}
                                </div>
                                <div style={{ fontSize: 10, opacity: 0.8, color: 'var(--v2-muted)', marginTop: 8, textAlign: 'right' }}>
                                    {tCommon('priceRefNote')}
                                </div>
                            </div>
                            <div className="v2-res-summary-deposit">
                                <div className="k">{t('summary.depositTitle')}</div>
                                <div className="v">
                                    {tCommon('approx')} {formatPrice(code, total)}{' '}
                                    <small>{t('summary.depositSuffix')}</small>
                                </div>
                                <div className="note">{t('summary.balanceNote')}</div>
                            </div>
                        </div>
                    </aside>
                </div>
            </section>

            {/* ─── House Rules Modal ─────────────────────────────────────── */}
            {rulesOpen && (
                <div
                    className="v2-res-modal-backdrop"
                    onClick={() => setRulesOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="v2-res-modal-title"
                >
                    <div className="v2-res-modal" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            className="v2-res-modal-close"
                            onClick={() => setRulesOpen(false)}
                            aria-label={t('modal.closeAria')}
                        >×</button>
                        <div className="v2-res-modal-eyebrow">{t('modal.eyebrow')}</div>
                        <h2 id="v2-res-modal-title" className="v2-res-modal-title">{t('modal.title')}</h2>
                        <p className="v2-res-modal-lead">{t('modal.lead')}</p>
                        <ul className="v2-res-modal-list">
                            {houseRulesItems.map((label, i) => (
                                <li key={i}>
                                    <span className="ic">◐</span>
                                    <span className="l">{label}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="v2-res-modal-foot">
                            <div className="v2-res-modal-foot-note">{t('modal.footNote')}</div>
                            <button
                                type="button"
                                className="v2-btn"
                                onClick={() => setRulesOpen(false)}
                                style={{ padding: '12px 24px', fontSize: 13 }}
                            >
                                {t('modal.closeButton')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
