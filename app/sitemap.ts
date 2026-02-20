import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://puri-liang-residence.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
    const locales = ['en', 'ja'];
    const routes = ['', '/features', '/rooms', '/location', '/reserve'];

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
