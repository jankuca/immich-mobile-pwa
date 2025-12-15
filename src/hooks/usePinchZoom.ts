import { useEffect, useRef, useState } from 'preact/hooks'

interface UsePinchZoomProps {
  /**
   * Minimum zoom level
   */
  minZoom?: number
  /**
   * Maximum zoom level
   */
  maxZoom?: number
  /**
   * Initial zoom level
   */
  initialZoom?: number
  /**
   * Whether horizontal swiping is currently active
   */
  isHorizontalSwiping?: boolean
  /**
   * Image natural width
   */
  imageWidth?: number | null
  /**
   * Image natural height
   */
  imageHeight?: number | null
  /**
   * Container width
   */
  containerWidth?: number
  /**
   * Container height
   */
  containerHeight?: number
}

interface UsePinchZoomReturn {
  /**
   * Current zoom level
   */
  zoom: number
  /**
   * Current pan position X
   */
  panX: number
  /**
   * Current pan position Y
   */
  panY: number
  /**
   * Whether the image is currently zoomed in
   */
  isZoomed: boolean
  /**
   * Whether the image is panned to the left edge
   */
  isAtLeftEdge: boolean
  /**
   * Whether the image is panned to the right edge
   */
  isAtRightEdge: boolean
  /**
   * Handler for touch start event
   */
  handlePinchStart: (e: TouchEvent) => void
  /**
   * Handler for touch move event
   */
  handlePinchMove: (e: TouchEvent) => void
  /**
   * Handler for touch end event
   */
  handlePinchEnd: (e: TouchEvent) => void
  /**
   * Reset zoom and pan
   */
  resetZoom: () => void
  /**
   * Get the transform style for the image
   */
  getTransformStyle: () => string
}

/**
 * Hook to handle pinch zoom and pan gestures
 */
