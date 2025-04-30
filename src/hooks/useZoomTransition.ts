import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export interface ThumbnailPosition {
  x: number
  y: number
  width: number
  height: number
}

interface UseZoomTransitionProps {
  /**
   * Whether the viewer is open
   */
  isOpen: boolean
  /**
   * Position and dimensions of the thumbnail
   */
  thumbnailPosition: ThumbnailPosition | null
  /**
   * Duration of the animation on zoom in in seconds
   */
  durationIn?: number
  /**
   * Duration of the animation on zoom out in seconds
   */
  durationOut?: number
  /**
   * Callback when the zoom-in animation completes
   */
  onZoomInComplete?: () => void
  /**
   * Callback when the zoom-out animation completes
   */
  onZoomOutComplete?: () => void
}

interface UseZoomTransitionReturn {
  /**
   * Whether the zoom animation is in progress
   */
  isAnimating: boolean
  /**
   * Whether the component is zooming in
   */
  isZoomingIn: boolean
  /**
   * Whether the component is zooming out
   */
  isZoomingOut: boolean
  /**
   * Get the transform style for the image
   */
  getImageTransform: () => string
  /**
   * Get the opacity style for the background
   */
  getBackgroundOpacity: () => number
  /**
   * Start the zoom-out animation
   */
  startZoomOut: (options?: { offsetY?: number }) => void
}

/**
 * Hook to handle zoom transition effects between thumbnail and full-screen view
 */
export function useZoomTransition({
  isOpen,
  thumbnailPosition,
  durationIn = 0.3,
  durationOut = 0.3,
  onZoomInComplete,
  onZoomOutComplete,
}: UseZoomTransitionProps): UseZoomTransitionReturn {
  const [isAnimating, setIsAnimating] = useState<boolean>(false)
  const [isZoomingIn, setIsZoomingIn] = useState<boolean>(false)
  const [isZoomingOut, setIsZoomingOut] = useState<boolean>(false)
  const [animationProgress, setAnimationProgress] = useState<number>(0)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const offsetYRef = useRef<number>(0)

  // Get container dimensions on mount
  useEffect(() => {
    const updateContainerSize = () => {
      setContainerSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)

    return () => {
      window.removeEventListener('resize', updateContainerSize)
    }
  }, [])

  // Store the initial thumbnail position
  const initialPositionRef = useRef<ThumbnailPosition | null>(null)

  // Animation function
  const startZoomAnimation = useCallback(
    (startProgress: number, endProgress: number, params: { offsetY: number }) => {
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      startTimeRef.current = null
      offsetYRef.current = params.offsetY

      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp
        }

        const elapsed = timestamp - startTimeRef.current
        // note: the durations are swapped to work correctly, the logic is a bit random here it seems
        const progress = Math.min(elapsed / ((isZoomingIn ? durationOut : durationIn) * 1000), 1)

        // Calculate the current animation progress
        const currentProgress = startProgress + (endProgress - startProgress) * progress
        setAnimationProgress(currentProgress)

        if (progress < 1) {
          // Continue animation
          animationRef.current = requestAnimationFrame(animate)
        } else {
          // Animation complete
          animationRef.current = null

          if (isZoomingIn) {
            setIsZoomingIn(false)
            setIsAnimating(false)
            onZoomInComplete?.()
          } else if (isZoomingOut) {
            setIsZoomingOut(false)
            setIsAnimating(false)
            onZoomOutComplete?.()
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    [durationIn, durationOut, isZoomingIn, isZoomingOut, onZoomInComplete, onZoomOutComplete],
  )

  // Handle opening state changes and thumbnail position updates
  useEffect(() => {
    // Only start animation if we're open and have a thumbnail position
    if (isOpen && thumbnailPosition && !isZoomingOut) {
      // If we're already animating, don't restart the animation
      if (isAnimating && isZoomingIn) {
        return
      }

      // Store the initial position for the animation
      initialPositionRef.current = thumbnailPosition

      // Start zoom-in animation
      setIsZoomingIn(true)
      setIsZoomingOut(false)
      setIsAnimating(true)
      setAnimationProgress(0)
      startZoomAnimation(0, 1, { offsetY: 0 })
    }
  }, [isOpen, thumbnailPosition, isAnimating, isZoomingIn, isZoomingOut, startZoomAnimation])

  // Start zoom-out animation
  const startZoomOut = (options: { offsetY?: number } = {}) => {
    if (!thumbnailPosition) {
      return
    }

    // Update the initial position reference for the zoom-out animation
    initialPositionRef.current = thumbnailPosition

    setIsZoomingIn(false)
    setIsZoomingOut(true)
    setIsAnimating(true)
    startZoomAnimation(1, 0, { offsetY: options.offsetY ?? 0 })
  }

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Calculate transform based on thumbnail position and animation progress
  const getImageTransform = () => {
    // Use the stored initial position for consistency during animation
    const position = isZoomingOut
      ? thumbnailPosition
      : initialPositionRef.current || thumbnailPosition

    if (!(position && containerSize && isAnimating)) {
      return ''
    }

    const positionToUse = {
      ...position,
      y: position.y - offsetYRef.current,
    }

    // Calculate the scale difference between thumbnail and full screen
    const scaleX = positionToUse.width / containerSize.width
    const scaleY = positionToUse.height / containerSize.height

    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY)

    // Calculate the center position of the thumbnail
    const thumbnailCenterX = positionToUse.x + positionToUse.width / 2
    const thumbnailCenterY = positionToUse.y + positionToUse.height / 2

    // Calculate the center of the screen
    const screenCenterX = containerSize.width / 2
    const screenCenterY = containerSize.height / 2

    // Calculate the translation needed
    const translateX = thumbnailCenterX - screenCenterX
    const translateY = thumbnailCenterY - screenCenterY

    // Interpolate between thumbnail and full screen based on animation progress
    const currentScale = scale + (1 - scale) * animationProgress
    const currentTranslateX = translateX * (1 - animationProgress)
    const currentTranslateY = translateY * (1 - animationProgress)

    return `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentScale})`
  }

  // Calculate background opacity based on animation progress
  const getBackgroundOpacity = () => {
    return animationProgress
  }

  return {
    isAnimating,
    isZoomingIn,
    isZoomingOut,
    getImageTransform,
    getBackgroundOpacity,
    startZoomOut,
  }
}
