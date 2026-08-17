import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  ArrowLeft, 
  Search, 
  Lock, 
  Compass, 
  Sun, 
  Moon, 
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  LayoutDashboard
} from 'lucide-react';

function NotFoundPage() {
  const { t, lang, switchLang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(user ? '/dashboard' : '/welcome');
    }
  };

  const getHomeDestination = () => {
    if (user) {
      return user.role === 'admin' ? '/dashboard' : '/my-locker';
    }
    return '/welcome';
  };

  return (
    <div className="nf-page">
      {/* Top Navigation */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to={getHomeDestination()} className="lp-nav-brand" style={{ textDecoration: 'none' }}>
            <img src="/aitu-logo.png" alt="AITU" className="lp-nav-logo logo-light" />
            <img src="/aitu-logo-white.png" alt="AITU" className="lp-nav-logo logo-dark" />
            <span>{t('nav_brand')}</span>
          </Link>
          <div className="lp-nav-right">
            <button
              className="lp-icon-btn lang-badge-btn"
              onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
              title={lang === 'en' ? 'Русский' : 'English'}
            >
              <span className="lang-text-code">{lang === 'en' ? 'RU' : 'EN'}</span>
            </button>
            <button
              className="lp-icon-btn"
              onClick={() => setTheme(th => th === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
            >
              {theme === 'light' ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
            </button>
            <Link to={getHomeDestination()} className="lp-cta-btn">
              {user ? t('nav_dashboard') : t('welcome_login_btn')}
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main 404 Hero Container */}
      <main className="nf-container">
        {/* Glow ambient background */}
        <div className="lp-hero-glow lp-hero-glow-1" style={{ opacity: 0.7 }} />
        <div className="lp-hero-glow lp-hero-glow-2" style={{ opacity: 0.7 }} />

        <div className="nf-card">
          {/* Visual Locker 404 Illustration */}
          <div className="nf-illustration">
            <div className="nf-locker-box">
              <div className="nf-locker-header">
                <div className="nf-locker-vent"></div>
                <div className="nf-locker-vent"></div>
                <div className="nf-locker-vent"></div>
              </div>
              <div className="nf-locker-center">
                <div className="nf-lock-icon-wrap">
                  <Lock size={36} strokeWidth={1.75} className="nf-lock-icon" />
                  <span className="nf-lock-tag">404</span>
                </div>
              </div>
              <div className="nf-locker-handle"></div>
            </div>
            <div className="nf-badge-tag">
              <ShieldAlert size={14} />
              <span>{t('nf_badge')}</span>
            </div>
          </div>

          <h1 className="nf-title">{t('nf_title')}</h1>
          <p className="nf-subtitle">{t('nf_subtitle')}</p>

          {/* Action Buttons */}
          <div className="nf-actions">
            <button type="button" className="btn btn-secondary nf-back-btn" onClick={handleGoBack}>
              <ArrowLeft size={16} />
              <span>{t('nf_btn_back')}</span>
            </button>

            <Link to={getHomeDestination()} className="btn btn-primary nf-home-btn">
              {user ? <LayoutDashboard size={16} /> : <Home size={16} />}
              <span>{user ? t('nf_btn_home') : t('nf_btn_welcome')}</span>
            </Link>
          </div>

          {/* Quick links shortcut strip */}
          <div className="nf-shortcuts">
            <span className="nf-shortcuts-title">
              <Compass size={14} />
              {t('nf_quick_links')}
            </span>
            <div className="nf-shortcuts-list">
              {user?.role === 'admin' && (
                <>
                  <Link to="/lockers" className="nf-shortcut-chip">{t('nf_link_lockers')}</Link>
                  <Link to="/students" className="nf-shortcut-chip">{t('nf_link_students')}</Link>
                  <Link to="/incidents" className="nf-shortcut-chip">{t('nf_link_incidents')}</Link>
                  <Link to="/analytics" className="nf-shortcut-chip">{t('nav_analytics')}</Link>
                </>
              )}
              {user?.role === 'user' && (
                <>
                  <Link to="/my-locker" className="nf-shortcut-chip">{t('nf_link_mylocker')}</Link>
                  <Link to="/notifications" className="nf-shortcut-chip">{t('nav_notifications')}</Link>
                </>
              )}
              {!user && (
                <>
                  <Link to="/welcome" className="nf-shortcut-chip">{t('nf_btn_welcome')}</Link>
                  <Link to="/login" className="nf-shortcut-chip">{t('nf_link_login')}</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="lp-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--gray-200)' }}>
        <p>© 2026 Astana IT University — {t('welcome_footer_rights')}</p>
      </footer>
    </div>
  );
}

export default NotFoundPage;
