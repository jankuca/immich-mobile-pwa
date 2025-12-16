import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { Album } from '../../services/api'

interface AlbumHeaderProps {
  album: Album | null
  leftAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
}

export const AlbumHeader = ({ album, leftAction }: AlbumHeaderProps) => {
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
    </header>
  )
}
