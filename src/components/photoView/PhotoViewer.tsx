import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Asset } from '../../services/api';
import apiService from '../../services/api';
import PhotoDetails from './PhotoDetails';
import PhotoViewerCarouselItem from './PhotoViewerCarouselItem';

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
  const [startY, setStartY] = useState<number | null>(null);
  const [startX, setStartX] = useState<number | null>(null);
  const [lastX, setLastX] = useState<number | null>(null);
  const [lastMoveTime, setLastMoveTime] = useState<number | null>(null);
  const [swipeVelocity, setSwipeVelocity] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0);
  const [isAtTop, setIsAtTop] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>({});
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [transitioningAsset, setTransitioningAsset] = useState<Asset | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

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

  // Handle touch start for swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    // Record starting touch position regardless of transition state
    // This allows interrupting ongoing transitions
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    setStartX(currentX);
    setStartY(currentY);
    setLastX(currentX);
    setLastMoveTime(Date.now());
    setSwipeVelocity(0);
    setSwipeDirection(null);
    setHorizontalSwipeOffset(0);

    // If we're in the middle of a transition, we'll allow interrupting it
    if (isTransitioning) {
      // Update animation ref to mark it as interruptible
      animationRef.current.interruptible = true;
    }
  };

  // Handle touch move for swipe gestures
  const handleTouchMove = (e: TouchEvent) => {
    if (startX === null || startY === null || lastX === null || lastMoveTime === null) return;

    // If we're in a transition but it's marked as interruptible, we can continue
    if (isTransitioning && !animationRef.current.interruptible) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
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

    const diffX = currentX - startX;
    const diffY = currentY - startY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Determine swipe direction if not already set
    if (!swipeDirection) {
      // If horizontal movement is greater than vertical and exceeds threshold
      if (absX > absY && absX > 2) {
        setSwipeDirection('horizontal');
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 2 && isAtTop) {
        setSwipeDirection('vertical');
      }
    }

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.preventDefault(); // Prevent default scrolling behavior

      // We'll use window.innerWidth directly where needed

      // Limit the swipe distance and add resistance at edges
      let swipeOffset = diffX;

      // Add resistance when swiping past the first or last image
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
    // Handle vertical swipe (existing swipe down to close functionality)
    else if (swipeDirection === 'vertical' && isAtTop) {
      // Only handle downward swipes when at the top
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
        const photoContainer = document.querySelector('.photo-viewer-photo-container');
        if (photoContainer) {
          const newOpacity = 1 - progress;
          (photoContainer as HTMLElement).style.backgroundColor = `rgba(255, 255, 255, ${newOpacity})`;
        }
      }
    }
  };

  // Handle touch end for swipe gestures
  const handleTouchEnd = () => {
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
    // Handle vertical swipe completion (existing swipe down to close functionality)
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
          const photoContainer = document.querySelector('.photo-viewer-photo-container');
          if (photoContainer) {
            (photoContainer as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 1)';
            (photoContainer as HTMLElement).style.transition = 'background-color 0.3s ease';
          }
        }
      }
    }

    // Reset touch tracking state
    setStartX(null);
    setStartY(null);
    setSwipeDirection(null);
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
          scrollBehavior: 'smooth'
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
            backgroundColor: 'rgba(255, 255, 255, 1)',
            transition: 'background-color 0.3s ease',
            willChange: 'transform', // Optimize for animations
            overflow: 'hidden' // Ensure content doesn't overflow during transitions
          }}
        >
          {/* Main photo/video content */}
          <PhotoViewerCarouselItem
            asset={currentAsset}
            isMain={true}
            loadingStatus={loadingStatus[currentAsset.id] || { thumbnailLoaded: false, fullImageLoaded: false }}
            onImageLoad={() => {
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

          {/* Transitioning asset (for seamless swiping) */}
          {transitioningAsset && (
            <PhotoViewerCarouselItem
              asset={transitioningAsset}
              isTransitioning={true}
              loadingStatus={loadingStatus[transitioningAsset.id] || { thumbnailLoaded: false, fullImageLoaded: false }}
              style={{
                left: 0,
                top: 0,
                transform: transitionDirection === 'left' ? 'translateX(100%)' : 'translateX(-100%)'
              }}
            />
          )}
        </div>

        {/* Photo details - directly follows the photo container */}
        <PhotoDetails asset={currentAsset} />
      </div>
    </div>
  );
};

export default PhotoViewer;
