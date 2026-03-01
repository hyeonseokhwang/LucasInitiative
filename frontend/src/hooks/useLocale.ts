import { createContext, useContext } from 'react'
import type { Locale, Messages } from '../lib/i18n'
import { messages } from '../lib/i18n'

// ---- localStorage ----
const LOCALE_KEY = 'lucas-locale'

export function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored === 'ko' || stored === 'en') return stored
  } catch { /* ignore */ }
  return 'ko' // default Korean
}

export function saveLocale(locale: Locale) {
  try { localStorage.setItem(LOCALE_KEY, locale) } catch { /* ignore */ }
}

// ---- Context ----
export interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'ko',
  setLocale: () => {},
  t: messages.ko,
})

// ---- Hook ----
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
