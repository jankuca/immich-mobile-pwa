import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { Person } from '../../services/api'
import { apiService } from '../../services/api'

interface PersonHeaderProps {
  person: Person | null
  assetCount?: number
  leftAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
  rightAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
}

export const PersonHeader = ({
  person,
  assetCount,
  leftAction,
  rightAction,
}: PersonHeaderProps) => {
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const header = headerRef.current
    if (!header) {
      return
    }

    const updateHeight = () => {
      const height = header.offsetHeight
      // Set the CSS variable on the parent .ios-page element
      const page = header.closest('.ios-page') as HTMLElement | null
      if (page) {
        page.style.setProperty('--measured-header-height', `${height}px`)
      }
    }

    // Initial measurement
    updateHeight()

    // Re-measure on resize
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(header)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <header ref={headerRef} class="ios-header person-header" style={{ position: 'relative' }}>
      {leftAction && (
        <button
          class="ios-header-left-action"
          onClick={leftAction.onClick}
          style={{
            position: 'absolute',
            left: 'var(--spacing-md)',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {leftAction.icon}
        </button>
      )}

      <div
        class="person-header-content"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* Person thumbnail */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: 'var(--color-gray-light)',
            flexShrink: 0,
          }}
        >
          {person?.thumbnailPath && (
            <img
              src={apiService.getPersonThumbnailUrl(person.id)}
              alt={person.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>

        <h1
          class="person-header-title"
          style={{
            color: person ? 'var(--color-text)' : 'var(--color-gray)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {person ? person.name : 'Loading…'}
        </h1>

        {assetCount !== undefined && assetCount > 0 && (
          <p
            class="person-header-count"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray)',
              margin: 0,
            }}
          >
            {assetCount} {assetCount === 1 ? 'photo' : 'photos'}
          </p>
        )}
      </div>

      {rightAction && (
        <button
          class="ios-header-action ios-header-right-action"
          onClick={rightAction.onClick}
          style={{
            position: 'absolute',
            right: 'var(--spacing-md)',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {rightAction.icon}
        </button>
      )}
    </header>
  )
}
