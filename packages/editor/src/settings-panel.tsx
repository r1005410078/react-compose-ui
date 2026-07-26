import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposeLocale, ComposeTheme } from '@compose-ui/ui-context'
import {
  COMPOSE_EDITOR_SHORTCUT_ACTIONS,
  createDefaultComposeEditorPreferences,
  findComposeEditorShortcutConflict,
  formatComposeEditorKeybinding,
} from './preferences'
import type {
  ComposeEditorKeybinding,
  ComposeEditorPreferences,
  ComposeEditorShortcutAction,
} from './preferences'
import {
  getEditorMessages,
  getEditorShortcutActionLabel,
} from './editor-i18n'

interface SettingsDialogProps {
  readonly id: string
  readonly preferences: ComposeEditorPreferences
  readonly onChange: (preferences: ComposeEditorPreferences) => void
  readonly onClose: () => void
}

function browserPlatform() {
  return typeof navigator === 'undefined' ? '' : navigator.platform
}

function bindingFromEvent(
  event: ReactKeyboardEvent<HTMLButtonElement>,
): ComposeEditorKeybinding | null {
  if (['AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight']
    .includes(event.code)) return null
  const mac = /Mac|iPhone|iPad|iPod/i.test(browserPlatform())
  return {
    code: event.code,
    ...((event.metaKey || (event.ctrlKey && !mac)) ? { primary: true } : {}),
    ...(event.ctrlKey && mac ? { control: true } : {}),
    ...(event.shiftKey ? { shift: true } : {}),
    ...(event.altKey ? { alt: true } : {}),
  }
}

