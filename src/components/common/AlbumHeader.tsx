import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { Album } from '../../services/api'

interface MenuItem {
  label: string
  onClick: () => void
}

interface AlbumHeaderProps {
  album: Album | null
  leftAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
  rightAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
  /** Menu items for the dropdown (triggered by right action) */
  menuItems?: MenuItem[]
}

export const AlbumHeader = ({ album, leftAction, rightAction, menuItems }: AlbumHeaderProps) => {
  const headerRef = useRef<HTMLElement>(null)
  const [showDropdown, setShowDropdown] = useState(false)

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
    <header ref={headerRef} class="ios-header album-header">
      {leftAction && (
        <button
          class="ios-header-left-action"
          onClick={leftAction.onClick}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 'var(--spacing-sm)',
          }}
        >
          {leftAction.icon}
        </button>
      )}

      <div
        class="album-header-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <h1
          class="album-header-title"
          style={{
            color: album ? 'var(--color-text)' : 'var(--color-gray)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-xs)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            wordBreak: 'keep-all',
          }}
        >
          {album ? album.albumName : 'Loading…'}
        </h1>

        {album && (
          <p
            class="album-header-date"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray)',
              margin: 0,
            }}
          >
            {album.startDate ? (
              <>
                {new Date(album.startDate).toLocaleDateString(undefined, {
                  localeMatcher: 'best fit',
                })}
                {album.endDate &&
                  album.startDate !== album.endDate &&
                  ` - ${new Date(album.endDate).toLocaleDateString(undefined, { localeMatcher: 'best fit' })}`}
              </>
            ) : (
              'No date information'
            )}
            {album.assetCount > 0 && (
              <span style={{ marginLeft: 'var(--spacing-sm)' }}>
                • {album.assetCount} {album.assetCount === 1 ? 'photo' : 'photos'}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Right action - either a simple button or a menu trigger */}
      {menuItems && menuItems.length > 0 ? (
        <div style={{ position: 'relative', zIndex: 100 }}>
          <button
            type="button"
            class="ios-header-action ios-header-right-action"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              flexShrink: 0,
            }}
          >
            {/* More icon (three horizontal dots in a circle) */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="14" cy="14" r="13" stroke="currentColor" stroke-width="1.5" fill="none" />
              <circle cx="8" cy="14" r="1.5" fill="currentColor" />
              <circle cx="14" cy="14" r="1.5" fill="currentColor" />
              <circle cx="20" cy="14" r="1.5" fill="currentColor" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 'var(--spacing-xs)',
                backgroundColor: 'var(--color-background)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(var(--color-text-rgb), 0.1)',
                minWidth: '150px',
                zIndex: 1000,
              }}
            >
              {menuItems.map((item, index) => (
                <>
                  {index > 0 && (
                    <div
                      style={{
                        height: '1px',
                        background: 'rgba(var(--color-text-rgb), 0.1)',
                      }}
                    />
                  )}
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setShowDropdown(false)
                      item.onClick()
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 'var(--spacing-md) var(--spacing-lg)',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-regular)',
                    }}
                  >
                    {item.label}
                  </button>
                </>
              ))}
            </div>
          )}
        </div>
      ) : (
        rightAction && (
          <button
            type="button"
            class="ios-header-action ios-header-right-action"
            onClick={rightAction.onClick}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 'var(--spacing-sm)',
            }}
          >
            {rightAction.icon}
          </button>
        )
      )}
    </header>
  )
}
