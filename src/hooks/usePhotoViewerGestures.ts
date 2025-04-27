import { useState, useRef, useEffect } from 'preact/hooks';
import { Asset } from '../services/api';
import { SwipeDirection } from './useSwipeDirection';
import { useSwipeVelocity } from './useSwipeVelocity';

interface UsePhotoViewerGesturesProps {
  /**
   * Current asset being viewed
   */
  asset: Asset;
  /**
   * Array of all assets
   */
  assets: Asset[];
  /**
   * Whether the viewer is at the top of the scroll
   */
  isAtTop: boolean;
  /**
   * Callback when an asset changes
   */
  onAssetChange: (asset: Asset) => void;
  /**
   * Callback when the viewer should close
   */
  onClose: () => void;
  /**
   * Optional callback to preload an asset
   */
  preloadAsset?: (assetId: string) => void;
  /**
   * Current swipe direction
   */
  swipeDirection: SwipeDirection;
  /**
   * Start X coordinate
   */
  startX: number | null;
  /**
   * Start Y coordinate
   */
  startY: number | null;
  /**
   * Handler for touch start
   */
  handleTouchStart: (e: TouchEvent) => void;
  /**
   * Handler for direction detection
   */
  handleDirectionDetection: (currentX: number, currentY: number) => SwipeDirection;
  /**
   * Reset swipe direction
   */
  resetSwipeDirection: () => void;
}

interface UsePhotoViewerGesturesReturn {
  /**
   * Current asset being viewed
   */
  currentAsset: Asset;
  /**
   * Asset being transitioned to
   */
  transitioningAsset: Asset | null;
  /**
   * Direction of the transition
   */
  transitionDirection: 'left' | 'right' | null;
  /**
   * Handler for touch move event
   */
  handleTouchMove: (e: TouchEvent) => void;
  /**
   * Handler for touch end event
   */
  handleTouchEnd: () => void;
  /**
   * Reference for the photo container
   */
  photoContainerRef: any;
  /**
   * Reference for the scroll container
   */
  scrollContainerRef: any;
}

/**
 * Combined hook for photo viewer swipe gestures
 */
