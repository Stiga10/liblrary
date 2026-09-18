import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bg from './locales/bg.json';
import en from './locales/en.json';

const STORAGE_KEY = 'biblioteka.lang';

void i18n.use(initReactI18next).init({
  resources: { bg: { translation: bg }, en: { translation: en } },
  lng: localStorage.getItem(STORAGE_KEY) ?? 'bg',
  fallbackLng: 'bg',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export const dateFormatter = () =>
  new Intl.DateTimeFormat(i18n.language === 'bg' ? 'bg-BG' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export default i18n;
