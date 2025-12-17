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
 * 1. Create a temporary dummy input at the TOP of the viewport
 * 2. Focus it to open keyboard (Safari doesn't scroll because it's at top)
 * 3. Transfer focus to the real input
 * 4. Remove the dummy input
 *
 * @see https://blog.opendigerati.com/the-eccentric-ways-of-ios-safari-with-the-keyboard-b5aa3f34228d
 */

/**
 * Focus an input using the iOS dummy input hack.
 * Creates a temporary input at the top of the viewport, focuses it to open
 * the keyboard, then transfers focus to the real input and removes the dummy.
 */
function focusWithIOSHack(targetInput: HTMLInputElement) {
  // Create a temporary input at the top of the viewport
  const dummyInput = document.createElement('input')
  dummyInput.style.position = 'fixed'
  dummyInput.style.top = '0'
  dummyInput.style.left = '0'
  dummyInput.style.width = '100%'
  dummyInput.style.height = '44px'
  dummyInput.style.opacity = '0'
  dummyInput.style.zIndex = '-1'
  dummyInput.style.fontSize = '16px' // Prevent iOS zoom
  dummyInput.setAttribute('aria-hidden', 'true')

  // Add to body and focus - this opens the keyboard without scrolling
  document.body.appendChild(dummyInput)
  dummyInput.focus()

  // After keyboard opens, transfer focus to real input and remove dummy
  setTimeout(() => {
    targetInput.focus({ preventScroll: true })
    document.body.removeChild(dummyInput)
  }, 50)
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

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

    if (inputRef.current) {
      focusWithIOSHack(inputRef.current)
    }
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
