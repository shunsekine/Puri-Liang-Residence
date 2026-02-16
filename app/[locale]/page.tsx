import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';

export default function Home() {
  const t = useTranslations('Home');
  const tHero = useTranslations('Hero');

  return (
    <main>
      {/* Split Hero Section */}
      <section className="split-hero">
        <div className="split-hero-image">
          {/* User provided image should be placed at public/images/hero.jpg */}
          <div className="hero-bg-img" style={{
            backgroundImage: "url('/images/Home_Villa.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'absolute',
            inset: 0
          }} />
          <div className="split-hero-placeholder">
            {/* Overlay if needed */}
          </div>
        </div>
        <div className="split-hero-content">
          <h1 className="split-hero-title" dangerouslySetInnerHTML={{ __html: tHero.raw('splitTitle') }} />
          <p className="split-hero-desc" dangerouslySetInnerHTML={{ __html: tHero.raw('splitDesc') }} />
          <Link href="/features" className="split-hero-cta">
            {tHero('splitCta')}
          </Link>
        </div>
      </section>

      {/* Our Community & Vibe */}
      <section className="community-section">
        <h2 className="section-title-decorated">{t('communityTitle')}</h2>
        <div className="community-grid">
          <div className="community-card">
            <div className="community-icon">🎉</div>
            <h3>{t('eventTitle')}</h3>
            <p>{t('eventDesc')}</p>
          </div>
          <div className="community-card">
            <div className="community-icon">🧘</div>
            <h3>{t('wellnessTitle')}</h3>
            <p>{t('wellnessDesc')}</p>
          </div>
          <div className="community-card">
            <div className="community-icon">🤝</div>
            <h3>{t('localTitle')}</h3>
            <p>{t('localDesc')}</p>
          </div>
        </div>
      </section>

      {/* Authentic Bali Life & Comfort */}
      <section className="bali-life-section">
        <h2 className="section-title-decorated">{t('lifeTitle')}</h2>
        <div className="bali-life-grid">
          <div className="bali-life-card">
            <div className="bali-life-img">
              <span>🏡</span>
            </div>
            <h3>{t('spaceTitle')}</h3>
            <p>{t('spaceDesc')}</p>
            <Link href="/rooms" className="bali-life-link">{t('spaceLink')}</Link>
          </div>
          <div className="bali-life-card">
            <div className="bali-life-img">
              <span>🌴</span>
            </div>
            <h3>{t('realBaliTitle')}</h3>
            <p>{t('realBaliDesc')}</p>
            <Link href="/location" className="bali-life-link">{t('realBaliLink')}</Link>
          </div>
        </div>
      </section>

      {/* Comfortable Workspace */}
      <section className="workspace-section">
        <div className="workspace-container">
          <div className="workspace-content">
            <h2>{t('workspaceSectionTitle')}</h2>
            <h3>{t('workspaceMainTitle')}</h3>
            <p>{t('workspaceDesc')}</p>
            <ul className="workspace-features">
              <li>📶 {t('feat1')}</li>
              <li>⚡ {t('feat2')}</li>
              <li>🔇 {t('feat3')}</li>
            </ul>
            <Link href="/features" className="workspace-cta">{t('workspaceCta')}</Link>
          </div>
          <div className="workspace-image">
            <div className="workspace-placeholder">
              <span>💻</span>
            </div>
          </div>
        </div>
      </section>

      {/* What Our Residents Say */}
      <section className="testimonials-section">
        <h2 className="section-title-decorated">{t('testimonialTitle')}</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <p className="testimonial-text">{t('test1Text')}</p>
            <p className="testimonial-author">{t('test1Author')}</p>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-text">{t('test2Text')}</p>
            <p className="testimonial-author">{t('test2Author')}</p>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-text">{t('test3Text')}</p>
            <p className="testimonial-author">{t('test3Author')}</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="home-cta-section">
        <h2>{t('ctaTitle')}</h2>
        <p>{t('ctaDesc')}</p>
        <Link href="/reserve" className="home-cta-btn">{t('ctaBtn')}</Link>
      </section>
    </main>
  );
}
