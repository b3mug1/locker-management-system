import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUnreadNotificationCount } from '../api/notifications';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  Sun, Moon, KeyRound, Bell, ChevronDown,
  Users, Wrench, History, LogOut
} from 'lucide-react';

function Navbar() {
  const { user, logout } = useAuth();
  const { lang, switchLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

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

  const fetchUnread = async () => {
    if (!user) return;
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.data?.count ?? 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    const handleEvent = () => fetchUnread();
    window.addEventListener('notification_change', handleEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification_change', handleEvent);
    };
  }, [user]);

  useWebSocket({
    notification_change: fetchUnread,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setDropdownOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const navClass = ({ isActive }) => isActive ? 'active-link' : '';
  const isManagementActive = ['/users', '/incidents', '/audit-logs'].includes(location.pathname);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <Link to="/dashboard" className="navbar-brand-link">
            <img src="/logo.png" alt="AITU" className="navbar-logo" />
            <div className="brand-text-wrap">
              <span className="brand-name">AITU</span>
              <span className="brand-product">LOCKER</span>
            </div>
          </Link>

          <div className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`}>
            {user?.role === 'admin' && (
              <>
                <NavLink to="/dashboard" end className={navClass}>{t('nav_dashboard')}</NavLink>
                <NavLink to="/lockers" className={navClass}>{t('nav_lockers')}</NavLink>
                <NavLink to="/students" className={navClass}>{t('nav_students')}</NavLink>
                <NavLink to="/assignments" className={navClass}>{t('nav_assignments')}</NavLink>
                <NavLink to="/analytics" className={navClass}>{t('nav_analytics')}</NavLink>

                {/* Desktop Management Dropdown */}
                <div className="nav-dropdown desktop-only-dropdown" ref={dropdownRef}>
                  <button
                    type="button"
                    className={`nav-dropdown-toggle ${isManagementActive ? 'active-link' : ''}`}
                    onClick={() => setDropdownOpen(o => !o)}
                    aria-expanded={dropdownOpen}
                  >
                    <span>{t('nav_management')}</span>
                    <ChevronDown size={13} className={`dropdown-chevron ${dropdownOpen ? 'rotated' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="nav-dropdown-menu">
                      <NavLink to="/users" className={navClass}>
                        <Users size={14} />
                        <span>{t('nav_users')}</span>
                      </NavLink>
                      <NavLink to="/incidents" className={navClass}>
                        <Wrench size={14} />
                        <span>{t('nav_maintenance')}</span>
                      </NavLink>
                      <NavLink to="/audit-logs" className={navClass}>
                        <History size={14} />
                        <span>{t('nav_activity')}</span>
                      </NavLink>
                    </div>
                  )}
                </div>

                {/* Mobile-only expanded management links */}
                <div className="mobile-only-section">
                  <NavLink to="/users" className={navClass}>
                    <Users size={14} />
                    <span>{t('nav_users')}</span>
                  </NavLink>
                  <NavLink to="/incidents" className={navClass}>
                    <Wrench size={14} />
                    <span>{t('nav_maintenance')}</span>
                  </NavLink>
                  <NavLink to="/audit-logs" className={navClass}>
                    <History size={14} />
                    <span>{t('nav_activity')}</span>
                  </NavLink>
                </div>
              </>
            )}

            {user?.role === 'technician' && (
              <>
                <NavLink to="/technician-tasks" className={navClass}>
                  {t('nav_tech_workspace')}
                </NavLink>
                <NavLink to="/incidents" className={navClass}>
                  {t('nav_maintenance')}
                </NavLink>
              </>
            )}

            {user?.role === 'user' && (
              <NavLink to="/my-locker" className={navClass}>{t('nav_my_locker')}</NavLink>
            )}
          </div>
        </div>

        <div className="navbar-right">
          <div className="nav-actions-group">
            {/* Notifications Icon */}
            <NavLink
              to="/notifications"
              className={({ isActive }) => `nav-tool-btn ${isActive ? 'active' : ''}`}
              title={t('nav_notifications')}
              aria-label={t('nav_notifications')}
            >
              <Bell size={17} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="nav-tool-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            {/* Language Switcher */}
            <button
              className="nav-tool-btn nav-lang-toggle"
              onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
              title={lang === 'en' ? 'Переключить на русский' : 'Switch to English'}
            >
              {lang === 'en' ? 'RU' : 'EN'}
            </button>

            {/* Theme Switcher */}
            <button
              className="nav-tool-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
            >
              {theme === 'light' ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
            </button>

            {/* Change Password */}
            <NavLink
              to="/change-password"
              className={({ isActive }) => `nav-tool-btn ${isActive ? 'active' : ''}`}
              title={t('nav_change_password')}
            >
              <KeyRound size={16} strokeWidth={1.75} />
            </NavLink>
          </div>

          <div className="nav-vertical-divider" />

          {/* User profile & Logout */}
          <div className="nav-user-cluster">
            <span className="nav-role-tag">{user?.role}</span>
            <button
              className="nav-logout-action"
              onClick={handleLogout}
              title={t('nav_logout')}
            >
              <LogOut size={15} />
              <span>{t('nav_logout')}</span>
            </button>
          </div>

          <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
            <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
            <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
