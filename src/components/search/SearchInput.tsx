import { useRef, useEffect } from 'preact/hooks'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  autoFocus?: boolean
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
        inputRef.current?.focus()
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
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      <div
        class="liquid-glass"
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