type SettingsCategory = 'appearance' | 'language' | 'shortcuts'

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function SettingsDialog({
  id,
  preferences,
  onChange,
  onClose,
}: SettingsDialogProps) {
  const i18n = useComposeI18nContext()
  const locale = preferences.locale
  const t = getEditorMessages(locale, i18n?.formatMessage)
  const searchRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SettingsCategory>('appearance')
  const [capturing, setCapturing] = useState<ComposeEditorShortcutAction | null>(null)
  const [conflict, setConflict] = useState<ComposeEditorShortcutAction | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase(locale)
  const shortcutCategoryMatches = Boolean(
    normalizedQuery
    && t.shortcuts.toLocaleLowerCase(locale).includes(normalizedQuery),
  )
  const visibleActions = COMPOSE_EDITOR_SHORTCUT_ACTIONS.filter((action) =>
    !normalizedQuery
    || shortcutCategoryMatches
    || getEditorShortcutActionLabel(locale, action, i18n?.formatMessage)
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery)
    || action.toLocaleLowerCase().includes(normalizedQuery))
  const appearanceMatches = t.appearance.toLocaleLowerCase(locale).includes(normalizedQuery)
    || [t.dark, t.light, t.system]
      .some((item) => item.toLocaleLowerCase(locale).includes(normalizedQuery))
  const languageMatches = t.language.toLocaleLowerCase(locale).includes(normalizedQuery)
    || ['简体中文', 'English']
      .some((item) => item.toLocaleLowerCase(locale).includes(normalizedQuery))
  const showAppearance = normalizedQuery
    ? appearanceMatches
    : category === 'appearance'
  const showLanguage = normalizedQuery
    ? languageMatches
    : category === 'language'
  const visibleReadonlyItems = t.readonlyItems.filter(([term, description]) =>
    !normalizedQuery
    || shortcutCategoryMatches
    || term.toLocaleLowerCase(locale).includes(normalizedQuery)
    || description.toLocaleLowerCase(locale).includes(normalizedQuery))
  const showShortcuts = normalizedQuery
    ? visibleActions.length > 0
      || visibleReadonlyItems.length > 0
      || shortcutCategoryMatches
    : category === 'shortcuts'

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const setTheme = (theme: ComposeTheme) => {
    onChange({ ...preferences, theme })
  }
  const setLocale = (nextLocale: ComposeLocale) => {
    onChange({ ...preferences, locale: nextLocale })
  }
  const replaceShortcut = (
    action: ComposeEditorShortcutAction,
    bindings: readonly ComposeEditorKeybinding[],
  ) => {
    onChange({
      ...preferences,
      shortcuts: { ...preferences.shortcuts, [action]: bindings },
    })
  }

  return (
    <div
      className="compose-editor__settings-backdrop"
      data-testid="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby={`${id}-title`}
        aria-modal="true"
        className="compose-editor__settings-dialog"
        id={id}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (capturing) {
              setCapturing(null)
              setConflict(null)
            }
            else onClose()
            return
          }
          if (event.key !== 'Tab') return
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
            focusableSelector,
          ) ?? [])].filter((element) => !element.hidden)
          if (focusable.length === 0) return
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          }
          else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <header className="compose-editor__settings-header">
          <h2 id={`${id}-title`}>{t.settings}</h2>
          <button aria-label={t.close} onClick={onClose} type="button">×</button>
        </header>
        <div className="compose-editor__settings-search">
          <input
            aria-label={t.search}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            ref={searchRef}
            role="searchbox"
            type="search"
            value={query}
          />
        </div>
        <div className="compose-editor__settings-layout">
          <nav aria-label={t.user} className="compose-editor__settings-nav">
            <strong>{t.user}</strong>
            {([
              ['appearance', t.appearance],
              ['language', t.language],
              ['shortcuts', t.shortcuts],
            ] as const).map(([value, label]) => (
              <button
                aria-current={!normalizedQuery && category === value ? 'page' : undefined}
                key={value}
                onClick={() => {
                  setCategory(value)
                  setQuery('')
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>
          <main className="compose-editor__settings-body">
            {showAppearance ? (
              <section>
                <h3>{t.appearance}</h3>
                <div className="compose-editor__settings-options">
                  {([
                    ['dark', t.dark],
                    ['light', t.light],
                    ['system', t.system],
                  ] as const).map(([value, label]) => (
                    <label key={value}>
                      <input
                        checked={preferences.theme === value}
                        name={`${id}-theme`}
                        onChange={() => setTheme(value)}
                        type="radio"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {showLanguage ? (
              <section>
                <h3>{t.language}</h3>
                <div className="compose-editor__settings-options">
                  {([
                    ['zh-CN', '简体中文'],
                    ['en-US', 'English'],
                  ] as const).map(([value, label]) => (
                    <label key={value}>
                      <input
                        checked={preferences.locale === value}
                        name={`${id}-locale`}
                        onChange={() => setLocale(value)}
                        type="radio"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {showShortcuts && visibleActions.length > 0 ? (
              <section>
                <div className="compose-editor__settings-section-title">
                  <h3>{t.shortcuts}</h3>
                  <button
                    onClick={() => onChange({
                      ...preferences,
                      shortcuts: createDefaultComposeEditorPreferences().shortcuts,
                    })}
                    type="button"
                  >
                    {t.resetAll}
                  </button>
                </div>
                <div className="compose-editor__shortcut-list">
                  {visibleActions.map((action) => {
                    const label = getEditorShortcutActionLabel(
                      locale,
                      action,
                      i18n?.formatMessage,
                    )
                    const bindings = preferences.shortcuts[action]
                    return (
                      <div className="compose-editor__shortcut-row" key={action}>
                        <span>{label}</span>
                        <button
                          aria-label={t.edit(label)}
                          className={capturing === action ? 'is-capturing' : ''}
                          onClick={() => {
                            setCapturing(action)
                            setConflict(null)
                          }}
                          onKeyDown={(event) => {
                            if (capturing !== action) return
                            event.preventDefault()
                            event.stopPropagation()
                            if (event.code === 'Escape') {
                              setCapturing(null)
                              setConflict(null)
                              return
                            }
                            const binding = bindingFromEvent(event)
                            if (!binding) return
                            const nextConflict = findComposeEditorShortcutConflict(
                              preferences.shortcuts,
                              action,
                              binding,
                            )
                            if (nextConflict) {
                              setConflict(nextConflict)
                              return
                            }
                            replaceShortcut(action, [binding])
                            setCapturing(null)
                            setConflict(null)
                          }}
                          type="button"
                        >
                          {capturing === action
                            ? t.capture
                            : bindings.length > 0
                              ? bindings
                                  .map((binding) =>
                                    formatComposeEditorKeybinding(binding, browserPlatform()))
                                  .join(' / ')
                              : t.disabled}
                        </button>
                        <button
                          aria-label={t.clear(label)}
                          onClick={() => replaceShortcut(action, [])}
                          type="button"
                        >
                          ×
                        </button>
                        <button
                          aria-label={t.restore(label)}
                          onClick={() => replaceShortcut(
                            action,
                            createDefaultComposeEditorPreferences().shortcuts[action],
                          )}
                          type="button"
                        >
                          ↺
                        </button>
                      </div>
                    )
                  })}
                </div>
                {conflict ? (
                  <p role="alert">
                    {t.conflict(getEditorShortcutActionLabel(
                      locale,
                      conflict,
                      i18n?.formatMessage,
                    ))}
                  </p>
                ) : null}
              </section>
            ) : null}
            {showShortcuts && visibleReadonlyItems.length > 0 ? (
              <section>
                <h3>{t.readonly}</h3>
                <dl className="compose-editor__readonly-shortcuts">
                  {visibleReadonlyItems.map(([term, description]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{description}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </main>
        </div>
      </section>
    </div>
  )
}
