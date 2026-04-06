import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Sun, Moon } from 'lucide-react';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { lang, switchLang, t } = useLanguage();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      loginUser(data);
      navigate('/');
    } catch (err) {
      const detail = err.response?.data?.detail || t('login_failed');
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-top-controls">
        <button
          className="lang-toggle"
          onClick={() => switchLang(lang === 'en' ? 'ru' : 'en')}
          title={lang === 'en' ? 'Русский' : 'English'}
        >
          {lang === 'en' ? '🇷🇺' : '🇬🇧'}
        </button>
        <button
          className="theme-toggle login-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? t('nav_theme_dark') : t('nav_theme_light')}
        >
          {theme === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
        </button>
      </div>
      <div className="login-card">
        <div className="login-logo">
          <img src="/aitu-logo.png" alt="Astana IT University" className="logo-light" />
          <img src="/aitu-logo-white.png" alt="Astana IT University" className="logo-dark" />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login_placeholder_email')}
              required
            />
          </div>
          <div className="form-group">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login_placeholder_password')}
              required
            />
          </div>
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? t('login_loading') : t('login_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
