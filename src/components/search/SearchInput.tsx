import { useEffect, useRef, useState } from 'preact/hooks'

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
 * 1. Position the real input at the TOP of the viewport initially
 * 2. Show a fake tappable area at the bottom where users expect the search bar
 * 3. When user taps, focus the real input (at top) - Safari doesn't scroll
 * 4. After keyboard opens, move the real input to the bottom
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
  // Track whether the input is focused and should be shown in its final position
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
        setIsActive(true)
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

  const handleFocus = () => {
    // Move to active position after a short delay to let keyboard open
    setTimeout(() => {
      setIsActive(true)
    }, 50)
  }

  const handleBlur = () => {
    // Move back to top position when blurred
    setIsActive(false)
  }

  // Handle click on the container - focus the real input
  const handleContainerClick = (e: MouseEvent) => {
    // Don't intercept if clicking the clear button
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    if (inputRef.current && document.activeElement !== inputRef.current) {
      e.preventDefault()
      // Focus the input (which is at the top of the viewport)
      // Safari won't scroll because the input is already visible at top
      inputRef.current.focus({ preventScroll: true })
    }
  }

  // When not active, position the input at the top of the viewport (offscreen but focusable)
  // When active (after focus), render it inline in the container
  const inputStyle = isActive
    ? {
        height: '24px',
        flex: 1,
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: 'var(--font-size-md)',
        outline: 'none',
        color: 'var(--color-text)',
      }
    : {
        position: 'fixed' as const,
        top: '0px',
        left: '0px',
        width: '100%',
        height: '44px',
        opacity: 0,
        fontSize: '16px', // Prevent iOS zoom
        zIndex: -1,
      }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
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

        {/* When not active, show placeholder text to indicate the search field */}
        {!isActive && (
          <span
            style={{
              flex: 1,
              color: 'var(--color-gray)',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {placeholder}
          </span>
        )}

        {/* The real input - positioned at top when not active, inline when active */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={inputStyle}
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
