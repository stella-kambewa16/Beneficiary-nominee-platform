import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, MouseEvent, RefObject } from 'react'
import { Icon } from './Icon'

export interface SearchableOption {
  id: string
  label: string
  description?: string
  /** Extra text used only for filtering, never displayed. */
  keywords?: string
  disabled?: boolean
}

function matchesQuery(option: SearchableOption, query: string): boolean {
  if (!query) return true
  return [option.label, option.description, option.keywords]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function useDismiss(
  open: boolean,
  wrapRef: RefObject<HTMLDivElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return

    const handlePointer = (event: globalThis.MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target as Node)
      ) {
        onDismiss()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open, wrapRef, onDismiss])
}

interface SearchableSelectProps {
  id?: string
  options: SearchableOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** Adds a selectable option that represents "no value". */
  emptyLabel?: string
  disabled?: boolean
  ariaLabel?: string
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matching options',
  emptyLabel,
  disabled = false,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useDismiss(open, wrapRef, close)

  const allOptions = useMemo(
    () =>
      emptyLabel
        ? [{ id: '', label: emptyLabel }, ...options]
        : options,
    [emptyLabel, options],
  )

  const selected = allOptions.find((option) => option.id === (value ?? ''))

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = allOptions.filter((option) =>
    matchesQuery(option, normalizedQuery),
  )

  const openList = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    const selectedIndex = allOptions.findIndex(
      (option) => option.id === (value ?? ''),
    )
    setActiveIndex(selectedIndex > -1 ? selectedIndex : 0)
  }

  const choose = (option: SearchableOption) => {
    if (option.disabled) return
    onChange(option.id ? option.id : null)
    close()
  }

  useEffect(() => {
    if (!open) return
    const active = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    )
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(filtered.length - 1, 0)),
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[activeIndex]
      if (option) choose(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return (
    <div className={`search-select${open ? ' is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="search-select-trigger"
        onClick={() => (open ? close() : openList())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
      >
        <span className="search-select-value">
          {selected ? (
            <>
              <span className="search-select-value-name">
                {selected.label}
              </span>
              {selected.description ? (
                <span className="search-select-value-meta">
                  {selected.description}
                </span>
              ) : null}
            </>
          ) : (
            <span className="search-select-placeholder">{placeholder}</span>
          )}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className="search-select-chevron"
        />
      </button>

      {open ? (
        <div
          className="search-select-popover"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <div className="search-select-search">
            <Icon
              name="search"
              size={14}
              className="search-select-search-icon"
            />
            <input
              autoFocus
              type="search"
              className="search-select-search-input"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-label={searchPlaceholder}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                filtered[activeIndex]
                  ? `${listId}-option-${activeIndex}`
                  : undefined
              }
            />
          </div>

          <ul
            id={listId}
            ref={listRef}
            className="search-select-list"
            role="listbox"
            aria-label={ariaLabel}
          >
            {filtered.length ? (
              filtered.map((option, index) => {
                const isSelected = option.id === (value ?? '')
                return (
                  <li key={option.id || 'empty'} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      data-active={index === activeIndex}
                      className={`search-select-option${
                        index === activeIndex ? ' is-active' : ''
                      }${isSelected ? ' is-selected' : ''}`}
                      disabled={option.disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                    >
                      <span className="search-select-option-copy">
                        <span className="search-select-option-name">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="search-select-option-meta">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Icon
                          name="check"
                          size={14}
                          className="search-select-option-check"
                        />
                      ) : null}
                    </button>
                  </li>
                )
              })
            ) : (
              <li className="search-select-empty">{emptyMessage}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

interface SearchableMultiSelectProps {
  id?: string
  options: SearchableOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  ariaLabel?: string
}

export function SearchableMultiSelect({
  id,
  options,
  values,
  onChange,
  placeholder = 'Search and select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matching options',
  disabled = false,
  ariaLabel,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useDismiss(open, wrapRef, close)

  const selectedOptions = options.filter((option) =>
    values.includes(option.id),
  )

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = options.filter((option) =>
    matchesQuery(option, normalizedQuery),
  )

  const openList = () => {
    if (disabled) return
    setOpen(true)
  }

  const toggle = (option: SearchableOption) => {
    if (option.disabled) return
    onChange(
      values.includes(option.id)
        ? values.filter((value) => value !== option.id)
        : [...values, option.id],
    )
  }

  const remove = (optionId: string) => {
    onChange(values.filter((value) => value !== optionId))
  }

  const selectAllShown = () => {
    const next = new Set(values)
    filtered.forEach((option) => {
      if (!option.disabled) next.add(option.id)
    })
    onChange([...next])
  }

  useEffect(() => {
    if (!open) return
    const active = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    )
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(filtered.length - 1, 0)),
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[activeIndex]
      if (option) toggle(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (
      event.key === 'Backspace' &&
      !query &&
      values.length
    ) {
      remove(values[values.length - 1])
    }
  }

  const handleFieldClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    openList()
    searchRef.current?.focus()
  }

  return (
    <div className={`search-select search-select-multi${open ? ' is-open' : ''}`} ref={wrapRef}>
      <div
        className="search-select-field"
        onClick={handleFieldClick}
      >
        <div className="search-select-chip-row">
          {selectedOptions.map((option) => (
            <span key={option.id} className="search-select-chip">
              <span className="search-select-chip-label">
                {option.label}
              </span>
              <button
                type="button"
                className="search-select-chip-remove"
                disabled={disabled}
                aria-label={`Remove ${option.label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  remove(option.id)
                }}
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          <input
            id={id}
            ref={searchRef}
            type="search"
            className="search-select-inline-input"
            value={query}
            disabled={disabled}
            placeholder={
              selectedOptions.length
                ? searchPlaceholder
                : placeholder
            }
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onFocus={openList}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filtered[activeIndex]
                ? `${listId}-option-${activeIndex}`
                : undefined
            }
          />
        </div>
        <button
          type="button"
          className="search-select-toggle"
          disabled={disabled}
          aria-label={`${
            open ? 'Close' : 'Open'
          } ${ariaLabel ?? 'options'}`}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={(event) => {
            event.stopPropagation()
            if (open) {
              close()
            } else {
              openList()
              searchRef.current?.focus()
            }
          }}
        >
          <Icon
            name="chevron-down"
            size={14}
            className="search-select-chevron"
          />
        </button>
      </div>

      {open ? (
        <div
          className="search-select-popover"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <div
            id={listId}
            ref={listRef}
            className="search-select-list search-select-checklist"
            role="group"
            aria-label={ariaLabel}
          >
            {filtered.length ? (
              filtered.map((option, index) => {
                const checked = values.includes(option.id)
                return (
                  <label
                    key={option.id}
                    data-active={index === activeIndex}
                    className={`search-select-option search-select-check${
                      index === activeIndex ? ' is-active' : ''
                    }${checked ? ' is-selected' : ''}${
                      option.disabled ? ' is-disabled' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || option.disabled}
                      onChange={() => toggle(option)}
                    />
                    <span className="search-select-option-copy">
                      <span className="search-select-option-name">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="search-select-option-meta">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })
            ) : (
              <p className="search-select-empty">{emptyMessage}</p>
            )}
          </div>

          <div className="search-select-footer">
            <span className="search-select-count">
              {values.length} selected
            </span>
            <div className="search-select-footer-actions">
              <button
                type="button"
                className="search-select-footer-button"
                disabled={!filtered.some((option) => !option.disabled)}
                onClick={selectAllShown}
              >
                Select all shown
              </button>
              <button
                type="button"
                className="search-select-footer-button"
                disabled={!values.length}
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
