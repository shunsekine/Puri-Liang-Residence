'use client';
// V2 Bohemian Natural — Header
// - Adds /faq nav item (new V2 page)
// - Renames the top-level nav to "Stay" (was "Home" in legacy)
// - Uses V2 styling classes from app/globals.v2.css (.v2-nav)
// - Mobile menu uses a right-sliding drawer (78% width)

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';

type NavItem = { href: '/' | '/rooms' | '/features' | '/location' | '/faq'; key: 'stay' | 'rooms' | 'features' | 'location' | 'faq' };

const NAV_ITEMS: NavItem[] = [
    { href: '/', key: 'stay' },
    { href: '/rooms', key: 'rooms' },
    { href: '/features', key: 'features' },
    { href: '/location', key: 'location' },
    { href: '/faq', key: 'faq' },
];

export default function Header() {
    const t = useTranslations('Nav');
    const tBrand = useTranslations('Brand');
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close drawer on route change
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setIsMenuOpen(false); }, [pathname]);

    // Esc to close
    useEffect(() => {
        if (!isMenuOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    const isActive = (path: string) => {
        const clean = pathname.replace(/^\/(ja|en|id)/, '') || '/';
        if (path === '/') return clean === '/';
        return clean.startsWith(path);
    };

    return (
        <header className="v2-nav-wrapper">
            <nav className="v2-nav">
                <Link href="/" className="v2-nav-logo" onClick={() => setIsMenuOpen(false)}>
                    <Image src="/logo.png" alt="" width={32} height={32} />
                    <span>{tBrand('name')}</span>
                </Link>

                {/* Desktop nav (hidden under 720px via .v2-nav-mid media rule) */}
                <div className="v2-nav-mid desktop-only">
                    {NAV_ITEMS.map(({ href, key }) => (
                        <Link key={key} href={href} className={isActive(href) ? 'active' : ''}>
                            {t(key)}
                        </Link>
                    ))}
                </div>

                <div className="v2-nav-right">
                    <div className="desktop-only">
                        <LanguageSwitcher />
                    </div>
                    <Link href="/reserve" className="v2-btn">
                        {t('reserveCta')}
                    </Link>
                    {/* Burger (mobile only) */}
                    <button
                        type="button"
                        className="v2-nav-burger mobile-only"
                        onClick={() => setIsMenuOpen(true)}
                        aria-label="Open menu"
                        aria-expanded={isMenuOpen}
                    >
                        <span></span><span></span><span></span>
                    </button>
                </div>
            </nav>

            {/* Mobile drawer */}
            <div className={`v2-nav-drawer${isMenuOpen ? ' open' : ''}`}>
                <div className="v2-nav-drawer-head">
                    <span>Menu</span>
                    <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close menu">×</button>
                </div>
                <div className="v2-nav-drawer-body">
                    {NAV_ITEMS.map(({ href, key }) => (
                        <Link key={key} href={href} className={`v2-nav-drawer-item${isActive(href) ? ' active' : ''}`}>
                            {t(key)}
                        </Link>
                    ))}
                    <Link href="/reserve" className="v2-btn" style={{ marginTop: 12, textAlign: 'center' }}>
                        {t('reserveCta')}
                    </Link>
                </div>
                <div className="v2-nav-drawer-lang">
                    <LanguageSwitcher />
                </div>
            </div>
            {isMenuOpen && <div className="v2-nav-backdrop" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />}

            <style jsx>{`
                .v2-nav-wrapper { position: sticky; top: 0; z-index: 50; }
                .v2-nav-burger {
                    width: 40px; height: 40px;
                    border: 1px solid var(--v2-rule); background: var(--v2-cream);
                    border-radius: 12px;
                    display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;
                    cursor: pointer;
                }
                .v2-nav-burger span {
                    display: block; width: 18px; height: 1.5px;
                    background: var(--v2-mocha);
                }
                .desktop-only { display: flex; }
                .mobile-only { display: none; }
                @media (max-width: 820px) {
                    .desktop-only { display: none; }
                    .mobile-only { display: flex; }
                }
                .v2-nav-drawer {
                    position: fixed; top: 0; right: 0; height: 100vh; width: 78%;
                    max-width: 360px;
                    background: var(--v2-cream);
                    border-left: 1px solid var(--v2-rule);
                    transform: translateX(100%);
                    transition: transform 0.25s ease-out;
                    z-index: 60;
                    display: flex; flex-direction: column;
                }
                .v2-nav-drawer.open { transform: translateX(0); }
                .v2-nav-drawer-head {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 20px 24px; border-bottom: 1px dashed var(--v2-rule);
                    font-family: var(--v2-display); font-size: 18px; color: var(--v2-mocha);
                }
                .v2-nav-drawer-head button {
                    width: 32px; height: 32px; border-radius: 50%; border: none;
                    background: var(--v2-sand-light); color: var(--v2-mocha);
                    font-size: 22px; line-height: 1; cursor: pointer;
                }
                .v2-nav-drawer-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
                .v2-nav-drawer-item {
                    padding: 14px 16px; border-radius: 12px; text-decoration: none;
                    color: var(--v2-mocha); font-size: 15px;
                    transition: background 0.15s;
                }
                .v2-nav-drawer-item:hover { background: var(--v2-sand-light); }
                .v2-nav-drawer-item.active { background: var(--v2-sage); color: var(--v2-cream); }
                .v2-nav-drawer-lang { padding: 16px 24px; border-top: 1px dashed var(--v2-rule); }
                .v2-nav-backdrop {
                    position: fixed; inset: 0; background: rgba(58, 46, 34, 0.4);
                    z-index: 55;
                }
            `}</style>
        </header>
    );
}
