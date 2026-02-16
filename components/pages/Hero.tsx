import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import Image from 'next/image';

export default function Hero() {
    const t = useTranslations('Hero');

    return (
        <section className="hero">
            <div className="hero-bg">
                <Image
                    src="/hero-bg.jpg"
                    alt="Puri Liang Apartment"
                    fill
                    priority
                    style={{ objectFit: 'cover' }}
                />
            </div>
            <div className="hero-overlay"></div>
            <div className="hero-content">
                <h1 className="hero-title">{t('title')}</h1>
                <p className="hero-subtitle">{t('subtitle')}</p>
                <Link href="/rooms" className="hero-cta">
                    {t('cta')}
                </Link>
            </div>
        </section>
    );
}
