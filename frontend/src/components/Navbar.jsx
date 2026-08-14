import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Sun, Moon, KeyRound } from 'lucide-react';

function Navbar() {
  const { user, logout } = useAuth();
  const { lang, switchLang, t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const navClass = ({ isActive }) => isActive ? 'active-link' : '';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">
          <img src="/logo.jpeg" alt="Logo" className="navbar-logo" />
          <span className="brand-text">{t('nav_brand')}</span>
        </Link>
      </div>

      <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
        <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
      </button>

      <div className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`}>
        {user?.role === 'admin' && (
          <>
            <NavLink to="/dashboard" end className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_dashboard')}</NavLink>
            <NavLink to="/users" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_users')}</NavLink>
            <NavLink to="/students" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_students')}</NavLink>
            <NavLink to="/lockers" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_lockers')}</NavLink>
            <NavLink to="/assignments" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_assignments')}</NavLink>
            <NavLink to="/incidents" className={navClass} onClick={() => setMobileOpen(false)}>Maintenance</NavLink>
            <NavLink to="/analytics" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_analytics')}</NavLink>
            <NavLink to="/audit-logs" className={navClass} onClick={() => setMobileOpen(false)}>Activity</NavLink>
          </>
        )}
        {user?.role === 'user' && (
          <NavLink to="/my-locker" className={navClass} onClick={() => setMobileOpen(false)}>{t('nav_my_locker')}</NavLink>
        )}
        <NavLink to="/notifications" className={navClass} onClick={() => setMobileOpen(false)}>Notifications</NavLink>
      </div>

      <div className="navbar-user">
        <button
          className="lang-toggle"
          onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
          title={lang === 'en' ? 'Русский' : 'English'}
        >
          {lang === 'en' ? '🇷🇺' : '🇬🇧'}
        </button>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
        >
          {theme === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
        </button>
        <NavLink to="/change-password" className="btn btn-sm btn-outline" onClick={() => setMobileOpen(false)} title={t('nav_change_password')}>
          <KeyRound size={16} strokeWidth={1.75} />
        </NavLink>
        <span className="role-badge">{user?.role}</span>
        <button className="btn btn-sm btn-outline" onClick={handleLogout}>
          {t('nav_logout')}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
