import type { RefObject } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { AssetTimelineItem } from '../services/api'
import type { SwipeDirection } from './useSwipeDirection'
import { useSwipeVelocity } from './useSwipeVelocity'

interface UsePhotoViewerGesturesProps {
  /**
   * Current asset being viewed
   */
  asset: AssetTimelineItem
  /**
   * Array of all assets
   */
  assets: AssetTimelineItem[]
  /**
   * Whether the viewer is at the top of the scroll
   */
  isAtTop: boolean
  /**
   * Whether the image is currently zoomed in
   */
  isZoomed?: boolean
  /**
   * Edge that has been reached during panning
   */
  edgeReached?: 'left' | 'right' | null
  /**
   * Callback when an asset changes
   */
  onAssetChange: (asset: AssetTimelineItem) => void
  /**
   * Callback when the viewer should close
   */
  onClose: (state: { swipeDistance: number }) => void
  /**
   * Optional callback to preload an asset
   */
  preloadAsset?: (assetId: string) => void
  /**
   * Callback when horizontal swiping state changes
   */
  onHorizontalSwipingChange?: (isHorizontalSwiping: boolean) => void
  /**
   * Current swipe direction
   */
  swipeDirection: SwipeDirection
  /**
   * Current X coordinate
   */
  currentX: number | null
  /**
   * Current Y coordinate
   */
  currentY: number | null
  /**
   * Get horizontal swipe distance
   */
  getHorizontalSwipeDistance: () => number
  /**
   * Get vertical swipe distance
   */
  getVerticalSwipeDistance: () => number
  /**
   * Reset swipe direction
   */
  resetSwipeDirection: () => void
}

interface UsePhotoViewerGesturesReturn {
  /**
   * Current asset being viewed
   */
  currentAsset: AssetTimelineItem
  /**
   * Asset being transitioned to
   */
  transitioningAsset: AssetTimelineItem | null
  /**
   * Direction of the transition
   */
  transitionDirection: 'left' | 'right' | null
  /**
   * Handler for touch move event
   */
  handleTouchMove: (e: TouchEvent) => void
  /**
   * Handler for touch end event
   */
  handleTouchEnd: () => void
  /**
   * Reference for the photo container
   */
  photoContainerRef: RefObject<HTMLDivElement>
  /**
   * Reference for the scroll container
   */
  scrollContainerRef: RefObject<HTMLDivElement>
}

/**
 * Combined hook for photo viewer swipe gestures
 */
