'use client';
// FAQ accordion item — toggles open/closed.
import { useState } from 'react';

export default function FAQAccordionItem({
    item,
    index,
}: {
    item: { q: string; a: string };
    index: number;
}) {
    const [open, setOpen] = useState(index === 0);
    return (
        <div className={`v2-faqp-item${open ? ' open' : ''}`}>
            <button type="button" className="v2-faqp-q" onClick={() => setOpen(!open)}>
                <span className="num">{String(index + 1).padStart(2, '0')}</span>
                <span className="q">{item.q}</span>
                <span className="plus">{open ? '−' : '＋'}</span>
            </button>
            {open && <div className="v2-faqp-a">{item.a}</div>}
        </div>
    );
}
