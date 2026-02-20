'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';

export default function Header() {
    const t = useTranslations('Navigation');
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isActive = (path: string) => {
        if (path === '/' && (pathname === '/' || pathname === '/ja' || pathname === '/en')) return true;
        // Handle localized paths (e.g. /ja/features, /en/features)
        const currentPath = pathname.replace(/^\/(ja|en)/, '') || '/';
        if (path === '/' && currentPath === '/') return true;
        if (path !== '/' && currentPath.startsWith(path)) return true;
        return false;
    };

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    return (
        <header className="site-header">
            <div className="site-header-inner">
                <Link href="/" className="site-logo" onClick={closeMenu}>
                    <Image src="/logo.png" alt="Puri Liang Logo" width={30} height={30} className="site-logo-icon" />
                    <span>Puri Liang Residence, Bali</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="site-nav desktop-nav">
                    <Link href="/" className={isActive('/') ? "nav-active" : ""}>{t('home')}</Link>
                    <Link href="/features" className={isActive('/features') ? "nav-active" : ""}>{t('features')}</Link>
                    <Link href="/rooms" className={isActive('/rooms') ? "nav-active" : ""}>{t('rooms')}</Link>
                    <Link href="/location" className={isActive('/location') ? "nav-active" : ""}>{t('location')}</Link>
                    <Link href="/reserve" className="nav-reserve-btn">{t('reserve')}</Link>
                </nav>

                <div className="header-controls">
                    <div className="desktop-lang-switcher">
                        <LanguageSwitcher />
                    </div>

                    {/* Burger Button */}
                    <button
                        className="burger-btn"
                        onClick={toggleMenu}
                        aria-label="Toggle menu"
                        aria-expanded={isMenuOpen}
                    >
                        <span className={`burger-line ${isMenuOpen ? 'open' : ''}`}></span>
                        <span className={`burger-line ${isMenuOpen ? 'open' : ''}`}></span>
                        <span className={`burger-line ${isMenuOpen ? 'open' : ''}`}></span>
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
                <div className="mobile-menu-header">
                    <span className="mobile-menu-title">Menu</span>
                    <button className="close-menu-btn" onClick={closeMenu}>&times;</button>
                </div>
                <nav className="mobile-nav">
                    <Link href="/" onClick={closeMenu} className={isActive('/') ? "mobile-nav-item active" : "mobile-nav-item"}>{t('home')}</Link>
                    <Link href="/features" onClick={closeMenu} className={isActive('/features') ? "mobile-nav-item active" : "mobile-nav-item"}>{t('features')}</Link>
                    <Link href="/rooms" onClick={closeMenu} className={isActive('/rooms') ? "mobile-nav-item active" : "mobile-nav-item"}>{t('rooms')}</Link>
                    <Link href="/location" onClick={closeMenu} className={isActive('/location') ? "mobile-nav-item active" : "mobile-nav-item"}>{t('location')}</Link>
                    <Link href="/reserve" onClick={closeMenu} className="mobile-reserve-btn">{t('reserve')}</Link>
                </nav>
                <div className="mobile-lang-switcher">
                    <LanguageSwitcher />
                </div>
            </div>

            {/* Overlay Backdrop */}
            {isMenuOpen && <div className="menu-backdrop" onClick={closeMenu}></div>}
        </header>
    );
}
