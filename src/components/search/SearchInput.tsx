import { useEffect, useRef } from 'preact/hooks'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * iOS Safari hack: Use a dummy input to open the keyboard without scrolling.
 *
 * When focusing an input, iOS scrolls to bring it into view. By creating a
 * temporary input at the same position as the real input and focusing it first,
 * we can open the keyboard without triggering the scroll behavior. Then we
 * transfer focus to the real input.
 *
 * @see https://stackoverflow.com/questions/54424729/ios-show-keyboard-on-input-focus
 */
function focusWithDummyInput(el: HTMLInputElement, timeout = 50) {
  // Get the position of the real input using getBoundingClientRect
  // This gives us the position relative to the viewport
  const rect = el.getBoundingClientRect()

  // Create a temporary input positioned exactly where the real input is
  const tempInput = document.createElement('input')
  tempInput.style.position = 'fixed'
  tempInput.style.top = `${rect.top}px`
  tempInput.style.left = `${rect.left}px`
  tempInput.style.width = `${rect.width}px`
  tempInput.style.height = `${rect.height}px`
  tempInput.style.opacity = '0'
  tempInput.style.zIndex = '9999'
  tempInput.style.fontSize = '16px' // Prevent iOS zoom

  // Append to body and focus - this opens the keyboard
  document.body.appendChild(tempInput)
  tempInput.focus()

  // After a short delay, transfer focus to the real input and remove the temp
  setTimeout(() => {
    el.focus()
    document.body.removeChild(tempInput)
  }, timeout)
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
      // Small delay to ensure the component is mounted
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

  // Handle click on the container - use the dummy input hack for iOS
  const handleContainerClick = (e: MouseEvent) => {
    // Only intercept if we're not already focused and not clicking the clear button
    if (
      inputRef.current &&
      document.activeElement !== inputRef.current &&
      !(e.target as HTMLElement).closest('button')
    ) {
      e.preventDefault()
      focusWithDummyInput(inputRef.current)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      {/* Use onClick on container to intercept taps and use the dummy input hack */}
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

        <style scoped={true}>
          {`
            input::placeholder {
              color: var(--color-gray);
            }
          `}
        </style>
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
