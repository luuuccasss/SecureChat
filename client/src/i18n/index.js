/**
 * Internationalization (i18n) Module
 * 
 * Provides translation functionality for the SecureChat application.
 * Supports multiple languages with fallback to English, language detection,
 * and persistent language preference storage.
 * 
 * @module i18n
 * @requires react - React hooks for state management
 */

import { useState, useEffect } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * Available Translations
 * 
 * Object containing all translation files for supported languages.
 * Add new languages by importing the JSON file and adding it here.
 */
const translations = {
  en, // English (default)
  fr  // French
};

/**
 * Get Default Language
 * 
 * Detects the user's browser language and returns the matching language code.
 * Falls back to English if browser language is not supported.
 * 
 * @returns {string} Language code (e.g., 'en', 'fr')
 */
const getDefaultLanguage = () => {
  try {
    const browserLang = navigator.language || navigator.userLanguage;
    const lang = browserLang.split('-')[0]; // Extract language code (e.g., 'en' from 'en-US')
    return translations[lang] ? lang : 'en'; // Fallback to English
  } catch {
    return 'en';
  }
};

/**
 * Get Stored Language
 * 
 * Retrieves the user's language preference from localStorage.
 * Falls back to browser language detection if no preference is stored.
 * 
 * @returns {string} Language code
 */
const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('app_language');
    return stored && translations[stored] ? stored : getDefaultLanguage();
  } catch {
    return 'en';
  }
};

/**
 * Global Language State
 * 
 * Tracks the current application language and registered listeners
 * for language change events.
 */
let currentLanguage = getStoredLanguage();
let listeners = [];

/**
 * Set Application Language
 * 
 * Changes the application language and notifies all registered listeners.
 * Saves the preference to localStorage for persistence.
 * 
 * @param {string} lang - Language code to set (e.g., 'en', 'fr')
 * 
 * @example
 * setLanguage('fr'); // Switch to French
 */
export const setLanguage = (lang) => {
  if (translations[lang]) {
    currentLanguage = lang;
    try {
      localStorage.setItem('app_language', lang);
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
    // Notify all registered listeners of language change
    listeners.forEach(listener => listener(lang));
  }
};

/**
 * Get Current Language
 * 
 * Returns the currently active language code.
 * 
 * @returns {string} Current language code
 */
export const getLanguage = () => currentLanguage;

/**
 * Translation Function
 * 
 * Translates a key path to the corresponding text in the current language.
 * Supports nested keys using dot notation (e.g., 'auth.login').
 * Falls back to English if translation is missing.
 * Supports parameter substitution using {param} syntax.
 * 
 * @param {string} key - Translation key path (e.g., 'auth.login')
 * @param {Object} params - Optional parameters for string interpolation
 * @returns {string} Translated text or key if translation not found
 * 
 * @example
 * t('auth.login') // Returns 'Login' or 'Connexion' depending on language
 * t('chat.welcome', { name: 'John' }) // Replaces {name} with 'John'
 */
export const t = (key, params = {}) => {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  
  // Navigate through nested translation object
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      // Fallback to English if translation not found in current language
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object') {
          value = value[k2];
        } else {
          return key; // Return key if no translation found
        }
      }
      break;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // Replace parameters in translation string
  // Example: "Hello {name}" with params {name: "John"} becomes "Hello John"
  return value.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
};

/**
 * React Hook for Translations
 * 
 * Provides translation functionality and language state management
 * for React components. Automatically updates when language changes.
 * 
 * @returns {Object} Translation utilities and language state
 * @returns {Function} returns.t - Translation function
 * @returns {string} returns.language - Current language code
 * @returns {Function} returns.setLanguage - Function to change language
 * @returns {string[]} returns.availableLanguages - List of available language codes
 * 
 * @example
 * function MyComponent() {
 *   const { t, language, setLanguage } = useTranslation();
 *   return <h1>{t('app.name')}</h1>;
 * }
 */
export const useTranslation = () => {
  const [lang, setLangState] = useState(currentLanguage);
  
  useEffect(() => {
    // Register listener for language changes
    const listener = (newLang) => {
      setLangState(newLang);
    };
    
    listeners.push(listener);
    setLangState(currentLanguage);
    
    // Cleanup: remove listener on unmount
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);
  
  return {
    t,                                    // Translation function
    language: lang,                       // Current language
    setLanguage: (newLang) => {           // Change language
      setLanguage(newLang);
    },
    availableLanguages: Object.keys(translations) // Available languages
  };
};

/**
 * Default Export
 * 
 * Exports all translation utilities for convenience.
 */
export default {
  t,
  setLanguage,
  getLanguage,
  useTranslation
};

