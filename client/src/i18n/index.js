// Internationalization module
import { useState, useEffect } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';

const translations = {
  en,
  fr
};

const getDefaultLanguage = () => {
  try {
    const browserLang = navigator.language || navigator.userLanguage;
    const lang = browserLang.split('-')[0]; // Extract language code (e.g., 'en' from 'en-US')
    return translations[lang] ? lang : 'en'; // Fallback to English
  } catch {
    return 'en';
  }
};

const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('app_language');
    return stored && translations[stored] ? stored : getDefaultLanguage();
  } catch {
    return 'en';
  }
};

let currentLanguage = getStoredLanguage();
let listeners = [];

export const setLanguage = (lang) => {
  if (translations[lang]) {
    currentLanguage = lang;
    try {
      localStorage.setItem('app_language', lang);
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
    listeners.forEach(listener => listener(lang));
  }
};

export const getLanguage = () => currentLanguage;

export const t = (key, params = {}) => {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object') {
          value = value[k2];
        } else {
          return key;
        }
      }
      break;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  return value.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
};

export const useTranslation = () => {
  const [lang, setLangState] = useState(currentLanguage);
  
  useEffect(() => {
    const listener = (newLang) => {
      setLangState(newLang);
    };
    
    listeners.push(listener);
    setLangState(currentLanguage);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);
  
  return {
    t,
    language: lang,
    setLanguage: (newLang) => {
      setLanguage(newLang);
    },
    availableLanguages: Object.keys(translations)
  };
};

export default {
  t,
  setLanguage,
  getLanguage,
  useTranslation
};

