import { getTranslations } from 'next-intl/server';

type Props = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata.Location' });

    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function LocationPage() {
    return (
        <main>
            {/* Hero Banner */}
            <section className="page-hero">
                <h1 className="page-hero-title">アクセス・ロケーション</h1>
                <p className="page-hero-subtitle">Tukad Balian, Bali - The perfect base for your adventure</p>
            </section>

            {/* Map Section */}
            <section className="location-map-section">
                <div className="location-map-container">
                    <div className="map-placeholder">
                        <p>🗺️ Google Map</p>
                        <p className="map-address">Tukad Balian, Tabanan, Bali, Indonesia</p>
                    </div>
                </div>
            </section>

            {/* Location Info */}
            <section className="location-info-section">
                <div className="location-info-grid">
                    <div className="location-info-card">
                        <h3>🛫 空港からのアクセス</h3>
                        <p>ングラ・ライ国際空港から車で約1時間30分</p>
                    </div>
                    <div className="location-info-card">
                        <h3>🏖️ 最寄りのビーチ</h3>
                        <p>バリアンビーチまで車で10分<br />サーフスポットとして有名</p>
                    </div>
                    <div className="location-info-card">
                        <h3>🏪 周辺施設</h3>
                        <p>スーパー・コンビニ：徒歩10分<br />カフェ・レストラン：徒歩5分</p>
                    </div>
                    <div className="location-info-card">
                        <h3>🚗 観光地へのアクセス</h3>
                        <p>ウブド：車で45分<br />スミニャック：車で1時間</p>
                    </div>
                </div>
            </section>

            {/* Why This Location */}
            <section className="why-location-section">
                <h2 className="section-title">なぜトゥカッド・バリアン？</h2>
                <div className="why-location-content">
                    <p>
                        トゥカッド・バリアンは、バリ島の西海岸に位置する静かなエリアです。
                        観光地の喧騒から離れ、本格的なサーフスポットとローカルな雰囲気が魅力。
                        リモートワーカーやサーファーにとって、集中と冒険の両方が叶う理想的な場所です。
                    </p>
                    <ul className="why-list">
                        <li>✓ 観光客が少なく、静かな環境</li>
                        <li>✓ 手付かずの自然とローカル文化</li>
                        <li>✓ リーズナブルな物価</li>
                        <li>✓ フレンドリーな地元コミュニティ</li>
                    </ul>
                </div>
            </section>
        </main>
    );
}
