import React from 'react';
import { useTranslation } from '../i18n';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { language, setLanguage, availableLanguages } = useTranslation();

  return (
    <div className="language-switcher">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="language-select"
        aria-label="Select language"
      >
        {availableLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {lang === 'en' ? '🇬🇧 English' : lang === 'fr' ? '🇫🇷 Français' : lang.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;

