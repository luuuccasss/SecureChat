import { useState, useEffect } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';

const translations = {
  en,
  fr
};

// Détecter la langue du navigateur ou utiliser l'anglais par défaut
const getDefaultLanguage = () => {
  try {
    const browserLang = navigator.language || navigator.userLanguage;
    const lang = browserLang.split('-')[0];
    return translations[lang] ? lang : 'en';
  } catch {
    return 'en';
  }
};

// Récupérer la langue sauvegardée ou utiliser la langue par défaut
const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('app_language');
    return stored && translations[stored] ? stored : getDefaultLanguage();
  } catch {
    return 'en';
  }
};

// État global de la langue
let currentLanguage = getStoredLanguage();
let listeners = [];

/**
 * Change la langue de l'application
 */
export const setLanguage = (lang) => {
  if (translations[lang]) {
    currentLanguage = lang;
    try {
      localStorage.setItem('app_language', lang);
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
    // Notifier tous les listeners
    listeners.forEach(listener => listener(lang));
  }
};

/**
 * Récupère la langue actuelle
 */
export const getLanguage = () => currentLanguage;

/**
 * Traduit une clé
 */
export const t = (key, params = {}) => {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      // Fallback sur l'anglais si la traduction n'existe pas
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object') {
          value = value[k2];
        } else {
          return key; // Retourner la clé si aucune traduction trouvée
        }
      }
      break;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // Remplacer les paramètres {param}
  return value.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
};

/**
 * Hook React pour les traductions
 */
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

// Export par défaut pour compatibilité
export default {
  t,
  setLanguage,
  getLanguage,
  useTranslation
};