export function usePhotoViewerGestures({
  asset,
  assets,
  isAtTop,
  isZoomed = false,
  edgeReached = null,
  onAssetChange,
  onClose,
  preloadAsset,
  onHorizontalSwipingChange,
  swipeDirection,
  currentX,
  currentY,
  getHorizontalSwipeDistance,
  getVerticalSwipeDistance,
  resetSwipeDirection,
}: UsePhotoViewerGesturesProps): UsePhotoViewerGesturesReturn {
  const [currentAsset, setCurrentAsset] = useState<AssetTimelineItem>(asset)
  const [transitioningAsset, setTransitioningAsset] = useState<AssetTimelineItem | null>(null)
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null)
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0)

  const photoContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex((a) => a.id === currentAsset.id)

  // Use swipe velocity hook
  const { swipeVelocity, updateVelocity, resetVelocity } = useSwipeVelocity()

  const handleTouchMove = (e: TouchEvent) => {
    if (currentX === null || currentY === null) {
      return
    }

    // Update velocity for momentum calculations
    updateVelocity(currentX)

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      // Notify parent that horizontal swiping has started
      if (onHorizontalSwipingChange) {
        onHorizontalSwipingChange(true)
      }

      e.preventDefault() // Prevent default scrolling behavior

      // If the image is zoomed in, only allow swiping if we're at an edge
      if (isZoomed) {
        // Only allow swiping to next/previous if we're at the edge of the zoomed image
        if (
          (edgeReached === 'left' && currentIndex > 0) ||
          (edgeReached === 'right' && currentIndex < assets.length - 1)
        ) {
          // Continue with swiping logic
        } else {
          // Don't allow swiping if not at an edge or if at the first/last image
          return
        }
      }

      const diffX = getHorizontalSwipeDistance()

      // Add resistance when swiping past the first or last image
      let swipeOffset = diffX
      if ((currentIndex === 0 && diffX > 0) || (currentIndex === assets.length - 1 && diffX < 0)) {
        swipeOffset = diffX / 3 // Add resistance by dividing the offset
      }

      // Set up transitioning asset immediately when swiping horizontally
      if (!transitioningAsset) {
        if (swipeOffset > 0 && currentIndex > 0) {
          // Swiping right to see previous image
          const prevAsset = assets[currentIndex - 1]
          if (prevAsset) {
            setTransitioningAsset(prevAsset)
            setTransitionDirection('right')
            // Ensure it's preloaded
            if (preloadAsset) {
              preloadAsset(prevAsset.id)
            }
          }
        } else if (swipeOffset < 0 && currentIndex < assets.length - 1) {
          // Swiping left to see next image
          const nextAsset = assets[currentIndex + 1]
          if (nextAsset) {
            setTransitioningAsset(nextAsset)
            setTransitionDirection('left')
            // Ensure it's preloaded
            if (preloadAsset) {
              preloadAsset(nextAsset.id)
            }
          }
        }
      }

      // Apply transforms to the containers
      if (photoContainerRef.current) {
        const mainContainer = photoContainerRef.current.querySelector(
          '[data-main="true"]',
        ) as HTMLElement
        const transitioningContainer = photoContainerRef.current.querySelector(
          '[data-transitioning="true"]',
        ) as HTMLElement

        if (mainContainer && transitioningContainer) {
          // Don't move the photo container itself, just the inner containers
          photoContainerRef.current.style.transform = ''

          // Move the main container
          mainContainer.style.transform = `translateX(${swipeOffset}px)`
          mainContainer.style.transition = 'none'

          // Position the transitioning container relative to the swipe
          if (swipeOffset > 0) {
            // Swiping right (to previous)
            transitioningContainer.style.transform = `translateX(${-window.innerWidth + swipeOffset}px)`
          } else {
            // Swiping left (to next)
            transitioningContainer.style.transform = `translateX(${window.innerWidth + swipeOffset}px)`
          }
          transitioningContainer.style.transition = 'none'
        }
      }

      setHorizontalSwipeOffset(swipeOffset)
    }
    // Handle vertical swipe (swipe down to close functionality)
    else if (swipeDirection === 'vertical' && isAtTop && !isZoomed) {
      // Only handle downward swipes when at the top and not zoomed in
      const diffY = getVerticalSwipeDistance()
      if (diffY > 10) {
        e.preventDefault()

        // Calculate the swipe progress (0 to 1)
        const maxSwipeDistance = window.innerHeight / 3 // 1/3 of screen height for full effect
        const progress = Math.min(diffY / maxSwipeDistance, 1)

        // Move the scroll container down to follow the finger
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.transform = `translateY(${diffY}px)`
          scrollContainerRef.current.style.transition = 'none'
        }

        // Update the photo container background opacity based on the swipe progress
        if (photoContainerRef.current) {
          const newOpacity = 1 - progress
          photoContainerRef.current.style.backgroundColor = `rgba(255, 255, 255, ${newOpacity})`
        }
      }
    }
  }

  const handleTouchEnd = () => {
    // Notify parent that horizontal swiping has ended
    if (onHorizontalSwipingChange) {
      onHorizontalSwipingChange(false)
    }

    // If the image is zoomed in, only handle swipe completion if at an edge
    if (isZoomed) {
      // If we're at an edge and swiping horizontally, allow navigation
      if (
        swipeDirection === 'horizontal' &&
        ((edgeReached === 'left' && currentIndex > 0) ||
          (edgeReached === 'right' && currentIndex < assets.length - 1))
      ) {
        // Continue with swipe completion logic
      } else {
        // Otherwise, reset state and return
        resetSwipeDirection()
        resetVelocity()
        setHorizontalSwipeOffset(0)
        return
      }
    }

    // Handle horizontal swipe completion
    if (swipeDirection === 'horizontal' && photoContainerRef.current) {
      const threshold = window.innerWidth * 0.3 // 30% of screen width as threshold

      // Calculate momentum-based threshold
      const velocityThreshold = 0.3 // Lower threshold to detect fast swipes more easily
      const highVelocityThreshold = 0.8 // Threshold for very fast swipes
      const normalizedVelocity = Math.abs(swipeVelocity)
      const isFastSwipe = normalizedVelocity > velocityThreshold
      const isVeryFastSwipe = normalizedVelocity > highVelocityThreshold

      // For fast swipes, we'll use a lower threshold
      let effectiveThreshold: number
      if (isVeryFastSwipe) {
        effectiveThreshold = window.innerWidth * 0.1 // 10% for very fast swipes
      } else if (isFastSwipe) {
        effectiveThreshold = window.innerWidth * 0.2 // 20% for normal fast swipes
      } else {
        effectiveThreshold = threshold // 30% for normal swipes
      }

      // Find the main and transitioning containers
      const mainContainer = photoContainerRef.current.querySelector(
        '[data-main="true"]',
      ) as HTMLElement
      const transitioningContainer = photoContainerRef.current.querySelector(
        '[data-transitioning="true"]',
      ) as HTMLElement

      // Determine if we should navigate to the next/previous image
      if (
        (horizontalSwipeOffset < -effectiveThreshold ||
          (swipeVelocity < -velocityThreshold && horizontalSwipeOffset < 0) ||
          (swipeVelocity < -highVelocityThreshold && horizontalSwipeOffset < 0)) && // Very fast swipes need minimal distance
        currentIndex < assets.length - 1 &&
        transitioningAsset
      ) {
        // Swiped left past threshold - complete transition to next image
        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          const baseDuration = 0.3 // seconds
          const minDuration = 0.1 // seconds - even faster for very fast swipes
          const velocityFactor = Math.min(Math.abs(swipeVelocity) / 1.5, 1)
          const duration = Math.max(
            baseDuration - velocityFactor * (baseDuration - minDuration),
            minDuration,
          )

          // Animate both containers to their final positions with velocity-based transition
          mainContainer.style.transform = 'translateX(-100%)'
          mainContainer.style.transition = `transform ${duration}s ease`

          transitioningContainer.style.transform = 'translateX(0)'
          transitioningContainer.style.transition = `transform ${duration}s ease`

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(transitioningAsset)
            setTransitioningAsset(null)
            setTransitionDirection(null)

            // Reset scroll position
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0
            }

            // Reset transforms
            if (mainContainer) {
              mainContainer.style.transition = 'none'
              mainContainer.style.transform = ''
            }

            // Notify parent component
            onAssetChange(transitioningAsset)
          }, duration * 1000)
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset)
          setTransitioningAsset(null)
          setTransitionDirection(null)
          onAssetChange(transitioningAsset)
        }
      } else if (
        (horizontalSwipeOffset > effectiveThreshold ||
          (swipeVelocity > velocityThreshold && horizontalSwipeOffset > 0) ||
          (swipeVelocity > highVelocityThreshold && horizontalSwipeOffset > 0)) && // Very fast swipes need minimal distance
        currentIndex > 0 &&
        transitioningAsset
      ) {
        // Swiped right past threshold - complete transition to previous image
        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          const baseDuration = 0.2 // seconds
          const minDuration = 0.08 // seconds - even faster for very fast swipes
          const velocityFactor = Math.min(Math.abs(swipeVelocity) / 1.5, 1)
          const duration = Math.max(
            baseDuration - velocityFactor * (baseDuration - minDuration),
            minDuration,
          )

          // Animate both containers to their final positions with velocity-based transition
          mainContainer.style.transform = 'translateX(100%)'
          mainContainer.style.transition = `transform ${duration}s ease`

          transitioningContainer.style.transform = 'translateX(0)'
          transitioningContainer.style.transition = `transform ${duration}s ease`

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(transitioningAsset)
            setTransitioningAsset(null)
            setTransitionDirection(null)

            // Reset scroll position
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0
            }

            // Reset transforms
            if (mainContainer) {
              mainContainer.style.transition = 'none'
              mainContainer.style.transform = ''
            }

            // Notify parent component
            onAssetChange(transitioningAsset)
          }, duration * 1000)
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset)
          setTransitioningAsset(null)
          setTransitionDirection(null)
          onAssetChange(transitioningAsset)
        }
      } else {
        // Reset position with animation - no transition lock needed for cancellation
        if (mainContainer) {
          mainContainer.style.transform = ''
          mainContainer.style.transition = 'transform 0.3s ease'
        }

        // Also reset the transitioning container if it exists
        if (transitioningContainer) {
          transitioningContainer.style.transition = 'transform 0.3s ease'
          transitioningContainer.style.transform =
            transitionDirection === 'left' ? 'translateX(100%)' : 'translateX(-100%)'
        }

        // Clear transitioning asset state after animation completes
        setTimeout(() => {
          setTransitioningAsset(null)
          setTransitionDirection(null)
        }, 150)
      }
    }
    // Handle vertical swipe completion (swipe down to close functionality)
    else if (swipeDirection === 'vertical' && isAtTop && !isZoomed && scrollContainerRef.current) {
      const transform = scrollContainerRef.current.style.transform
      const match = transform.match(/translateY\((\d+)px\)/)

      if (match?.[1]) {
        const swipeDistance = Number.parseInt(match[1])
        const maxSwipeDistance = window.innerHeight / 3
        const progress = swipeDistance / maxSwipeDistance

        if (progress > 0.1) {
          // If swiped down more than 10% of the max distance, close the viewer
          onClose({ swipeDistance: swipeDistance })
        } else {
          // Otherwise, reset the transform and background
          scrollContainerRef.current.style.transform = ''
          scrollContainerRef.current.style.transition = 'transform 0.3s ease'

          // Reset the photo container background color
          if (photoContainerRef.current) {
            photoContainerRef.current.style.backgroundColor = 'rgba(255, 255, 255, 1)'
            photoContainerRef.current.style.transition = 'background-color 0.3s ease'
          }
        }
      }
    }

    // Reset state
    resetSwipeDirection()
    resetVelocity()
    setHorizontalSwipeOffset(0)
  }

  // Update current asset when prop changes
  useEffect(() => {
    setCurrentAsset(asset)
  }, [asset])

  return {
    currentAsset,
    transitioningAsset,
    transitionDirection,
    handleTouchMove,
    handleTouchEnd,
    photoContainerRef,
    scrollContainerRef,
  }
}
