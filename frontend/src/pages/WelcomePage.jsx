import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Lock, Users, BarChart3, ShieldCheck, Key, Building2, Bell, FileSpreadsheet } from 'lucide-react';

function WelcomePage() {
  const { t, lang, switchLang } = useLanguage();
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const features = [
    {
      icon: <Lock size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat1_title',
      descKey: 'welcome_feat1_desc',
      color: '#2563eb',
    },
    {
      icon: <Users size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat2_title',
      descKey: 'welcome_feat2_desc',
      color: '#7c3aed',
    },
    {
      icon: <BarChart3 size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat3_title',
      descKey: 'welcome_feat3_desc',
      color: '#059669',
    },
    {
      icon: <ShieldCheck size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat4_title',
      descKey: 'welcome_feat4_desc',
      color: '#dc2626',
    },
    {
      icon: <Key size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat5_title',
      descKey: 'welcome_feat5_desc',
      color: '#d97706',
    },
    {
      icon: <Building2 size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat6_title',
      descKey: 'welcome_feat6_desc',
      color: '#0891b2',
    },
    {
      icon: <Bell size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat7_title',
      descKey: 'welcome_feat7_desc',
      color: '#be185d',
    },
    {
      icon: <FileSpreadsheet size={32} strokeWidth={1.5} />,
      titleKey: 'welcome_feat8_title',
      descKey: 'welcome_feat8_desc',
      color: '#15803d',
    },
  ];

  const gallery = [
    {
      src: '/aitu-logo.png',
      srcDark: '/aitu-logo-white.png',
      captionKey: 'welcome_gallery1',
    },
    {
      src: '/logo.jpeg',
      captionKey: 'welcome_gallery2',
    },
    {
      icon: <Lock size={56} strokeWidth={1} />,
      captionKey: 'welcome_gallery3',
    },
  ];

  return (
    <div className="welcome-page">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="welcome-topbar">
        <div className="welcome-topbar-brand">
          <img src="/aitu-logo.png" alt="AITU" className="welcome-topbar-logo logo-light" />
          <img src="/aitu-logo-white.png" alt="AITU" className="welcome-topbar-logo logo-dark" />
          <span>{t('nav_brand')}</span>
        </div>
        <div className="welcome-topbar-actions">
          <button
            className="lang-toggle"
            onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
            title={lang === 'en' ? 'Русский' : 'English'}
          >
            {lang === 'en' ? '🇷🇺' : '🇬🇧'}
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
          >
            {theme === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
          </button>
          {user ? (
            <Link to="/" className="btn btn-primary btn-sm">{t('nav_dashboard')}</Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">{t('welcome_login_btn')}</Link>
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="welcome-hero">
        <div className="welcome-hero-content">
          <div className="welcome-hero-badge">{t('welcome_hero_badge')}</div>
          <h1 className="welcome-hero-title">{t('welcome_hero_title')}</h1>
          <p className="welcome-hero-subtitle">{t('welcome_hero_subtitle')}</p>
          <div className="welcome-hero-actions">
            {user ? (
              <Link to="/" className="btn btn-primary">{t('nav_dashboard')}</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary">{t('welcome_get_started')}</Link>
                <a href="#features" className="btn btn-outline">{t('welcome_learn_more')}</a>
              </>
            )}
          </div>
        </div>
        <div className="welcome-hero-visual">
          <div className="welcome-hero-locker-grid">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`welcome-locker-cell ${i % 3 === 1 ? 'occupied' : ''}`}>
                <Lock size={20} strokeWidth={1.5} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <section className="welcome-stats">
        <div className="welcome-stats-inner">
          <div className="welcome-stat-item">
            <span className="welcome-stat-number">500+</span>
            <span className="welcome-stat-label">{t('welcome_stat_lockers')}</span>
          </div>
          <div className="welcome-stat-divider" />
          <div className="welcome-stat-item">
            <span className="welcome-stat-number">3000+</span>
            <span className="welcome-stat-label">{t('welcome_stat_students')}</span>
          </div>
          <div className="welcome-stat-divider" />
          <div className="welcome-stat-item">
            <span className="welcome-stat-number">5</span>
            <span className="welcome-stat-label">{t('welcome_stat_floors')}</span>
          </div>
          <div className="welcome-stat-divider" />
          <div className="welcome-stat-item">
            <span className="welcome-stat-number">99.9%</span>
            <span className="welcome-stat-label">{t('welcome_stat_uptime')}</span>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="welcome-features" id="features">
        <div className="welcome-section-header">
          <h2>{t('welcome_features_title')}</h2>
          <p>{t('welcome_features_subtitle')}</p>
        </div>
        <div className="welcome-features-grid">
          {features.map((f) => (
            <div className="welcome-feature-card" key={f.titleKey}>
              <div className="welcome-feature-icon" style={{ color: f.color, background: `${f.color}18` }}>
                {f.icon}
              </div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gallery / image cards ────────────────────────────────── */}
      <section className="welcome-gallery" id="gallery">
        <div className="welcome-section-header">
          <h2>{t('welcome_gallery_title')}</h2>
          <p>{t('welcome_gallery_subtitle')}</p>
        </div>
        <div className="welcome-gallery-grid">
          {gallery.map((item) => (
            <div className="welcome-gallery-card" key={item.captionKey}>
              <div className="welcome-gallery-media">
                {item.icon ? (
                  <div className="welcome-gallery-icon">{item.icon}</div>
                ) : item.srcDark ? (
                  <>
                    <img src={item.src} alt={t(item.captionKey)} className="logo-light welcome-gallery-img" />
                    <img src={item.srcDark} alt={t(item.captionKey)} className="logo-dark welcome-gallery-img" />
                  </>
                ) : (
                  <img src={item.src} alt={t(item.captionKey)} className="welcome-gallery-img" />
                )}
              </div>
              <p className="welcome-gallery-caption">{t(item.captionKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="welcome-how">
        <div className="welcome-section-header">
          <h2>{t('welcome_how_title')}</h2>
        </div>
        <div className="welcome-how-steps">
          {[1, 2, 3, 4].map((n) => (
            <div className="welcome-how-step" key={n}>
              <div className="welcome-step-number">{n}</div>
              <h4>{t(`welcome_step${n}_title`)}</h4>
              <p>{t(`welcome_step${n}_desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      {!user && (
        <section className="welcome-cta">
          <h2>{t('welcome_cta_title')}</h2>
          <p>{t('welcome_cta_subtitle')}</p>
          <Link to="/login" className="btn btn-primary">{t('welcome_get_started')}</Link>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="welcome-footer">
        <p>© 2026 Astana IT University — {t('welcome_footer_rights')}</p>
      </footer>

    </div>
  );
}

export default WelcomePage;
