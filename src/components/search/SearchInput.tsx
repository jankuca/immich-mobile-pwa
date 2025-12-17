import { useEffect, useRef } from 'preact/hooks'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * iOS Safari keyboard focus hack.
 *
 * The problem: When focusing an input at the bottom of the page, iOS Safari
 * scrolls the page content to bring the input into view, causing layout jumps.
 *
 * The solution (from blog.opendigerati.com):
 * 1. Have a dummy input at the TOP of the viewport (invisible)
 * 2. Real input stays inline at the bottom where users expect it
 * 3. When user taps, focus the dummy input first (at top) - Safari doesn't scroll
 * 4. After keyboard opens, transfer focus to the real input
 *
 * @see https://blog.opendigerati.com/the-eccentric-ways-of-ios-safari-with-the-keyboard-b5aa3f34228d
 */

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dummyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    onChange(target.value)
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    onSubmit?.()
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus({ preventScroll: true })
  }

  // Handle click on the container - use the dummy input trick
  const handleContainerClick = (e: MouseEvent) => {
    // Don't intercept if clicking the clear button
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    // If already focused on real input, do nothing
    if (document.activeElement === inputRef.current) {
      return
    }

    e.preventDefault()

    // Focus the dummy input at the top first - this opens the keyboard
    // without causing Safari to scroll the page
    if (dummyInputRef.current) {
      dummyInputRef.current.focus()

      // After the keyboard is open, transfer focus to the real input
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 50)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      {/* Dummy input at top of viewport - used to open keyboard without scroll */}
      <input
        ref={dummyInputRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          width: '1px',
          height: '1px',
          opacity: 0,
          fontSize: '16px', // Prevent iOS zoom
          pointerEvents: 'none',
        }}
      />

      <div
        class="liquid-glass"
        onClick={handleContainerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 'var(--search-input-height)',
          padding: '0 var(--spacing-md)',
          gap: 'var(--spacing-sm)',
          flex: 1,
        }}
      >
        {/* Search Icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
            stroke="var(--color-gray)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M21 21L16.65 16.65"
            stroke="var(--color-gray)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

        <style>
          {`
            input::placeholder {
              color: var(--color-gray);
            }
          `}
        </style>

        {/* The real input - always inline, receives focus after dummy input opens keyboard */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onInput={handleInput}
          placeholder={placeholder}
          style={{
            height: '24px',
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: 'var(--font-size-md)',
            outline: 'none',
            color: 'var(--color-text)',
          }}
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-gray)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M6 6L18 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
