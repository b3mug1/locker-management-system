import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Lock, Users, BarChart3, ShieldCheck, Key, Building2, Bell, FileSpreadsheet, ArrowRight, CheckCircle2 } from 'lucide-react';

function WelcomePage() {
  const { t, lang, switchLang } = useLanguage();
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const features = [
    { icon: <Lock size={22} strokeWidth={1.75} />,         titleKey: 'welcome_feat1_title', descKey: 'welcome_feat1_desc' },
    { icon: <Users size={22} strokeWidth={1.75} />,        titleKey: 'welcome_feat2_title', descKey: 'welcome_feat2_desc' },
    { icon: <BarChart3 size={22} strokeWidth={1.75} />,    titleKey: 'welcome_feat3_title', descKey: 'welcome_feat3_desc' },
    { icon: <ShieldCheck size={22} strokeWidth={1.75} />,  titleKey: 'welcome_feat4_title', descKey: 'welcome_feat4_desc' },
    { icon: <Key size={22} strokeWidth={1.75} />,          titleKey: 'welcome_feat5_title', descKey: 'welcome_feat5_desc' },
    { icon: <Building2 size={22} strokeWidth={1.75} />,    titleKey: 'welcome_feat6_title', descKey: 'welcome_feat6_desc' },
    { icon: <Bell size={22} strokeWidth={1.75} />,         titleKey: 'welcome_feat7_title', descKey: 'welcome_feat7_desc' },
    { icon: <FileSpreadsheet size={22} strokeWidth={1.75} />, titleKey: 'welcome_feat8_title', descKey: 'welcome_feat8_desc' },
  ];

  const steps = [
    { n: 1, titleKey: 'welcome_step1_title', descKey: 'welcome_step1_desc' },
    { n: 2, titleKey: 'welcome_step2_title', descKey: 'welcome_step2_desc' },
    { n: 3, titleKey: 'welcome_step3_title', descKey: 'welcome_step3_desc' },
    { n: 4, titleKey: 'welcome_step4_title', descKey: 'welcome_step4_desc' },
  ];

  return (
    <div className="lp-page">

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <img src="/aitu-logo.png"       alt="AITU" className="lp-nav-logo logo-light" />
            <img src="/aitu-logo-white.png" alt="AITU" className="lp-nav-logo logo-dark"  />
            <span>{t('nav_brand')}</span>
          </div>
          <div className="lp-nav-right">
            <button
              className="lp-icon-btn"
              onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
              title={lang === 'en' ? 'Русский' : 'English'}
            >
              {lang === 'en' ? '🇷🇺' : '🇬🇧'}
            </button>
            <button
              className="lp-icon-btn"
              onClick={() => setTheme(th => th === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
            >
              {theme === 'light' ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
            </button>
            <Link to={user ? '/dashboard' : '/login'} className="lp-cta-btn">
              {user ? t('nav_dashboard') : t('welcome_login_btn')}
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-glow lp-hero-glow-1" />
        <div className="lp-hero-glow lp-hero-glow-2" />
        <div className="lp-hero-inner">
          <div className="lp-hero-pill">{t('welcome_hero_badge')}</div>
          <h1 className="lp-hero-h1">
            {t('welcome_hero_title')}
          </h1>
          <p className="lp-hero-sub">{t('welcome_hero_subtitle')}</p>
          {!user && (
            <div className="lp-hero-btns">
              <Link to="/login" className="lp-cta-btn lp-cta-lg">{t('welcome_get_started')} <ArrowRight size={16} /></Link>
              <a href="#features" className="lp-ghost-btn">{t('welcome_learn_more')}</a>
            </div>
          )}

          {/* mock dashboard card */}
          <div className="lp-mockup">
            <div className="lp-mockup-bar">
              <span /><span /><span />
            </div>
            <div className="lp-mockup-body">
              <div className="lp-mock-stat"><span className="lp-mock-num">500+</span><span>{t('welcome_stat_lockers')}</span></div>
              <div className="lp-mock-stat"><span className="lp-mock-num">3 000+</span><span>{t('welcome_stat_students')}</span></div>
              <div className="lp-mock-stat"><span className="lp-mock-num">5</span><span>{t('welcome_stat_floors')}</span></div>
              <div className="lp-mock-stat"><span className="lp-mock-num lp-mock-green">99.9%</span><span>{t('welcome_stat_uptime')}</span></div>
            </div>
            <div className="lp-mock-lockers">
              {[...Array(12)].map((_, i) => (
                <div key={i} className={`lp-mock-cell ${[1,4,7].includes(i) ? 'lp-mock-occupied' : i === 9 ? 'lp-mock-maintenance' : ''}`}>
                  <Lock size={14} strokeWidth={2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="lp-features" id="features">
        <div className="lp-section-label">{t('welcome_features_title')}</div>
        <h2 className="lp-section-h2">{t('welcome_features_subtitle')}</h2>
        <div className="lp-feat-grid">
          {features.map((f) => (
            <div className="lp-feat-card" key={f.titleKey}>
              <div className="lp-feat-icon">{f.icon}</div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="lp-how">
        <div className="lp-section-label">{t('welcome_how_title')}</div>
        <h2 className="lp-section-h2">{t('welcome_how_title')}</h2>
        <div className="lp-steps">
          {steps.map(({ n, titleKey, descKey }, idx) => (
            <React.Fragment key={n}>
              <div className="lp-step">
                <div className="lp-step-num">{n}</div>
                <div>
                  <h4>{t(titleKey)}</h4>
                  <p>{t(descKey)}</p>
                </div>
              </div>
              {idx < steps.length - 1 && <div className="lp-step-arrow"><ArrowRight size={18} strokeWidth={1.5} /></div>}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── Checklist highlight ───────────────────────────────────── */}
      <section className="lp-checks">
        <div className="lp-checks-inner">
          <div className="lp-checks-text">
            <div className="lp-section-label">{t('welcome_hero_badge')}</div>
            <h2 className="lp-section-h2" style={{ textAlign:'left' }}>{t('welcome_cta_title')}</h2>
            <p className="lp-checks-sub">{t('welcome_cta_subtitle')}</p>
            {!user && (
              <Link to="/login" className="lp-cta-btn" style={{ marginTop:'1.5rem', display:'inline-flex' }}>
                {t('welcome_get_started')} <ArrowRight size={15} />
              </Link>
            )}
          </div>
          <ul className="lp-checklist">
            {[
              'welcome_feat1_title','welcome_feat2_title','welcome_feat3_title',
              'welcome_feat4_title','welcome_feat5_title','welcome_feat6_title',
            ].map(k => (
              <li key={k}><CheckCircle2 size={18} strokeWidth={2} className="lp-check-icon" />{t(k)}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <img src="/aitu-logo.png"       alt="AITU" className="lp-footer-logo logo-light" />
        <img src="/aitu-logo-white.png" alt="AITU" className="lp-footer-logo logo-dark"  />
        <p>© 2026 Astana IT University — {t('welcome_footer_rights')}</p>
      </footer>

    </div>
  );
}

export default WelcomePage;
