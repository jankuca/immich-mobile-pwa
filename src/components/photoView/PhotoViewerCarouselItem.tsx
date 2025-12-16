import { useEffect, useRef, useState } from 'preact/hooks'
import { usePinchZoom } from '../../hooks/usePinchZoom'
import type { Asset, AssetTimelineItem } from '../../services/api'
import { apiService } from '../../services/api'
import { AssetImage } from './AssetImage'

interface PhotoViewerCarouselItemProps {
  assetTimelineItem: AssetTimelineItem
  isMain?: boolean
  isTransitioning?: boolean
  loadingStatus: {
    thumbnailLoaded: boolean
    fullImageLoaded: boolean
  }
  onImageLoad?: () => void
  style?: Record<string, string | number>
  imageTransform?: string
  isZooming?: boolean
  isHorizontalSwiping?: boolean
  onZoomChange?: (isZoomed: boolean) => void
  onEdgeReached?: (edge: 'left' | 'right' | null) => void
}

export const PhotoViewerCarouselItem = ({
  assetTimelineItem,
  isMain = false,
  isTransitioning = false,
  loadingStatus,
  onImageLoad,
  style = {},
  imageTransform = '',
  isZooming = false,
  isHorizontalSwiping = false,
  onZoomChange,
  onEdgeReached,
}: PhotoViewerCarouselItemProps) => {
  const [fullAssetInfo, setFullAssetInfo] = useState<Asset | null>(null)

  const assetThumbnailUrl = apiService.getAssetThumbnailUrl(assetTimelineItem.id, 'webp')
  const assetFullUrl = apiService.getAssetUrl(assetTimelineItem.id)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageDimensions, setImageDimensions] = useState<{
    width: number | null
    height: number | null
  }>({
    width: fullAssetInfo?.exifInfo?.exifImageWidth ?? null,
    height: fullAssetInfo?.exifInfo?.exifImageHeight ?? null,
  })
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>(
    {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  )

  useEffect(() => {
    const abortController = new AbortController()
    apiService
      .getAsset(assetTimelineItem.id, { signal: abortController.signal })
      .then((asset) => {
        setFullAssetInfo(asset)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error fetching full asset info:', error)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [assetTimelineItem.id])

  // Update container dimensions when the component mounts
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setContainerDimensions({ width, height })
    }
  }, [])

  // Use pinch zoom hook for main images only
  const {
    isZoomed,
    isAtLeftEdge,
    isAtRightEdge,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handleDoubleTap,
    getTransformStyle,
    resetZoom,
  } = usePinchZoom({
    minZoom: 1,
    maxZoom: 5,
    initialZoom: 1,
    isHorizontalSwiping,
    imageWidth: imageDimensions.width,
    imageHeight: imageDimensions.height,
    containerWidth: containerDimensions.width,
    containerHeight: containerDimensions.height,
  })

  // Track last tap time and position for double-tap detection
  const lastTapTime = useRef<number>(0)
  const lastTapPosition = useRef<{ x: number; y: number } | null>(null)

  // Handle tap for double-tap detection
  const handleTap = (e: TouchEvent) => {
    // Only detect taps when all fingers are lifted
    if (e.touches.length > 0) {
      return
    }

    const touch = e.changedTouches[0]
    if (!touch) {
      return
    }

    const currentTime = Date.now()
    const tapX = touch.clientX
    const tapY = touch.clientY

    // Check if this is a double-tap (within 300ms and 50px of the last tap)
    const timeSinceLastTap = currentTime - lastTapTime.current
    const lastPos = lastTapPosition.current

    if (timeSinceLastTap < 300 && lastPos) {
      const distance = Math.sqrt((tapX - lastPos.x) ** 2 + (tapY - lastPos.y) ** 2)
      if (distance < 50) {
        // Double-tap detected
        e.preventDefault()
        handleDoubleTap(tapX, tapY)
        // Reset to prevent triple-tap
        lastTapTime.current = 0
        lastTapPosition.current = null
        return
      }
    }

    // Record this tap
    lastTapTime.current = currentTime
    lastTapPosition.current = { x: tapX, y: tapY }
  }

  // Combined touch end handler
  const handleTouchEnd = (e: TouchEvent) => {
    handlePinchEnd(e)
    // Only check for double-tap if we're the main image
    if (isMain) {
      handleTap(e)
    }
  }

  // Helper function to determine the transform style
  const getTransform = () => {
    if (!isMain) {
      return ''
    }
    if (isZoomed) {
      return getTransformStyle()
    }
    if (isZooming) {
      return imageTransform
    }
    return ''
  }

  // Notify parent component when zoom state changes
  useEffect(() => {
    if (isMain && onZoomChange && isZoomed !== undefined) {
      onZoomChange(isZoomed)
    }
  }, [isMain, isZoomed, onZoomChange])

  // Notify parent component when edge is reached
  useEffect(() => {
    if (isMain && onEdgeReached && isZoomed) {
      if (isAtLeftEdge) {
        onEdgeReached('left')
      } else if (isAtRightEdge) {
        onEdgeReached('right')
      } else {
        onEdgeReached(null)
      }
    }
  }, [isMain, isZoomed, isAtLeftEdge, isAtRightEdge, onEdgeReached])

  // Reset zoom when transitioning to a new image
  useEffect(() => {
    if (isTransitioning) {
      resetZoom()
    }
  }, [isTransitioning, resetZoom])

  // Update image dimensions when the image loads
  const handleImageLoaded = (e: Event) => {
    if (e.target instanceof HTMLImageElement) {
      setImageDimensions({
        width: e.target.naturalWidth,
        height: e.target.naturalHeight,
      })
    }

    // Call the original onLoad handler
    if (onImageLoad) {
      onImageLoad()
    }
  }

  return (
    <div
      ref={containerRef}
      data-main={isMain ? 'true' : undefined}
      data-transitioning={isTransitioning ? 'true' : undefined}
      data-zoomed={isMain && isZoomed ? 'true' : undefined}
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      onTouchStart={isMain ? handlePinchStart : undefined}
      onTouchMove={isMain ? handlePinchMove : undefined}
      onTouchEnd={isMain ? handleTouchEnd : undefined}
    >
      {assetTimelineItem.type === 'VIDEO' ? (
        <video
          src={assetFullUrl}
          controls={true}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: getTransform(),
            transformOrigin: 'center',
            willChange: isZooming || isZoomed ? 'transform' : 'auto',
            touchAction: isZoomed ? 'none' : 'auto', // Disable browser handling when zoomed
          }}
        >
          {/* Thumbnail version (shown while full image loads) */}
          <AssetImage
            src={assetThumbnailUrl}
            alt={fullAssetInfo?.originalFileName ?? 'Loading…'}
            assetWidth={fullAssetInfo?.exifInfo?.exifImageWidth ?? null}
            isBlurred={true}
            isLoaded={!loadingStatus?.fullImageLoaded}
          />

          {/* Full resolution version */}
          <AssetImage
            src={assetFullUrl}
            alt={fullAssetInfo?.originalFileName ?? 'Loading…'}
            assetWidth={fullAssetInfo?.exifInfo?.exifImageWidth ?? null}
            isLoaded={loadingStatus?.fullImageLoaded}
            onLoad={handleImageLoaded}
          />

          {/* Loading indicator (shown while neither image is loaded) */}
          {!(loadingStatus?.thumbnailLoaded || loadingStatus?.fullImageLoaded) && (
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-md)',
              }}
            >
              <div
                class="loading-spinner"
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid var(--color-gray-light)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
