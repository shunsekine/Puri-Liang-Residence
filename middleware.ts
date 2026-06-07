import createMiddleware from 'next-intl/middleware';
import { routing } from './navigation';

export default createMiddleware(routing);

export const config = {
    // 2026-05 update: id を matcher に追加 (ja|en → ja|en|id)
    matcher: ['/', '/(ja|en|id)/:path*']
};
