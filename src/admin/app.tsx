import type { StrapiApp } from '@strapi/strapi/admin';
import logo from './extensions/logo.png';

// Same key Strapi's admin reads in StrapiApp.render() to pick the UI language.
const ADMIN_LANGUAGE_STORAGE_KEY = 'strapi-admin-language';
const DEFAULT_ADMIN_LOCALE = 'es';

/**
 * Spanish is the default admin language: seed the stored locale only when the browser has none,
 * so a user who picks English in their profile (or the login screen) keeps it.
 */
const ensureDefaultAdminLocale = (): void => {
  try {
    if (!window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)) {
      window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, DEFAULT_ADMIN_LOCALE);
    }
  } catch {
    // Storage blocked (private mode, policy): Strapi falls back to English.
  }
};

// Suyai teal (front `primary` #2095AE). 600/700 are darker so white button text stays >= 4.5:1.
const brandColors = {
  primary100: '#e8f6f9',
  primary200: '#bfe4ec',
  primary500: '#2095ae',
  primary600: '#1a7f95',
  primary700: '#14697b',
  buttonPrimary500: '#1a7f95',
  buttonPrimary600: '#14697b',
};

export default {
  config: {
    locales: [DEFAULT_ADMIN_LOCALE],
    auth: { logo },
    menu: { logo },
    theme: {
      light: { colors: brandColors },
      dark: {
        colors: {
          primary500: '#2095ae',
          primary600: '#1a7f95',
          primary700: '#14697b',
          buttonPrimary500: '#1a7f95',
          buttonPrimary600: '#14697b',
        },
      },
    },
    translations: {
      es: {
        'Auth.form.welcome.title': 'Bienvenido a Suyai',
        'Auth.form.welcome.subtitle': 'Inicia sesión en el panel de contenidos',
        'app.components.LeftMenu.navbrand.title': 'Suyai',
        'app.components.LeftMenu.navbrand.workplace': 'Panel de contenidos',
      },
      en: {
        'Auth.form.welcome.title': 'Welcome to Suyai',
        'Auth.form.welcome.subtitle': 'Log in to the content panel',
        'app.components.LeftMenu.navbrand.title': 'Suyai',
        'app.components.LeftMenu.navbrand.workplace': 'Content panel',
      },
    },
    tutorials: false,
    notifications: { releases: false },
  },
  register(): void {
    ensureDefaultAdminLocale();
  },
  bootstrap(_app: StrapiApp): void {},
};
