import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    // 2026-05 update: id (Bahasa Indonesia) を追加
    // インドネシア人富裕層・長期滞在ノマド向けの3言語対応
    locales: ['ja', 'en', 'id'],
    defaultLocale: 'ja'
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
