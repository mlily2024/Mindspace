/**
 * i18n setup (F.3, ADR-0021).
 *
 * Wires react-i18next with en-GB as the default and fallback locale. UI strings are
 * externalised into locale namespaces (starting with `common`); components read them
 * via `useTranslation()`. Adding a locale is a new `locales/<lng>/common.json` + a
 * `resources` entry — no component changes.
 *
 * IMPORTANT (safety): this is for UI copy ONLY. The crisis content in the backend
 * SafetyFilter (ADR-0003) is a frozen, test-guarded UK safety floor and is deliberately
 * NOT routed through i18n — a wrong helpline for a region is a safety failure, so
 * locale-specific crisis content is a separate, clinically-reviewed task.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enGBCommon from './locales/en-GB/common.json';

export const DEFAULT_LOCALE = 'en-GB';

export const resources = {
  'en-GB': { common: enGBCommon },
};

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common'],
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
