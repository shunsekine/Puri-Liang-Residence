import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://puri-liang-residence.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
    // Terms live in /faq#terms (no /terms page)
    const locales = ['ja', 'en', 'id'];
    const routes = ['', '/features', '/rooms', '/location', '/faq', '/reserve', '/privacy'];

    const sitemapEntries = routes.flatMap((route) => {
        return locales.map((locale) => ({
            url: `${baseUrl}/${locale}${route}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: route === '' ? 1 : 0.8,
        }));
    });

    return sitemapEntries;
}
