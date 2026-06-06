// V2 Bohemian Natural — Footer
// Multi-column footer reading from messages.Footer + messages.Brand
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export default function Footer() {
    const t = useTranslations('Footer');
    const tNav = useTranslations('Nav');
    const tBrand = useTranslations('Brand');
    const tCommon = useTranslations('Common');
    const currentYear = new Date().getFullYear();

    // Pull link labels from Footer.stayLinks etc. (arrays in messages)
    const stayLinks = t.raw('stayLinks') as string[];
    const placeLinks = t.raw('placeLinks') as string[];
    const contactLinks = t.raw('contactLinks') as string[];

    return (
        <footer className="v2-footer">
            <div>
                <Link href="/" className="v2-footer-logo">
                    <Image src="/logo.png" alt="" width={36} height={36} />
                    <span>{tBrand('name')}</span>
                </Link>
                <div style={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {tBrand('address')}
                </div>
            </div>

            <div>
                <h4>{t('stayHeading')}</h4>
                <ul>
                    <li><Link href="/rooms">{stayLinks[0] ?? tNav('rooms')}</Link></li>
                    <li><Link href="/features">{stayLinks[1] ?? tNav('features')}</Link></li>
                    <li><Link href="/reserve">{stayLinks[2] ?? tNav('reserve')}</Link></li>
                </ul>
            </div>

            <div>
                <h4>{t('placeHeading')}</h4>
                <ul>
                    <li><Link href="/location">{placeLinks[0] ?? tNav('location')}</Link></li>
                    <li><Link href="/location#neighborhood">{placeLinks[1] ?? '—'}</Link></li>
                    <li><Link href="/#story">{placeLinks[2] ?? '—'}</Link></li>
                </ul>
            </div>

            <div>
                <h4>{t('contactHeading')}</h4>
                <ul>
                    <li><a href={`mailto:${tBrand('email')}`}>{contactLinks[0] ?? 'Email'}</a></li>
                    <li><a href="#">{contactLinks[1] ?? 'WhatsApp'}</a></li>
                    <li><a href="#" target="_blank" rel="noopener">{contactLinks[2] ?? 'Instagram'}</a></li>
                </ul>
            </div>

            <div className="v2-footer-bottom">
                <span>© {currentYear} {tBrand('fullName')}. All Rights Reserved.</span>
                <span>{tCommon('languagesLabel')}</span>
            </div>
        </footer>
    );
}
