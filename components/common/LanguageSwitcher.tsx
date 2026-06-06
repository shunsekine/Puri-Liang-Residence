'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { useTransition } from 'react';

type Locale = 'ja' | 'en' | 'id';

const LOCALES: { code: Locale; label: string }[] = [
    { code: 'ja', label: 'JP' },
    { code: 'en', label: 'EN' },
    { code: 'id', label: 'ID' },
];

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const switchLocale = (nextLocale: Locale) => {
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <div className="lang-switch">
            {LOCALES.map(({ code, label }) => (
                <button
                    key={code}
                    disabled={isPending}
                    onClick={() => switchLocale(code)}
                    className={locale === code ? 'active' : ''}
                    aria-label={`Switch language to ${label}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
