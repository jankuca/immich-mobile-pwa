interface AssetImageProps {
  src: string
  alt: string
  isBlurred?: boolean
  isLoaded?: boolean
  style?: Record<string, string | number>
  onLoad?: (() => void) | null
}

export const AssetImage = ({
  src,
  alt,
  isBlurred = false,
  isLoaded = true,
  style = {},
  onLoad,
}: AssetImageProps) => {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
        WebkitTouchCallout: 'none', // Disable iOS context menu
        userSelect: 'none', // Prevent selection
        WebkitUserDrag: 'none', // Prevent dragging in Safari
        MozUserDrag: 'none', // Firefox
        userDrag: 'none', // Standard
        touchAction: 'pan-x pan-y', // Allow panning but prevent other gestures
        ...(isBlurred ? { position: 'absolute', filter: 'blur(8px)' } : {}),
        ...style,
      }}
      draggable={false} // Prevent HTML5 drag and drop
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right-click
      onDragStart={(e) => e.preventDefault()} // Prevent drag start
      onLoad={onLoad ?? undefined}
    />
  )
}