export function usePinchZoom({
  minZoom = 1,
  maxZoom = 5,
  initialZoom = 1,
  isHorizontalSwiping = false,
  imageWidth = null,
  imageHeight = null,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
}: UsePinchZoomProps = {}): UsePinchZoomReturn {
  const [zoom, setZoom] = useState<number>(initialZoom)
  const [panX, setPanX] = useState<number>(0)
  const [panY, setPanY] = useState<number>(0)
  const [isAtLeftEdge, setIsAtLeftEdge] = useState<boolean>(false)
  const [isAtRightEdge, setIsAtRightEdge] = useState<boolean>(false)

  // Track whether we're in a pinch gesture
  const isPinching = useRef<boolean>(false)

  // Track if we were pinching in this touch session (to prevent accidental closes)
  const wasPinching = useRef<boolean>(false)

  // Track when the last pinch gesture ended
  const lastPinchEndTime = useRef<number>(0)

  // Track initial distance between fingers for pinch
  const initialDistance = useRef<number | null>(null)

  // Track last touch positions for panning
  const lastTouchX = useRef<number | null>(null)
  const lastTouchY = useRef<number | null>(null)

  // Track center point of the pinch
  const pinchCenterX = useRef<number>(0)
  const pinchCenterY = useRef<number>(0)

  // Velocity tracking for inertial scrolling
  const lastVelocityTime = useRef<number | null>(null)
  const velocityX = useRef<number>(0)
  const velocityY = useRef<number>(0)
  const velocityHistoryX = useRef<number[]>([])
  const velocityHistoryY = useRef<number[]>([])
  const inertiaAnimationFrame = useRef<number | null>(null)

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (inertiaAnimationFrame.current !== null) {
        cancelAnimationFrame(inertiaAnimationFrame.current)
      }
    }
  }, [])

  /**
   * Calculate distance between two touch points
   */
  const getDistance = (touches: TouchList): number => {
    if (touches.length < 2) {
      return 0
    }

    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY

    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Calculate center point between two touch points
   */
  const getCenter = (touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY }
    }

    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    }
  }

  /**
   * Calculate the maximum pan values based on image dimensions and zoom level
   */
  const getMaxPanValues = (): { maxPanX: number; maxPanY: number } => {
    // Default max pan values based on container dimensions
    let maxPanX = (zoom - 1) * (containerWidth / 2)
    let maxPanY = (zoom - 1) * (containerHeight / 2)

    // If we have image dimensions, calculate more accurate pan boundaries
    if (imageWidth && imageHeight) {
      // First, calculate the displayed dimensions of the image (after object-fit: contain)
      const imageAspectRatio = imageWidth / imageHeight
      const containerAspectRatio = containerWidth / containerHeight

      let displayedWidth: number
      let displayedHeight: number

      if (imageAspectRatio > containerAspectRatio) {
        // Image is wider than container - fits to width
        displayedWidth = containerWidth
        displayedHeight = containerWidth / imageAspectRatio
      } else {
        // Image is taller than container - fits to height
        displayedHeight = containerHeight
        displayedWidth = containerHeight * imageAspectRatio
      }

      // Now calculate the scaled dimensions after zoom
      const scaledWidth = displayedWidth * zoom
      const scaledHeight = displayedHeight * zoom

      // Calculate the overflow amount (how much the scaled image extends beyond the container)
      const overflowX = Math.max(0, (scaledWidth - containerWidth) / 2)
      const overflowY = Math.max(0, (scaledHeight - containerHeight) / 2)

      // Set max pan values to the overflow amount
      maxPanX = overflowX
      maxPanY = overflowY
    }

    return { maxPanX, maxPanY }
  }

  /**
   * Check if the image is at the edge of its pan boundaries
   */
  const checkEdges = (newPanX: number): void => {
    const { maxPanX } = getMaxPanValues()

    // Check if we're at the left or right edge
    const leftEdgeThreshold = maxPanX * 0.9 // 90% of max pan to left
    const rightEdgeThreshold = -maxPanX * 0.9 // 90% of max pan to right

    setIsAtLeftEdge(newPanX >= leftEdgeThreshold)
    setIsAtRightEdge(newPanX <= rightEdgeThreshold)
  }

  /**
   * Apply inertial scrolling after touch end
   */
  const applyInertia = () => {
    // Cancel any existing animation
    if (inertiaAnimationFrame.current !== null) {
      cancelAnimationFrame(inertiaAnimationFrame.current)
      inertiaAnimationFrame.current = null
    }

    // Don't apply inertia if velocity is too low
    const minVelocity = 0.05 // pixels per millisecond (lowered threshold)
    if (Math.abs(velocityX.current) < minVelocity && Math.abs(velocityY.current) < minVelocity) {
      return
    }

    const deceleration = 0.92 // Deceleration factor per frame (slightly faster deceleration)
    const minVelocityThreshold = 0.01 // Stop when velocity is very low

    let lastTime = performance.now()

    const animate = (currentTime: number) => {
      // Calculate actual time delta for this frame
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      // Apply velocity to pan position using functional updates to get current values
      const { maxPanX, maxPanY } = getMaxPanValues()

      setPanX((currentPanX) => {
        // Calculate new pan position based on actual time delta
        let newPanX = currentPanX + velocityX.current * deltaTime

        // Clamp to boundaries
        newPanX = Math.min(maxPanX, Math.max(-maxPanX, newPanX))

        // Check edges
        checkEdges(newPanX)

        return newPanX
      })

      setPanY((currentPanY) => {
        // Calculate new pan position based on actual time delta
        let newPanY = currentPanY + velocityY.current * deltaTime

        // Clamp to boundaries
        newPanY = maxPanY > 0 ? Math.min(maxPanY, Math.max(-maxPanY, newPanY)) : 0

        return newPanY
      })

      // Apply deceleration
      velocityX.current *= deceleration
      velocityY.current *= deceleration

      // Continue animation if velocity is still significant
      if (
        Math.abs(velocityX.current) > minVelocityThreshold ||
        Math.abs(velocityY.current) > minVelocityThreshold
      ) {
        inertiaAnimationFrame.current = requestAnimationFrame(animate)
      } else {
        // Stop animation
        velocityX.current = 0
        velocityY.current = 0
        inertiaAnimationFrame.current = null
      }
    }

    // Start animation
    inertiaAnimationFrame.current = requestAnimationFrame(animate)
  }

  /**
   * Cancel inertial scrolling
   */
  const cancelInertia = () => {
    if (inertiaAnimationFrame.current !== null) {
      cancelAnimationFrame(inertiaAnimationFrame.current)
      inertiaAnimationFrame.current = null
    }
    velocityX.current = 0
    velocityY.current = 0
    velocityHistoryX.current = []
    velocityHistoryY.current = []
  }

  /**
   * Handle touch start event
   */
  const handlePinchStart = (e: TouchEvent) => {
    // Don't start pinch zoom if we're already swiping horizontally
    if (isHorizontalSwiping) {
      return
    }

    const touches = e.touches

    if (touches.length === 2) {
      // Start pinch gesture
      e.stopPropagation() // Prevent parent handlers from interfering
      isPinching.current = true
      wasPinching.current = true // Mark that we were pinching in this session
      initialDistance.current = getDistance(touches)

      // Calculate center of pinch
      const center = getCenter(touches)
      pinchCenterX.current = center.x
      pinchCenterY.current = center.y
    } else if (touches.length === 1 && zoom > 1) {
      // Start pan gesture (only when zoomed in)
      e.stopPropagation() // Prevent parent handlers from interfering
      wasPinching.current = false // Reset flag for new gesture
      lastTouchX.current = touches[0].clientX
      lastTouchY.current = touches[0].clientY
    } else if (touches.length === 1 && zoom === 1) {
      // Reset wasPinching flag when starting a new single-touch gesture at normal zoom
      wasPinching.current = false
    }
  }

  /**
   * Handle touch move event
   */
  const handlePinchMove = (e: TouchEvent) => {
    // Don't handle pinch/pan if we're already swiping horizontally
    if (isHorizontalSwiping) {
      return
    }

    const touches = e.touches

    if (isPinching.current && touches.length === 2 && initialDistance.current) {
      // Handle pinch zoom
      e.preventDefault() // Prevent default scrolling behavior
      e.stopPropagation() // Prevent parent handlers from interfering

      const currentDistance = getDistance(touches)
      const newZoom = Math.min(
        maxZoom,
        Math.max(minZoom, (zoom * currentDistance) / initialDistance.current),
      )

      // Calculate center of pinch
      const center = getCenter(touches)

      // Update zoom
      setZoom(newZoom)

      // If we've zoomed back to minimum, reset pan position
      if (newZoom === minZoom) {
        setPanX(0)
        setPanY(0)
        setIsAtLeftEdge(false)
        setIsAtRightEdge(false)
      }

      // Reset initial distance for continuous zooming
      initialDistance.current = currentDistance

      // Update pinch center
      pinchCenterX.current = center.x
      pinchCenterY.current = center.y
    } else if (touches.length === 1 && zoom > 1) {
      // Handle panning (only when zoomed in)
      e.preventDefault() // Prevent default scrolling behavior
      e.stopPropagation() // Prevent parent handlers from interfering

      // Cancel any ongoing inertia
      cancelInertia()

      const currentX = touches[0].clientX
      const currentY = touches[0].clientY
      const currentTime = Date.now()

      // Initialize last touch position if not set
      if (lastTouchX.current === null || lastTouchY.current === null) {
        lastTouchX.current = currentX
        lastTouchY.current = currentY
        lastVelocityTime.current = currentTime
        return
      }

      // Calculate pan distance
      const deltaX = currentX - lastTouchX.current
      const deltaY = currentY - lastTouchY.current

      // Calculate velocity for inertial scrolling
      if (lastVelocityTime.current !== null) {
        const timeDelta = currentTime - lastVelocityTime.current
        if (timeDelta > 0) {
          const currentVelocityX = deltaX / timeDelta // pixels per millisecond
          const currentVelocityY = deltaY / timeDelta

          // Keep a history of the last few velocity samples for smoothing
          velocityHistoryX.current.push(currentVelocityX)
          velocityHistoryY.current.push(currentVelocityY)

          // Keep only the last 5 samples
          if (velocityHistoryX.current.length > 5) {
            velocityHistoryX.current.shift()
          }
          if (velocityHistoryY.current.length > 5) {
            velocityHistoryY.current.shift()
          }

          // Calculate average velocity from history
          const avgVelocityX =
            velocityHistoryX.current.reduce((sum, v) => sum + v, 0) /
            velocityHistoryX.current.length
          const avgVelocityY =
            velocityHistoryY.current.reduce((sum, v) => sum + v, 0) /
            velocityHistoryY.current.length

          velocityX.current = avgVelocityX
          velocityY.current = avgVelocityY
        }
      }

      // Get max pan values based on image dimensions and zoom
      const { maxPanX, maxPanY } = getMaxPanValues()

      // Only allow vertical panning if the image is taller than the container when zoomed
      const newPanY = maxPanY > 0 ? Math.min(maxPanY, Math.max(-maxPanY, panY + deltaY)) : 0

      // Update pan position with boundaries
      const newPanX = Math.min(maxPanX, Math.max(-maxPanX, panX + deltaX))
      setPanX(newPanX)
      setPanY(newPanY)

      // Check if we're at the edges
      checkEdges(newPanX)

      // Update last touch position and time
      lastTouchX.current = currentX
      lastTouchY.current = currentY
      lastVelocityTime.current = currentTime
    }
  }

  /**
   * Handle touch end event
   */
  const handlePinchEnd = (e: TouchEvent) => {
    const remainingTouches = e.touches.length
    const currentTime = Date.now()

    // Check if this touch end is happening very soon after a pinch ended (within 300ms)
    const isJustAfterPinch = currentTime - lastPinchEndTime.current < 300

    // Only stop propagation if:
    // 1. We're currently pinching (lifting one finger from a two-finger gesture)
    // 2. We're panning while zoomed in (zoom > 1)
    // 3. We just finished a pinch AND there are still fingers on screen (remainingTouches > 0)
    // 4. This touch end is happening very soon after a pinch gesture ended
    const shouldStopPropagation =
      isPinching.current ||
      zoom > 1 ||
      (wasPinching.current && remainingTouches > 0) ||
      (isJustAfterPinch && zoom === 1)

    if (shouldStopPropagation) {
      e.stopPropagation()
    }

    // Apply inertial scrolling if we were panning
    if (zoom > 1 && !isPinching.current) {
      applyInertia()
    }

    // Track when pinch gesture ended
    if (isPinching.current) {
      lastPinchEndTime.current = currentTime
    }

    isPinching.current = false
    initialDistance.current = null
    lastTouchX.current = null
    lastTouchY.current = null
    lastVelocityTime.current = null

    // Reset wasPinching if all fingers are lifted
    if (remainingTouches === 0) {
      wasPinching.current = false
    }
  }

  /**
   * Reset zoom and pan
   */
  const resetZoom = () => {
    cancelInertia()
    setZoom(initialZoom)
    setPanX(0)
    setPanY(0)
    setIsAtLeftEdge(false)
    setIsAtRightEdge(false)
  }

  /**
   * Get the transform style for the image
   */
  const getTransformStyle = () => {
    return `translate(${panX}px, ${panY}px) scale(${zoom})`
  }

  return {
    zoom,
    panX,
    panY,
    isZoomed: zoom > 1,
    isAtLeftEdge,
    isAtRightEdge,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    resetZoom,
    getTransformStyle,
  }
}