export function usePhotoViewerGestures({
  asset,
  assets,
  isAtTop,
  onAssetChange,
  onClose,
  preloadAsset,
  swipeDirection,
  startX,
  startY,
  handleTouchStart: directionTouchStart,
  handleDirectionDetection,
  resetSwipeDirection
}: UsePhotoViewerGesturesProps): UsePhotoViewerGesturesReturn {
  const [currentAsset, setCurrentAsset] = useState<Asset>(asset);
  const [transitioningAsset, setTransitioningAsset] = useState<Asset | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0);

  const photoContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAsset.id);

  // Use swipe velocity hook
  const {
    swipeVelocity,
    updateVelocity,
    resetVelocity
  } = useSwipeVelocity();

  const handleTouchMove = (e: TouchEvent) => {
    if (startX === null || startY === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    // Update velocity for momentum calculations
    updateVelocity(currentX);

    // Detect swipe direction if not already determined
    handleDirectionDetection(currentX, currentY);

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.preventDefault(); // Prevent default scrolling behavior

      const diffX = currentX - startX;

      // Add resistance when swiping past the first or last image
      let swipeOffset = diffX;
      if ((currentIndex === 0 && diffX > 0) || (currentIndex === assets.length - 1 && diffX < 0)) {
        swipeOffset = diffX / 3; // Add resistance by dividing the offset
      }

      // Set up transitioning asset immediately when swiping horizontally
      if (!transitioningAsset) {
        if (swipeOffset > 0 && currentIndex > 0) {
          // Swiping right to see previous image
          const prevAsset = assets[currentIndex - 1];
          setTransitioningAsset(prevAsset);
          setTransitionDirection('right');
          // Ensure it's preloaded
          if (preloadAsset) {
            preloadAsset(prevAsset.id);
          }
        } else if (swipeOffset < 0 && currentIndex < assets.length - 1) {
          // Swiping left to see next image
          const nextAsset = assets[currentIndex + 1];
          setTransitioningAsset(nextAsset);
          setTransitionDirection('left');
          // Ensure it's preloaded
          if (preloadAsset) {
            preloadAsset(nextAsset.id);
          }
        }
      }

      // Apply transforms to the containers
      if (photoContainerRef.current) {
        const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
        const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

        if (mainContainer && transitioningContainer) {
          // Don't move the photo container itself, just the inner containers
          photoContainerRef.current.style.transform = '';

          // Move the main container
          mainContainer.style.transform = `translateX(${swipeOffset}px)`;
          mainContainer.style.transition = 'none';

          // Position the transitioning container relative to the swipe
          if (swipeOffset > 0) { // Swiping right (to previous)
            transitioningContainer.style.transform = `translateX(${-window.innerWidth + swipeOffset}px)`;
          } else { // Swiping left (to next)
            transitioningContainer.style.transform = `translateX(${window.innerWidth + swipeOffset}px)`;
          }
          transitioningContainer.style.transition = 'none';
        }
      }

      setHorizontalSwipeOffset(swipeOffset);
    }
    // Handle vertical swipe (swipe down to close functionality)
    else if (swipeDirection === 'vertical' && isAtTop) {
      // Only handle downward swipes when at the top
      const diffY = currentY - startY;
      if (diffY > 10) {
        e.preventDefault();

        // Calculate the swipe progress (0 to 1)
        const maxSwipeDistance = window.innerHeight / 3; // 1/3 of screen height for full effect
        const progress = Math.min(diffY / maxSwipeDistance, 1);

        // Move the scroll container down to follow the finger
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.transform = `translateY(${diffY}px)`;
          scrollContainerRef.current.style.transition = 'none';
        }

        // Update the photo container background opacity based on the swipe progress
        if (photoContainerRef.current) {
          const newOpacity = 1 - progress;
          photoContainerRef.current.style.backgroundColor = `rgba(255, 255, 255, ${newOpacity})`;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    // Handle horizontal swipe completion
    if (swipeDirection === 'horizontal' && photoContainerRef.current) {
      const threshold = window.innerWidth * 0.3; // 30% of screen width as threshold

      // Calculate momentum-based threshold
      const velocityThreshold = 0.3; // Lower threshold to detect fast swipes more easily
      const highVelocityThreshold = 0.8; // Threshold for very fast swipes
      const normalizedVelocity = Math.abs(swipeVelocity);
      const isFastSwipe = normalizedVelocity > velocityThreshold;
      const isVeryFastSwipe = normalizedVelocity > highVelocityThreshold;

      // For fast swipes, we'll use a lower threshold
      let effectiveThreshold: number;
      if (isVeryFastSwipe) {
        effectiveThreshold = window.innerWidth * 0.1; // 10% for very fast swipes
      } else if (isFastSwipe) {
        effectiveThreshold = window.innerWidth * 0.2; // 20% for normal fast swipes
      } else {
        effectiveThreshold = threshold; // 30% for normal swipes
      }

      // Find the main and transitioning containers
      const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
      const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

      // Determine if we should navigate to the next/previous image
      if ((horizontalSwipeOffset < -effectiveThreshold ||
          (swipeVelocity < -velocityThreshold && horizontalSwipeOffset < 0) ||
          (swipeVelocity < -highVelocityThreshold && horizontalSwipeOffset < 0)) // Very fast swipes need minimal distance
          && currentIndex < assets.length - 1 && transitioningAsset) {
        // Swiped left past threshold - complete transition to next image
        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          const baseDuration = 0.3; // seconds
          const minDuration = 0.1; // seconds - even faster for very fast swipes
          const velocityFactor = Math.min(Math.abs(swipeVelocity) / 1.5, 1);
          const duration = Math.max(baseDuration - (velocityFactor * (baseDuration - minDuration)), minDuration);

          // Animate both containers to their final positions with velocity-based transition
          mainContainer.style.transform = 'translateX(-100%)';
          mainContainer.style.transition = `transform ${duration}s ease`;

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = `transform ${duration}s ease`;

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(transitioningAsset);
            setTransitioningAsset(null);
            setTransitionDirection(null);

            // Reset scroll position
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }

            // Reset transforms
            if (mainContainer) {
              mainContainer.style.transition = 'none';
              mainContainer.style.transform = '';
            }

            // Notify parent component
            onAssetChange(transitioningAsset);
          }, duration * 1000);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          onAssetChange(transitioningAsset);
        }
      }
      else if ((horizontalSwipeOffset > effectiveThreshold ||
          (swipeVelocity > velocityThreshold && horizontalSwipeOffset > 0) ||
          (swipeVelocity > highVelocityThreshold && horizontalSwipeOffset > 0)) // Very fast swipes need minimal distance
          && currentIndex > 0 && transitioningAsset) {
        // Swiped right past threshold - complete transition to previous image
        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          const baseDuration = 0.2; // seconds
          const minDuration = 0.08; // seconds - even faster for very fast swipes
          const velocityFactor = Math.min(Math.abs(swipeVelocity) / 1.5, 1);
          const duration = Math.max(baseDuration - (velocityFactor * (baseDuration - minDuration)), minDuration);

          // Animate both containers to their final positions with velocity-based transition
          mainContainer.style.transform = 'translateX(100%)';
          mainContainer.style.transition = `transform ${duration}s ease`;

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = `transform ${duration}s ease`;

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(transitioningAsset);
            setTransitioningAsset(null);
            setTransitionDirection(null);

            // Reset scroll position
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }

            // Reset transforms
            if (mainContainer) {
              mainContainer.style.transition = 'none';
              mainContainer.style.transform = '';
            }

            // Notify parent component
            onAssetChange(transitioningAsset);
          }, duration * 1000);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          onAssetChange(transitioningAsset);
        }
      }
      else {
        // Reset position with animation - no transition lock needed for cancellation
        if (mainContainer) {
          mainContainer.style.transform = '';
          mainContainer.style.transition = 'transform 0.3s ease';
        }

        // Also reset the transitioning container if it exists
        if (transitioningContainer) {
          transitioningContainer.style.transition = 'transform 0.3s ease';
          transitioningContainer.style.transform = transitionDirection === 'left' ?
            'translateX(100%)' : 'translateX(-100%)';
        }

        // Clear transitioning asset state after animation completes
        setTimeout(() => {
          setTransitioningAsset(null);
          setTransitionDirection(null);
        }, 150);
      }
    }
    // Handle vertical swipe completion (swipe down to close functionality)
    else if (swipeDirection === 'vertical' && startY !== null && isAtTop && scrollContainerRef.current) {
      const transform = scrollContainerRef.current.style.transform;
      const match = transform.match(/translateY\((\d+)px\)/);

      if (match) {
        const swipeDistance = parseInt(match[1]);
        const maxSwipeDistance = window.innerHeight / 3;
        const progress = swipeDistance / maxSwipeDistance;

        if (progress > 0.1) {
          // If swiped down more than 10% of the max distance, close the viewer
          onClose();
        } else {
          // Otherwise, reset the transform and background
          scrollContainerRef.current.style.transform = '';
          scrollContainerRef.current.style.transition = 'transform 0.3s ease';

          // Reset the photo container background color
          if (photoContainerRef.current) {
            photoContainerRef.current.style.backgroundColor = 'rgba(255, 255, 255, 1)';
            photoContainerRef.current.style.transition = 'background-color 0.3s ease';
          }
        }
      }
    }

    // Reset state
    resetSwipeDirection();
    resetVelocity();
    setHorizontalSwipeOffset(0);
  };

  // Update current asset when prop changes
  useEffect(() => {
    setCurrentAsset(asset);
  }, [asset]);

  return {
    currentAsset,
    transitioningAsset,
    transitionDirection,
    handleTouchMove,
    handleTouchEnd,
    photoContainerRef,
    scrollContainerRef
  };
}
