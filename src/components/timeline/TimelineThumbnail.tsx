import { useRef } from 'preact/hooks'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { Asset } from '../../services/api'
import { apiService } from '../../services/api'

interface TimelineThumbnailProps {
  asset: Asset
  size: number
  onClick: (info: { position: ThumbnailPosition | null }) => void
}

export const TimelineThumbnail = ({ asset, size, onClick }: TimelineThumbnailProps) => {
  // Get the thumbnail URL
  const thumbnailUrl = apiService.getAssetThumbnailUrl(asset.id, 'webp')
  const thumbnailRef = useRef<HTMLDivElement>(null)

  // Function to update position
  const getPosition = () => {
    if (thumbnailRef.current) {
      const rect = thumbnailRef.current.getBoundingClientRect()
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }
    }

    return null
  }

  const handleClick = () => {
    // Update position right before click to ensure accuracy
    onClick({ position: getPosition() })
  }

  return (
    <div
      ref={thumbnailRef}
      class="timeline-thumbnail"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'var(--color-gray-light)',
        cursor: 'pointer',
        WebkitTouchCallout: 'none', // Disable iOS context menu
        userSelect: 'none', // Prevent selection
      }}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right-click
    >
      <img
        src={thumbnailUrl}
        alt={asset.originalFileName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          WebkitTouchCallout: 'none', // Disable iOS context menu
          userSelect: 'none', // Prevent selection
          WebkitUserDrag: 'none', // Prevent dragging in Safari
          MozUserDrag: 'none', // Firefox
          userDrag: 'none', // Standard
          touchAction: 'pan-x pan-y', // Allow panning but prevent other gestures
        }}
        draggable={false} // Prevent HTML5 drag and drop
        loading="lazy"
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right-click
        onDragStart={(e) => e.preventDefault()} // Prevent drag start
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />

      {/* Video indicator */}
      {asset.type === 'VIDEO' && (
        <div
          class="video-indicator"
          style={{
            position: 'absolute',
            bottom: 'var(--spacing-xs)',
            right: 'var(--spacing-xs)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 4px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 3L19 12L5 21V3Z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {asset.duration && formatDuration(asset.duration)}
        </div>
      )}

      {/* Favorite indicator */}
      {asset.isFavorite && (
        <div
          class="favorite-indicator"
          style={{
            position: 'absolute',
            top: 'var(--spacing-xs)',
            right: 'var(--spacing-xs)',
            color: 'var(--color-danger)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

// Helper function to format duration string (e.g. "00:00:10.000" to "0:10")
const formatDuration = (duration: string): string => {
  const [hoursString, minutesString, secondsString] = duration.split(':')
  if (!hoursString || !minutesString || !secondsString) {
    return duration
  }

  const hours = Number.parseInt(hoursString, 10)
  const minutes = Number.parseInt(minutesString, 10)
  const seconds = Math.round(Number.parseFloat(secondsString))

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
