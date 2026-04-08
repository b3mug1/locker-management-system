import React from 'react';
import { useLanguage } from '../context/LanguageContext';

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <img src="/aitu-logo.png"       alt="AITU" className="site-footer-logo logo-light" />
      <img src="/aitu-logo-white.png" alt="AITU" className="site-footer-logo logo-dark" />
      <p>&copy; 2026 Astana IT University &mdash; {t('welcome_footer_rights')}</p>
    </footer>
  );
}

export default Footer;
