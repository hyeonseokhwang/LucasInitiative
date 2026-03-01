import { useEffect, useCallback } from 'react'

export interface ShortcutAction {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutAction[]) {
  const handler = useCallback((e: KeyboardEvent) => {
    // Don't fire when typing in input/textarea/contenteditable
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape even in inputs
      if (e.key !== 'Escape') return
    }

    for (const s of shortcuts) {
      const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const altMatch = s.alt ? e.altKey : !e.altKey
      const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
      const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()

      if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
        e.preventDefault()
        e.stopPropagation()
        s.action()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
