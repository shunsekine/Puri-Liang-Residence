import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import ImageCarousel from '@/components/common/ImageCarousel';

export default function RoomsPage() {
    const t = useTranslations('Rooms');

    const rooms = [
        {
            id: 'villa',
            name: t('villa'),
            price: '78,000',
            size: '50',
            capacity: '4',
            features: ['キングベッド', 'プライベートガーデン', 'フルキッチン', 'リビングエリア'],
            images: [
                '/images/Room_Villa_1.jpg',
                '/images/Room_Villa_2.jpg',
                '/images/Room_Villa_3.jpg'
            ]
        },
        {
            id: 'king-studio',
            name: t('kingStudio'),
            price: '58,000',
            size: '30',
            capacity: '2',
            features: ['キングベッド', 'ワークデスク', 'ミニキッチン', 'バルコニー'],
            images: [] // No user provided images yet
        },
        {
            id: 'twin-studio',
            name: t('twinStudio'),
            price: '48,000',
            size: '20',
            capacity: '2',
            features: ['シングルベッド×2', 'ワークデスク', 'ミニキッチン', 'エアコン完備'],
            images: [
                '/images/Room_Twin Studio_1.webp',
                '/images/Room_Twin Studio_2.webp'
            ]
        },
    ];

    return (
        <main>
            {/* Hero Banner */}
            <section className="page-hero">
                <h1 className="page-hero-title">{t('title')}</h1>
                <p className="page-hero-subtitle">Find the perfect space for your long-term stay</p>
            </section>

            {/* Rooms Grid */}
            <section className="rooms-detail-section">
                <div className="rooms-detail-grid">
                    {rooms.map((room) => (
                        <div key={room.id} className="room-detail-card">
                            <ImageCarousel images={room.images} alt={room.name} />
                            <div className="room-detail-content">
                                <h2 className="room-detail-title">{room.name}</h2>
                                <div className="room-detail-meta">
                                    <span>~{room.size}㎡</span>
                                    <span>•</span>
                                    <span>定員{room.capacity}名</span>
                                </div>
                                <p className="room-detail-price">
                                    {t('priceMonthly', { price: room.price })}
                                </p>
                                <ul className="room-features">
                                    {room.features.map((feature, idx) => (
                                        <li key={idx}>{feature}</li>
                                    ))}
                                </ul>
                                <Link href="/reserve" className="room-cta-btn">
                                    予約する
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Amenities */}
            <section className="amenities-section">
                <h2 className="section-title">共通設備・サービス</h2>
                <div className="amenities-grid">
                    <div className="amenity-item">
                        <span className="amenity-icon">📶</span>
                        <span>高速Wi-Fi</span>
                    </div>
                    <div className="amenity-item">
                        <span className="amenity-icon">❄️</span>
                        <span>エアコン</span>
                    </div>
                    <div className="amenity-item">
                        <span className="amenity-icon">🚿</span>
                        <span>温水シャワー</span>
                    </div>
                    <div className="amenity-item">
                        <span className="amenity-icon">🧹</span>
                        <span>週2回清掃</span>
                    </div>
                    <div className="amenity-item">
                        <span className="amenity-icon">🧺</span>
                        <span>ランドリー</span>
                    </div>
                    <div className="amenity-item">
                        <span className="amenity-icon">🏍️</span>
                        <span>駐車場</span>
                    </div>
                </div>
            </section>
        </main>
    );
}
