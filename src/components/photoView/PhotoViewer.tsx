import { createPortal } from 'preact/compat'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useImagePreloader } from '../../hooks/useImagePreloader'
import { usePhotoViewerGestures } from '../../hooks/usePhotoViewerGestures'
import { useSwipeDirection } from '../../hooks/useSwipeDirection'
import { type ThumbnailPosition, useZoomTransition } from '../../hooks/useZoomTransition'
import type { AssetTimelineItem } from '../../services/api'
import { PhotoDetails } from './PhotoDetails'
import { PhotoViewerCarouselItem } from './PhotoViewerCarouselItem'

interface PhotoViewerProps {
  asset: AssetTimelineItem
  assets: AssetTimelineItem[]
  onClose: () => void
  thumbnailPosition?: ThumbnailPosition | null
}

export const PhotoViewer = ({
  asset,
  assets,
  onClose,
  thumbnailPosition = null,
}: PhotoViewerProps) => {
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const [isAtTop, setIsAtTop] = useState<boolean>(true)
  const [isClosing, setIsClosing] = useState<boolean>(false)
  const [isZoomed, setIsZoomed] = useState<boolean>(false)
  const [isHorizontalSwiping, setIsHorizontalSwiping] = useState<boolean>(false)
  const [edgeReached, setEdgeReached] = useState<'left' | 'right' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use the zoom transition hook
  const { isZoomingIn, isZoomingOut, getImageTransform, getBackgroundOpacity, startZoomOut } =
    useZoomTransition({
      isOpen: true,
      thumbnailPosition,
      durationIn: 0.2,
      durationOut: 0.3,
      onZoomOutComplete: () => {
        onClose()
      },
    })

  // Handle the closing transition
  const handleClose = (state: { swipeDistance: number }) => {
    if (thumbnailPosition) {
      // Use zoom out animation if we have thumbnail position
      startZoomOut({ offsetY: state.swipeDistance })
    }

    // Fallback to fade out animation
    setIsClosing(true)
    // Wait for the transition to complete before actually closing
    setTimeout(() => {
      onClose()
    }, 300) // Match this with the transition duration
  }

  // Helper function to determine the background color
  const getBackgroundColor = () => {
    if (isClosing) {
      return 'rgba(var(--color-background-rgb), 0)'
    }
    if (isZoomingOut) {
      return `rgba(var(--color-background-rgb), ${getBackgroundOpacity()})`
    }
    return 'rgba(var(--color-background-rgb), 1)'
  }

  // Use the image preloader hook
  const { loadingStatus, preloadImage, handleImageLoad } = useImagePreloader(assets, asset.id)

  // Use a single instance of swipe direction hook
  const {
    handleTouchStart,
    handleTouchMove: directionTouchMove,
    resetSwipeDirection,
    getSwipeDirection,
    getCurrentX,
    getCurrentY,
    getHorizontalSwipeDistance,
    getVerticalSwipeDistance,
    isHorizontalDominant,
  } = useSwipeDirection()

  // Use the photo viewer gestures hook
  const {
    currentAsset,
    transitioningAsset,
    transitionDirection,
    handleTouchMove: gesturesTouchMove,
    handleTouchEnd,
    photoContainerRef,
    scrollContainerRef,
  } = usePhotoViewerGestures({
    asset,
    assets,
    isAtTop,
    isZoomed,
    edgeReached,
    onAssetChange: (newAsset) => {
      // Update the preloader with the new asset ID
      preloadImage(newAsset.id)
    },
    onClose: handleClose, // Use our transition handler instead of direct onClose
    preloadAsset: preloadImage,
    onHorizontalSwipingChange: setIsHorizontalSwiping,
    getSwipeDirection,
    getCurrentX,
    getCurrentY,
    getHorizontalSwipeDistance,
    getVerticalSwipeDistance,
    isHorizontalDominant,
    resetSwipeDirection,
  })

  // Combined touch move handler
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      directionTouchMove(e)
      gesturesTouchMove(e)
    },
    [directionTouchMove, gesturesTouchMove],
  )

  // Calculate the photo container height based on scroll position
  // As we scroll down, the photo container shrinks from 100vh to a minimum height
  const maxScrollForEffect = 300 // The scroll amount at which the effect is complete
  const minPhotoHeight = 300 // Minimum height of the photo container in pixels
  const photoContainerHeight = Math.max(
    minPhotoHeight,
    window.innerHeight -
      (scrollPosition * (window.innerHeight - minPhotoHeight)) / maxScrollForEffect,
  )

  // Set up scroll event listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      // Handle scroll events
      const handleScroll = () => {
        if (scrollContainerRef.current) {
          const scrollTop = scrollContainerRef.current.scrollTop
          setScrollPosition(scrollTop)
          setIsAtTop(scrollTop <= 10)
        }
      }

      scrollContainer.addEventListener('scroll', handleScroll)
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [scrollContainerRef])

  // Prevent body scrolling when the photo viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Use createPortal to render directly to document.body, escaping all stacking contexts
  return createPortal(
    <div
      ref={containerRef}
      class="photo-viewer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-index-photo-viewer)',
        overflow: 'hidden', // Prevent content from being visible outside the container
        WebkitTouchCallout: 'none', // Disable iOS context menu globally
        userSelect: 'none', // Prevent selection globally
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.3s ease',
        pointerEvents: isClosing || isZoomingOut ? 'none' : 'auto', // Disable interactions during closing
      }}
      onContextMenu={(e) => {
        e.preventDefault() // Prevent context menu on right-click
      }}
    >
      {/* Scrollable container for the entire content */}
      <div
        ref={scrollContainerRef}
        class="photo-viewer-scroll-container"
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          scrollBehavior: 'smooth',
          // Keep the container in place during closing transition
          position: isClosing ? 'fixed' : 'relative',
          top: isClosing ? 0 : 'auto',
          left: isClosing ? 0 : 'auto',
          right: isClosing ? 0 : 'auto',
          bottom: isClosing ? 0 : 'auto',
          width: isClosing ? '100%' : 'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Photo container - shrinks as you scroll */}
        <div
          ref={photoContainerRef}
          class="photo-viewer-photo-container"
          style={{
            height: `${photoContainerHeight}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundColor: getBackgroundColor(),
            transition: thumbnailPosition ? 'none' : 'background-color 0.3s ease',
            willChange: 'transform, background-color', // Optimize for animations
            overflow: 'hidden', // Ensure content doesn't overflow during transitions
          }}
        >
          {/* Main photo/video content */}
          <PhotoViewerCarouselItem
            assetTimelineItem={currentAsset}
            isMain={true}
            loadingStatus={
              loadingStatus[currentAsset.id] || { thumbnailLoaded: false, fullImageLoaded: false }
            }
            onImageLoad={() => handleImageLoad(currentAsset.id)}
            imageTransform={getImageTransform()}
            isZooming={isZoomingIn || isZoomingOut}
            isHorizontalSwiping={isHorizontalSwiping}
            onZoomChange={(zoomed) => setIsZoomed(zoomed)}
            onEdgeReached={(edge) => setEdgeReached(edge)}
          />

          {/* Transitioning asset (for seamless swiping) */}
          {transitioningAsset && (
            <PhotoViewerCarouselItem
              assetTimelineItem={transitioningAsset}
              isTransitioning={true}
              loadingStatus={
                loadingStatus[transitioningAsset.id] || {
                  thumbnailLoaded: false,
                  fullImageLoaded: false,
                }
              }
              style={{
                left: 0,
                top: 0,
                transform:
                  transitionDirection === 'left' ? 'translateX(100%)' : 'translateX(-100%)',
              }}
            />
          )}
        </div>

        {/* Photo details - directly follows the photo container */}
        <PhotoDetails assetTimelineItem={currentAsset} />
      </div>
    </div>,
    document.body,
  )
}
