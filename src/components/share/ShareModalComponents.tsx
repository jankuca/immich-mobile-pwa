import type { ComponentChildren, JSX } from 'preact'

// ============ Types & Constants ============

export type ExpirationOption = 'never' | '30min' | '1hour' | '6hours' | '1day' | '7days' | '30days'

export const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '30min', label: '30 minutes' },
  { value: '1hour', label: '1 hour' },
  { value: '6hours', label: '6 hours' },
  { value: '1day', label: '1 day' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
]

export const getExpirationDate = (option: ExpirationOption): string | null => {
  if (option === 'never') {
    return null
  }
  const now = new Date()
  switch (option) {
    case '30min':
      return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    case '1hour':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    case '6hours':
      return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
    case '1day':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    case '7days':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30days':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

// ============ Icons ============

export const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

export const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ============ Layout Components ============

interface ShareModalWrapperProps {
  title: string
  onClose: () => void
  children: ComponentChildren
}

export const ShareModalWrapper = ({ title, onClose, children }: ShareModalWrapperProps) => {
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      class="share-modal-backdrop"
      role="button"
      tabIndex={0}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-index-modal)',
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        class="share-modal"
        style={{
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md)',
            borderBottom: '1px solid var(--color-gray-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <LinkIcon />
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--spacing-xs)',
              color: 'var(--color-gray)',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--spacing-md)' }}>{children}</div>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  hint?: string
  children: ComponentChildren
}

export const FormField = ({ label, hint, children }: FormFieldProps) => (
  <div style={{ marginBottom: 'var(--spacing-md)' }}>
    <label
      style={{
        display: 'block',
        marginBottom: 'var(--spacing-xs)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      {label}
    </label>
    {hint && (
      <p
        style={{
          margin: '0 0 var(--spacing-xs)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-gray)',
        }}
      >
        {hint}
      </p>
    )}
    {children}
  </div>
)

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'var(--spacing-sm) 0',
    }}
  >
    <span style={{ fontSize: 'var(--font-size-sm)' }}>{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-gray-light)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  </div>
)

export const inputStyle: JSX.CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-sm)',
  border: '1px solid var(--color-gray-light)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-md)',
  backgroundColor: 'var(--color-background)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

