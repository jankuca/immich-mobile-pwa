import type { RefObject } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { AssetTimelineItem } from '../services/api'

/**
 * Gesture state for the photo viewer
 * - idle: No gesture in progress
 * - detecting: Touch started, direction not yet determined
 * - swiping-horizontal: Horizontal swipe in progress (navigating between photos)
 * - swiping-vertical: Vertical swipe in progress (closing the viewer)
 * - animating: Transition animation in progress
 */
export type GestureState =
  | 'idle'
  | 'detecting'
  | 'swiping-horizontal'
  | 'swiping-vertical'
  | 'animating'

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
}

interface UsePhotoViewerGesturesReturn {
  /**
   * Current gesture state
   */
  gestureState: GestureState
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
   * Handler for touch start event
   */
  handleTouchStart: (e: TouchEvent) => void
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

// Direction detection threshold in pixels
const DIRECTION_THRESHOLD = 10

/**
 * Combined hook for photo viewer swipe gestures.
 * Handles direction detection, velocity tracking, horizontal navigation,
 * and vertical close gestures.
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
}: UsePhotoViewerGesturesProps): UsePhotoViewerGesturesReturn {
  // Asset state
  const [currentAsset, setCurrentAsset] = useState<AssetTimelineItem>(asset)
  const [transitioningAsset, setTransitioningAsset] = useState<AssetTimelineItem | null>(null)
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null)
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0)

  // Gesture state
  const [gestureState, setGestureState] = useState<GestureState>('idle')

  // Refs for DOM elements
  const photoContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Track pending transition timeouts so we can cancel them on rapid swipes
  const pendingTransitionRef = useRef<number | null>(null)

  // Touch tracking refs (using refs for synchronous access within event handlers)
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const currentXRef = useRef<number | null>(null)
  const currentYRef = useRef<number | null>(null)

  // Velocity tracking refs
  const lastXRef = useRef<number | null>(null)
  const lastMoveTimeRef = useRef<number | null>(null)
  const velocityRef = useRef<number>(0)

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex((a) => a.id === currentAsset.id)

  // Helper: Check if horizontal movement is dominant during detection phase
  const isHorizontalDominant = (): boolean => {
    if (
      startXRef.current === null ||
      startYRef.current === null ||
      currentXRef.current === null ||
      currentYRef.current === null
    ) {
      return false
    }
    const absX = Math.abs(currentXRef.current - startXRef.current)
    const absY = Math.abs(currentYRef.current - startYRef.current)
    return absX >= absY
  }

  // Helper: Get horizontal swipe distance
  const getHorizontalSwipeDistance = (): number => {
    if (startXRef.current === null || currentXRef.current === null) {
      return 0
    }
    return currentXRef.current - startXRef.current
  }

  // Helper: Get vertical swipe distance
  const getVerticalSwipeDistance = (): number => {
    if (startYRef.current === null || currentYRef.current === null) {
      return 0
    }
    return currentYRef.current - startYRef.current
  }

  // Helper: Update velocity for momentum calculations
  const updateVelocity = (currentX: number) => {
    const currentTime = Date.now()

    if (lastXRef.current === null || lastMoveTimeRef.current === null) {
      lastXRef.current = currentX
      lastMoveTimeRef.current = currentTime
      return
    }

    const timeDelta = currentTime - lastMoveTimeRef.current
    if (timeDelta > 0) {
      const distance = currentX - lastXRef.current
      velocityRef.current = distance / timeDelta // pixels per millisecond
    }

    lastXRef.current = currentX
    lastMoveTimeRef.current = currentTime
  }

  // Helper: Reset all gesture tracking state
  const resetGestureState = () => {
    startXRef.current = null
    startYRef.current = null
    currentXRef.current = null
    currentYRef.current = null
    lastXRef.current = null
    lastMoveTimeRef.current = null
    velocityRef.current = 0
    setGestureState('idle')
  }

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) {
      return
    }

    const x = touch.clientX
    const y = touch.clientY

    startXRef.current = x
    startYRef.current = y
    currentXRef.current = x
    currentYRef.current = y
    lastXRef.current = null
    lastMoveTimeRef.current = null
    velocityRef.current = 0

    setGestureState('detecting')
  }

  const handleTouchMove = (e: TouchEvent) => {
    // Update current touch position
    const touch = e.touches[0]
    if (!touch || startXRef.current === null || startYRef.current === null) {
      return
    }

    const x = touch.clientX
    const y = touch.clientY
    currentXRef.current = x
    currentYRef.current = y

    // Update velocity for momentum calculations
    updateVelocity(x)

    // Determine direction if still detecting
    if (gestureState === 'detecting') {
      const diffX = x - startXRef.current
      const diffY = y - startYRef.current
      const absX = Math.abs(diffX)
      const absY = Math.abs(diffY)

      if (absX > absY && absX > DIRECTION_THRESHOLD) {
        setGestureState('swiping-horizontal')
        onHorizontalSwipingChange?.(true)
      } else if (absY > absX && absY > DIRECTION_THRESHOLD) {
        setGestureState('swiping-vertical')
      } else {
        // Still detecting - prevent scroll if horizontal movement is dominant
        if (isHorizontalDominant()) {
          e.preventDefault()
        }
        return
      }
    }

    // Handle horizontal swipe
    if (gestureState === 'swiping-horizontal') {
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

      // If there's a pending transition timeout from a previous rapid swipe,
      // cancel it and finalize the transition immediately
      if (pendingTransitionRef.current !== null) {
        clearTimeout(pendingTransitionRef.current)
        pendingTransitionRef.current = null

        // If we have a transitioning asset from the previous swipe,
        // finalize it immediately as the new current asset
        if (transitioningAsset) {
          setCurrentAsset(transitioningAsset)
          setTransitioningAsset(null)
          setTransitionDirection(null)
          onAssetChange(transitioningAsset)

          // Reset scroll position
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
          }
        }
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
    else if (gestureState === 'swiping-vertical' && isAtTop && !isZoomed) {
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
          photoContainerRef.current.style.backgroundColor = `rgba(var(--color-background-rgb), ${newOpacity})`
        }
      }
    }
  }

  const handleTouchEnd = () => {
    // Notify parent that horizontal swiping has ended
    onHorizontalSwipingChange?.(false)

    // Get current velocity for momentum calculations
    const swipeVelocity = velocityRef.current

    // If the image is zoomed in, only handle swipe completion if at an edge
    if (isZoomed) {
      // If we're at an edge and swiping horizontally, allow navigation
      if (
        gestureState === 'swiping-horizontal' &&
        ((edgeReached === 'left' && currentIndex > 0) ||
          (edgeReached === 'right' && currentIndex < assets.length - 1))
      ) {
        // Continue with swipe completion logic
      } else {
        // Otherwise, reset state and return
        resetGestureState()
        setHorizontalSwipeOffset(0)
        return
      }
    }

    // Handle horizontal swipe completion
    if (gestureState === 'swiping-horizontal' && photoContainerRef.current) {
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
          // Store timeout ID so we can cancel it on rapid swipes
          pendingTransitionRef.current = window.setTimeout(() => {
            pendingTransitionRef.current = null
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
          // Store timeout ID so we can cancel it on rapid swipes
          pendingTransitionRef.current = window.setTimeout(() => {
            pendingTransitionRef.current = null
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
        // This one doesn't need to be tracked since it's just cleanup
        setTimeout(() => {
          setTransitioningAsset(null)
          setTransitionDirection(null)
        }, 150)
      }
    }
    // Handle vertical swipe completion (swipe down to close functionality)
    else if (
      gestureState === 'swiping-vertical' &&
      isAtTop &&
      !isZoomed &&
      scrollContainerRef.current
    ) {
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
            photoContainerRef.current.style.backgroundColor = 'rgba(var(--color-background-rgb), 1)'
            photoContainerRef.current.style.transition = 'background-color 0.3s ease'
          }
        }
      }
    }

    // Reset state
    resetGestureState()
    setHorizontalSwipeOffset(0)
  }

  // Update current asset when prop changes
  useEffect(() => {
    setCurrentAsset(asset)
  }, [asset])

  return {
    gestureState,
    currentAsset,
    transitioningAsset,
    transitionDirection,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    photoContainerRef,
    scrollContainerRef,
  }
}
