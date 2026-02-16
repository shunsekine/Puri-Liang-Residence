import { useTranslations } from 'next-intl';

export default function FeaturesPage() {
    const t = useTranslations('Features');

    return (
        <main>
            {/* Hero Banner */}
            <section className="page-hero">
                <h1 className="page-hero-title">{t('title')}</h1>
                <p className="page-hero-subtitle">Why digital nomads and surfers choose Puri Liang</p>
            </section>

            {/* Features Detail */}
            <section className="features-detail-section">
                <div className="features-detail-grid">
                    {/* Feature 1 */}
                    <div className="feature-detail-card">
                        <div className="feature-detail-img">
                            <div className="feature-placeholder">📶</div>
                        </div>
                        <div className="feature-detail-content">
                            <h2>{t('workTitle')}</h2>
                            <p>{t('workDesc')}</p>
                            <ul className="feature-list">
                                <li>高速光ファイバーインターネット</li>
                                <li>専用ワークデスク&チェア</li>
                                <li>静かな作業環境</li>
                                <li>24時間利用可能</li>
                            </ul>
                        </div>
                    </div>

                    {/* Feature 2 */}
                    <div className="feature-detail-card reverse">
                        <div className="feature-detail-img">
                            <div className="feature-placeholder">🏄</div>
                        </div>
                        <div className="feature-detail-content">
                            <h2>{t('lifeTitle')}</h2>
                            <p>{t('lifeDesc')}</p>
                            <ul className="feature-list">
                                <li>サーフボード保管スペース</li>
                                <li>屋外シャワー完備</li>
                                <li>ビーチまで車で10分</li>
                                <li>サーフスポット情報提供</li>
                            </ul>
                        </div>
                    </div>

                    {/* Feature 3 */}
                    <div className="feature-detail-card">
                        <div className="feature-detail-img">
                            <div className="feature-placeholder">🤝</div>
                        </div>
                        <div className="feature-detail-content">
                            <h2>{t('costTitle')}</h2>
                            <p>{t('costDesc')}</p>
                            <ul className="feature-list">
                                <li>コミュニティイベント</li>
                                <li>近隣のカフェ・レストラン</li>
                                <li>スーパー・コンビニ徒歩圏内</li>
                                <li>バイクレンタル手配可能</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
