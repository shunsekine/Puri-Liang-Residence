'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const switchLocale = (nextLocale: 'en' | 'ja') => {
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <div className="lang-switch">
            <button
                disabled={isPending}
                onClick={() => switchLocale('ja')}
                className={locale === 'ja' ? 'active' : ''}
            >
                JP
            </button>
            <button
                disabled={isPending}
                onClick={() => switchLocale('en')}
                className={locale === 'en' ? 'active' : ''}
            >
                EN
            </button>
        </div>
    );
}
