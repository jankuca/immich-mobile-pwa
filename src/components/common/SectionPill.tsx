import type { ComponentChildren } from 'preact'

interface SectionPillProps {
  children: ComponentChildren
  sticky?: boolean
}

export function SectionPill({ children, sticky = false }: SectionPillProps) {
  return (
    <div
      class="section-pill-container"
      style={{
        ...(sticky && {
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }),
        padding: 'var(--spacing-sm)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: sticky
          ? 'linear-gradient(180deg, rgba(var(--color-background-rgb), 0.5) 0%, rgba(var(--color-background-rgb), 0) 100%)'
          : 'transparent',
      }}
    >
      <div
        class="section-pill"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          background:
            'rgba(var(--color-text-rgb), 0.2) linear-gradient(135deg, rgba(var(--color-background-rgb), 0.7) 0%, rgba(var(--color-background-rgb), 0.5) 50%, rgba(var(--color-background-rgb), 0.6) 100%)',
          border: '0.5px solid rgba(var(--color-text-rgb), 0.1)',
          borderRadius: '99px',
          backdropFilter: 'blur(10px)',
          color: 'var(--color-text)',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
