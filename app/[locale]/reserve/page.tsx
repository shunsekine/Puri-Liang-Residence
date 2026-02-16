'use client';
import { useState } from 'react';

export default function ReservePage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        roomType: '',
        checkIn: '',
        duration: '1',
        message: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('お問い合わせありがとうございます。担当者より48時間以内にご連絡いたします。');
    };

    return (
        <main>
            {/* Hero Banner */}
            <section className="page-hero">
                <h1 className="page-hero-title">ご予約・お問い合わせ</h1>
                <p className="page-hero-subtitle">Start your long-term stay in Bali</p>
            </section>

            {/* Reservation Form */}
            <section className="reservation-section">
                <div className="reservation-container">
                    <div className="reservation-info">
                        <h2>予約について</h2>
                        <p>
                            ご予約は1ヶ月単位となります。
                            下記フォームよりお問い合わせいただくか、
                            直接メールまたはお電話にてご連絡ください。
                        </p>
                        <div className="contact-info">
                            <div className="contact-item">
                                <span className="contact-icon">📧</span>
                                <span>contact@puriliang.com</span>
                            </div>
                            <div className="contact-item">
                                <span className="contact-icon">📱</span>
                                <span>+62 xxx-xxxx-xxxx</span>
                            </div>
                            <div className="contact-item">
                                <span className="contact-icon">📍</span>
                                <span>Tukad Balian, Tabanan, Bali</span>
                            </div>
                        </div>
                        <div className="price-summary">
                            <h3>料金一覧</h3>
                            <div className="price-item">
                                <span>ヴィラ</span>
                                <span>¥78,000 / 月</span>
                            </div>
                            <div className="price-item">
                                <span>キングスタジオ</span>
                                <span>¥58,000 / 月</span>
                            </div>
                            <div className="price-item">
                                <span>ツインスタジオ</span>
                                <span>¥48,000 / 月</span>
                            </div>
                        </div>
                    </div>

                    <form className="reservation-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">お名前 *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">メールアドレス *</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="roomType">部屋タイプ *</label>
                            <select
                                id="roomType"
                                name="roomType"
                                value={formData.roomType}
                                onChange={handleChange}
                                required
                            >
                                <option value="">選択してください</option>
                                <option value="villa">ヴィラ (¥78,000/月)</option>
                                <option value="king-studio">キングスタジオ (¥58,000/月)</option>
                                <option value="twin-studio">ツインスタジオ (¥48,000/月)</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="checkIn">希望入居日 *</label>
                                <input
                                    type="date"
                                    id="checkIn"
                                    name="checkIn"
                                    value={formData.checkIn}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="duration">滞在期間</label>
                                <select
                                    id="duration"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                >
                                    <option value="1">1ヶ月</option>
                                    <option value="2">2ヶ月</option>
                                    <option value="3">3ヶ月</option>
                                    <option value="6">6ヶ月</option>
                                    <option value="12">12ヶ月</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="message">ご質問・ご要望</label>
                            <textarea
                                id="message"
                                name="message"
                                rows={4}
                                value={formData.message}
                                onChange={handleChange}
                            ></textarea>
                        </div>

                        <button type="submit" className="submit-btn">
                            送信する
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
