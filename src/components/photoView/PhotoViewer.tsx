import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Asset } from '../../services/api';
import apiService from '../../services/api';
import PhotoDetails from './PhotoDetails';
import AssetImage from './AssetImage';
import useVerticalSwipe from '../../hooks/useVerticalSwipe';

interface PhotoViewerProps {
  asset: Asset;
  assets: Asset[];
  onClose: () => void;
}

// Interface for tracking image loading status
interface ImageLoadingStatus {
  [assetId: string]: {
    thumbnailLoaded: boolean;
    fullImageLoaded: boolean;
  };
}

const PhotoViewer = ({ asset, assets, onClose }: PhotoViewerProps) => {
  const [currentAsset, setCurrentAsset] = useState<Asset>(asset);
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  // Remove startY, startX, and swipeDirection as they're now handled by the hook
  const [lastX, setLastX] = useState<number | null>(null);
  const [lastMoveTime, setLastMoveTime] = useState<number | null>(null);
  const [swipeVelocity, setSwipeVelocity] = useState<number>(0);
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0);
  const [isAtTop, setIsAtTop] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>({});
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [transitioningAsset, setTransitioningAsset] = useState<Asset | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Use our custom vertical swipe hook
  const {
    swipeDirection,
    handleTouchStart: handleVerticalTouchStart,
    handleTouchMove: handleVerticalTouchMove,
    handleTouchEnd: handleVerticalTouchEnd,
    containerStyle,
    backgroundOpacity
  } = useVerticalSwipe({
    onClose,
    isAtTop
  });

  // Refs for animation state
  const animationRef = useRef<{
    inProgress: boolean;
    startTime: number | null;
    targetAsset: Asset | null;
    direction: 'left' | 'right' | null;
    interruptible: boolean;
  }>({
    inProgress: false,
    startTime: null,
    targetAsset: null,
    direction: null,
    interruptible: true
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const photoContainerRef = useRef<HTMLDivElement>(null);

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAsset.id);

  // Get the URLs for the current asset
  const assetThumbnailUrl = apiService.getAssetThumbnailUrl(currentAsset.id, 'webp');
  const assetFullUrl = apiService.getAssetUrl(currentAsset.id);

  // Calculate the photo container height based on scroll position
  // As we scroll down, the photo container shrinks from 100vh to a minimum height
  const maxScrollForEffect = 300; // The scroll amount at which the effect is complete
  const minPhotoHeight = 300; // Minimum height of the photo container in pixels
  const photoContainerHeight = Math.max(
    minPhotoHeight,
    window.innerHeight - (scrollPosition * (window.innerHeight - minPhotoHeight) / maxScrollForEffect)
  );

  // Handle scroll events
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setScrollPosition(scrollTop);
      setIsAtTop(scrollTop <= 10);
    }
  };

  // Set up scroll event listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Combined touch start handler
  const handleTouchStart = (e: TouchEvent) => {
    // Call the vertical swipe hook's touch start handler
    handleVerticalTouchStart(e);

    // Record starting touch position for horizontal swipe
    const currentX = e.touches[0].clientX;
    setLastX(currentX);
    setLastMoveTime(Date.now());
    setSwipeVelocity(0);
    setHorizontalSwipeOffset(0);

    // If we're in the middle of a transition, we'll allow interrupting it
    if (isTransitioning) {
      // Update animation ref to mark it as interruptible
      animationRef.current.interruptible = true;
    }
  };

  // Combined touch move handler
  const handleTouchMove = (e: TouchEvent) => {
    // Call the vertical swipe hook's touch move handler first
    handleVerticalTouchMove(e);

    // If vertical swipe is in progress, don't handle horizontal
    if (swipeDirection === 'vertical') return;

    // Handle horizontal swipe logic
    if (lastX === null || lastMoveTime === null) return;

    // If we're in a transition but it's marked as interruptible, we can continue
    if (isTransitioning && !animationRef.current.interruptible) return;

    const currentX = e.touches[0].clientX;
    const currentTime = Date.now();

    // Calculate velocity (pixels per millisecond)
    const timeDelta = currentTime - lastMoveTime;
    if (timeDelta > 0) {
      const distance = currentX - lastX;
      const velocity = distance / timeDelta; // pixels per millisecond
      setSwipeVelocity(velocity);
    }

    // Update last position and time for next velocity calculation
    setLastX(currentX);
    setLastMoveTime(currentTime);

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.preventDefault(); // Prevent default scrolling behavior

      // Calculate the cumulative swipe offset
      const diffX = currentX - lastX; // Current movement
      let swipeOffset = horizontalSwipeOffset + diffX; // Add to existing offset

      // Add resistance when swiping past the first or last image
      if ((currentIndex === 0 && swipeOffset > 0) || (currentIndex === assets.length - 1 && swipeOffset < 0)) {
        // Apply resistance by reducing the effect of the current movement
        swipeOffset = horizontalSwipeOffset + (diffX / 3);
      }

      // Set up transitioning asset immediately when swiping horizontally
      if (!transitioningAsset) {
        if (swipeOffset > 0 && currentIndex > 0) {
          // Swiping right to see previous image
          const prevAsset = assets[currentIndex - 1];
          setTransitioningAsset(prevAsset);
          setTransitionDirection('right');
          // Ensure it's preloaded
          preloadImage(prevAsset.id);
        } else if (swipeOffset < 0 && currentIndex < assets.length - 1) {
          // Swiping left to see next image
          const nextAsset = assets[currentIndex + 1];
          setTransitioningAsset(nextAsset);
          setTransitionDirection('left');
          // Ensure it's preloaded
          preloadImage(nextAsset.id);
        }
      }

      // Create a continuous sliding effect with both images
      if (photoContainerRef.current) {
        // Find the main image container and the transitioning container
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
  };

  // Combined touch end handler
  const handleTouchEnd = () => {
    // Call the vertical swipe hook's touch end handler first
    handleVerticalTouchEnd();

    // If vertical swipe was in progress, don't handle horizontal
    if (swipeDirection === 'vertical') return;

    // Handle horizontal swipe completion
    // If we're in a transition and it's not interruptible, ignore touch end
    if (isTransitioning && !animationRef.current.interruptible) return;

    // If we're interrupting an animation, clean up the previous animation state
    if (isTransitioning && animationRef.current.interruptible) {
      // Cancel any ongoing animations
      const mainContainer = photoContainerRef.current?.querySelector('[data-main="true"]') as HTMLElement;
      const transitioningContainer = photoContainerRef.current?.querySelector('[data-transitioning="true"]') as HTMLElement;

      if (mainContainer) {
        mainContainer.style.transition = 'none';
      }

      if (transitioningContainer) {
        transitioningContainer.style.transition = 'none';
      }
    }

    // Handle horizontal swipe completion
    if (swipeDirection === 'horizontal' && photoContainerRef.current) {
      const threshold = window.innerWidth * 0.3; // 30% of screen width as threshold

      // Calculate momentum-based threshold
      // Convert velocity from pixels/ms to a 0-1 scale where 1 is a "fast" swipe
      // A fast swipe is considered to be around 0.8-1.5 pixels per millisecond
      const velocityThreshold = 0.3; // Lower threshold to detect fast swipes more easily
      const highVelocityThreshold = 0.8; // Threshold for very fast swipes
      const normalizedVelocity = Math.abs(swipeVelocity);
      const isFastSwipe = normalizedVelocity > velocityThreshold;
      const isVeryFastSwipe = normalizedVelocity > highVelocityThreshold;

      // For fast swipes, we'll use a lower threshold (20% of screen width)
      // For very fast swipes, we'll use an even lower threshold (10% of screen width)
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
      // Check both position threshold and velocity
      // For very fast swipes, we'll be more lenient with the distance requirement
      if ((horizontalSwipeOffset < -effectiveThreshold ||
          (swipeVelocity < -velocityThreshold && horizontalSwipeOffset < 0) ||
          (swipeVelocity < -highVelocityThreshold && horizontalSwipeOffset < 0)) // Very fast swipes need minimal distance
          && currentIndex < assets.length - 1 && transitioningAsset) {
        // Swiped left past threshold - complete transition to next image
        // Set transition lock but mark animation as interruptible
        setIsTransitioning(true);
        animationRef.current = {
          inProgress: true,
          startTime: Date.now(),
          targetAsset: transitioningAsset,
          direction: 'left',
          interruptible: true
        };

        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          // Faster swipes = faster animations
          const baseDuration = 0.3; // seconds
          const minDuration = 0.1; // seconds - even faster for very fast swipes
          // Normalize velocity to 0-1 scale, but with higher sensitivity
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

            // Reset animation state
            animationRef.current = {
              inProgress: false,
              startTime: null,
              targetAsset: null,
              direction: null,
              interruptible: true
            };

            // Release transition lock immediately
            setIsTransitioning(false);
          }, duration * 1000);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          setIsTransitioning(false);
        }
      }
      else if ((horizontalSwipeOffset > effectiveThreshold ||
          (swipeVelocity > velocityThreshold && horizontalSwipeOffset > 0) ||
          (swipeVelocity > highVelocityThreshold && horizontalSwipeOffset > 0)) // Very fast swipes need minimal distance
          && currentIndex > 0 && transitioningAsset) {
        // Swiped right past threshold - complete transition to previous image
        // Set transition lock but mark animation as interruptible
        setIsTransitioning(true);
        animationRef.current = {
          inProgress: true,
          startTime: Date.now(),
          targetAsset: transitioningAsset,
          direction: 'right',
          interruptible: true
        };

        if (mainContainer && transitioningContainer) {
          // Calculate animation duration based on velocity
          // Faster swipes = faster animations
          const baseDuration = 0.2; // seconds
          const minDuration = 0.08; // seconds - even faster for very fast swipes
          // Normalize velocity to 0-1 scale, but with higher sensitivity
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

            // Reset animation state
            animationRef.current = {
              inProgress: false,
              startTime: null,
              targetAsset: null,
              direction: null,
              interruptible: true
            };

            // Release transition lock immediately
            setIsTransitioning(false);
          }, duration * 1000);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          setIsTransitioning(false);
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

    // Reset horizontal swipe state
    setHorizontalSwipeOffset(0);
  };

  // Navigate to previous and next assets with seamless transitions

  // Navigate to previous asset with animation
  const goToPrevious = () => {
    // Don't start a new transition if one is already in progress
    if (isTransitioning || currentIndex <= 0) return;

    const prevAsset = assets[currentIndex - 1];

    // Set transition lock but mark animation as interruptible
    setIsTransitioning(true);
    animationRef.current = {
      inProgress: true,
      startTime: Date.now(),
      targetAsset: prevAsset,
      direction: 'right',
      interruptible: true
    };

    // Ensure the previous asset is preloaded
    preloadImage(prevAsset.id);

    // Set the transitioning asset and direction
    setTransitioningAsset(prevAsset);
    setTransitionDirection('right');

    // Apply exit animation
    if (photoContainerRef.current) {
      // Wait a minimal time for the transitioning asset to render
      setTimeout(() => {
        // Find the main and transitioning containers
        const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
        const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

        if (mainContainer && transitioningContainer) {
          // Animate both containers to their final positions with faster transition
          mainContainer.style.transform = 'translateX(100%)';
          mainContainer.style.transition = 'transform 0.2s ease';

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = 'transform 0.2s ease';

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(prevAsset);
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

            // Reset animation state
            animationRef.current = {
              inProgress: false,
              startTime: null,
              targetAsset: null,
              direction: null,
              interruptible: true
            };

            // Release transition lock immediately
            setIsTransitioning(false);
          }, 200);
        } else {
          // Fallback if containers not found
          setCurrentAsset(prevAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          setIsTransitioning(false);
        }
      }, 10);
    } else {
      // Fallback if ref not available
      setCurrentAsset(prevAsset);
      setTransitioningAsset(null);
      setTransitionDirection(null);
      setIsTransitioning(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  // Navigate to next asset with animation
  const goToNext = () => {
    // Don't start a new transition if one is already in progress
    if (isTransitioning || currentIndex >= assets.length - 1) return;

    const nextAsset = assets[currentIndex + 1];

    // Set transition lock but mark animation as interruptible
    setIsTransitioning(true);
    animationRef.current = {
      inProgress: true,
      startTime: Date.now(),
      targetAsset: nextAsset,
      direction: 'left',
      interruptible: true
    };

    // Ensure the next asset is preloaded
    preloadImage(nextAsset.id);

    // Set the transitioning asset and direction
    setTransitioningAsset(nextAsset);
    setTransitionDirection('left');

    // Apply exit animation
    if (photoContainerRef.current) {
      // Wait a minimal time for the transitioning asset to render
      setTimeout(() => {
        // Find the main and transitioning containers
        const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
        const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

        if (mainContainer && transitioningContainer) {
          // Animate both containers to their final positions with faster transition
          mainContainer.style.transform = 'translateX(-100%)';
          mainContainer.style.transition = 'transform 0.2s ease';

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = 'transform 0.2s ease';

          // After animation completes, update the current asset
          setTimeout(() => {
            setCurrentAsset(nextAsset);
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

            // Release transition lock immediately
            setIsTransitioning(false);
          }, 200);
        } else {
          // Fallback if containers not found
          setCurrentAsset(nextAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
          setIsTransitioning(false);
        }
      }, 10);
    } else {
      // Fallback if ref not available
      setCurrentAsset(nextAsset);
      setTransitioningAsset(null);
      setTransitionDirection(null);
      setIsTransitioning(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  // Preload an image and track its loading status
  const preloadImage = (assetId: string) => {
    if (!assetId || preloadedImages.has(assetId)) return;

    // Initialize loading status for this asset if not already set
    if (!loadingStatus[assetId]) {
      setLoadingStatus(prev => ({
        ...prev,
        [assetId]: { thumbnailLoaded: false, fullImageLoaded: false }
      }));
    }

    // Preload thumbnail
    const thumbnailUrl = apiService.getAssetThumbnailUrl(assetId, 'webp');
    const thumbnailImg = new Image();
    thumbnailImg.onload = () => {
      setLoadingStatus(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], thumbnailLoaded: true }
      }));

      // After thumbnail loads, preload the full image
      const fullUrl = apiService.getAssetUrl(assetId);
      const fullImg = new Image();
      fullImg.onload = () => {
        setLoadingStatus(prev => ({
          ...prev,
          [assetId]: { ...prev[assetId], fullImageLoaded: true }
        }));
      };
      fullImg.src = fullUrl;
    };
    thumbnailImg.src = thumbnailUrl;

    // Mark this asset as being preloaded
    setPreloadedImages(prev => new Set(prev).add(assetId));
  };

  // Preload neighboring images when current asset changes
  useEffect(() => {
    // Preload current image if not already loaded
    preloadImage(currentAsset.id);

    // Preload next 2 images if available
    for (let i = 1; i <= 2; i++) {
      if (currentIndex + i < assets.length) {
        preloadImage(assets[currentIndex + i].id);
      }
    }

    // Preload previous 2 images if available
    for (let i = 1; i <= 2; i++) {
      if (currentIndex - i >= 0) {
        preloadImage(assets[currentIndex - i].id);
      }
    }
  }, [currentAsset.id]);

  // Prevent body scrolling when the photo viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      class="photo-viewer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        overflow: 'hidden', // Prevent content from being visible outside the container
        WebkitTouchCallout: 'none', // Disable iOS context menu globally
        userSelect: 'none' // Prevent selection globally
      }}
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right-click
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
          ...containerStyle // Apply transform from the vertical swipe hook
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
            backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity})`, // Use opacity from the hook
            transition: 'background-color 0.3s ease',
            willChange: 'transform', // Optimize for animations
            overflow: 'hidden' // Ensure content doesn't overflow during transitions
          }}
        >
          {/* Main photo/video content */}
          <div
            data-main="true"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {currentAsset.type === 'VIDEO' ? (
              <video
                src={assetFullUrl}
                controls
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* Thumbnail version (shown while full image loads) */}
                <AssetImage
                  src={assetThumbnailUrl}
                  alt={currentAsset.originalFileName}
                  isBlurred={true}
                  isLoaded={!loadingStatus[currentAsset.id]?.fullImageLoaded}
                />

                {/* Full resolution version */}
                <AssetImage
                  src={assetFullUrl}
                  alt={currentAsset.originalFileName}
                  isLoaded={loadingStatus[currentAsset.id]?.fullImageLoaded}
                  style={{}}
                  onLoad={() => {
                    // Mark full image as loaded when it completes loading
                    setLoadingStatus(prev => ({
                      ...prev,
                      [currentAsset.id]: {
                        thumbnailLoaded: true,
                        fullImageLoaded: true
                      }
                    }));
                  }}
                />

                {/* Loading indicator (shown while neither image is loaded) */}
                {!loadingStatus[currentAsset.id]?.thumbnailLoaded && !loadingStatus[currentAsset.id]?.fullImageLoaded && (
                  <div style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-md)'
                  }}>
                    <div class="loading-spinner" style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid var(--color-gray-light)',
                      borderTopColor: 'var(--color-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transitioning asset (for seamless swiping) */}
          {transitioningAsset && (
            <div
              data-transitioning="true"
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                left: 0,
                top: 0,
                transform: transitionDirection === 'left' ? 'translateX(100%)' : 'translateX(-100%)'
              }}
            >
              {transitioningAsset.type === 'VIDEO' ? (
                <video
                  src={apiService.getAssetUrl(transitioningAsset.id)}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Thumbnail version of transitioning asset */}
                  <AssetImage
                    src={apiService.getAssetThumbnailUrl(transitioningAsset.id, 'webp')}
                    alt={transitioningAsset.originalFileName}
                    isBlurred={true}
                    isLoaded={!loadingStatus[transitioningAsset.id]?.fullImageLoaded}
                  />

                  {/* Full resolution version of transitioning asset */}
                  <AssetImage
                    src={apiService.getAssetUrl(transitioningAsset.id)}
                    alt={transitioningAsset.originalFileName}
                    isLoaded={loadingStatus[transitioningAsset.id]?.fullImageLoaded}
                  />
                </div>
              )}
            </div>
          )}

          {/* Swipe indicators - only shown during horizontal swipe */}
          {swipeDirection === 'horizontal' && (
            <>
              {/* Left swipe indicator */}
              {currentIndex > 0 && horizontalSwipeOffset > 20 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-lg)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    color: 'white',
                    opacity: Math.min(horizontalSwipeOffset / 100, 0.8)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Previous</span>
                </div>
              )}

              {/* Right swipe indicator */}
              {currentIndex < assets.length - 1 && horizontalSwipeOffset < -20 && (
                <div
                  style={{
                    position: 'absolute',
                    right: 'var(--spacing-lg)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    color: 'white',
                    opacity: Math.min(Math.abs(horizontalSwipeOffset) / 100, 0.8)
                  }}
                >
                  <span>Next</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              )}
            </>
          )}

          {/* Navigation buttons - hidden but needed to reference functions */}
          <div style={{ display: 'none' }}>
            <button onClick={goToPrevious}>Previous</button>
            <button onClick={goToNext}>Next</button>
          </div>

          {/* Close button */}
          <div
            class="photo-viewer-close"
            style={{
              position: 'absolute',
              top: 'var(--spacing-md)',
              left: 'var(--spacing-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              zIndex: 1
            }}
            onClick={onClose}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          {/* Swipe indicators - only shown when at the top */}
          {isAtTop && scrollPosition < 10 && (
            <div style={{ position: 'absolute', bottom: 'var(--spacing-lg)', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)' }}>
              {/* Swipe up indicator */}
              <div
                class="swipe-up-indicator"
                style={{
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                  opacity: 0.8,
                  transition: 'opacity 0.3s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5 12L12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Scroll for details</span>
              </div>

              {/* Horizontal swipe indicator */}
              {(currentIndex > 0 || currentIndex < assets.length - 1) && (
                <div
                  class="swipe-horizontal-indicator"
                  style={{
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-sm)',
                    opacity: 0.8,
                    transition: 'opacity 0.3s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Swipe to navigate</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photo details - directly follows the photo container */}
        <PhotoDetails asset={currentAsset} />
      </div>
    </div>
  );
};

export default PhotoViewer;
