import { getTranslations } from 'next-intl/server';
import ReserveForm from '@/components/pages/ReserveForm';

type Props = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Reserve' });

    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function ReservePage() {
    return (
        <main>
            {/* Hero Banner */}
            <section className="page-hero">
                <h1 className="page-hero-title">ご予約・お問い合わせ</h1>
                <p className="page-hero-subtitle">Start your long-term stay in Bali</p>
            </section>

            <ReserveForm />
        </main>
    );
}
