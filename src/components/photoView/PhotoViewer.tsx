import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Asset } from '../../services/api';
import apiService from '../../services/api';
import PhotoDetails from './PhotoDetails';

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
  const [swipeDirection, setSwipeDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [horizontalSwipeOffset, setHorizontalSwipeOffset] = useState<number>(0);
  const [isAtTop, setIsAtTop] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>({});
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [transitioningAsset, setTransitioningAsset] = useState<Asset | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);

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

  // Handle touch start for swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    // Record starting touch position
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setSwipeDirection(null);
    setHorizontalSwipeOffset(0);
  };

  // Handle touch move for swipe gestures
  const handleTouchMove = (e: TouchEvent) => {
    if (startX === null || startY === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Determine swipe direction if not already set
    if (!swipeDirection) {
      // If horizontal movement is greater than vertical and exceeds threshold
      if (absX > absY && absX > 10) {
        setSwipeDirection('horizontal');
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 10 && isAtTop) {
        setSwipeDirection('vertical');
      }
    }

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.preventDefault(); // Prevent default scrolling behavior

      // Calculate how far we can swipe (screen width)
      const maxSwipeDistance = window.innerWidth;

      // Limit the swipe distance and add resistance at edges
      let swipeOffset = diffX;

      // Add resistance when swiping past the first or last image
      if ((currentIndex === 0 && diffX > 0) || (currentIndex === assets.length - 1 && diffX < 0)) {
        swipeOffset = diffX / 3; // Add resistance by dividing the offset
      }

      // Set up transitioning asset if we're swiping significantly and haven't set it yet
      if (!transitioningAsset && Math.abs(swipeOffset) > 5) {
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
    // Handle horizontal swipe completion
    if (swipeDirection === 'horizontal' && photoContainerRef.current) {
      const threshold = window.innerWidth * 0.2; // 20% of screen width as threshold

      // Find the main and transitioning containers
      const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
      const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

      // Determine if we should navigate to the next/previous image
      if (horizontalSwipeOffset < -threshold && currentIndex < assets.length - 1 && transitioningAsset) {
        // Swiped left past threshold - complete transition to next image

        if (mainContainer && transitioningContainer) {
          // Animate both containers to their final positions
          mainContainer.style.transform = 'translateX(-100%)';
          mainContainer.style.transition = 'transform 0.3s ease';

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = 'transform 0.3s ease';

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
          }, 300);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
        }
      }
      else if (horizontalSwipeOffset > threshold && currentIndex > 0 && transitioningAsset) {
        // Swiped right past threshold - complete transition to previous image

        if (mainContainer && transitioningContainer) {
          // Animate both containers to their final positions
          mainContainer.style.transform = 'translateX(100%)';
          mainContainer.style.transition = 'transform 0.3s ease';

          transitioningContainer.style.transform = 'translateX(0)';
          transitioningContainer.style.transition = 'transform 0.3s ease';

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
          }, 300);
        } else {
          // Fallback if containers not found
          setCurrentAsset(transitioningAsset);
          setTransitioningAsset(null);
          setTransitionDirection(null);
        }
      }
      else {
        // Reset position with animation
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
        }, 300);
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
    if (currentIndex > 0) {
      const prevAsset = assets[currentIndex - 1];

      // Ensure the previous asset is preloaded
      preloadImage(prevAsset.id);

      // Set the transitioning asset and direction
      setTransitioningAsset(prevAsset);
      setTransitionDirection('right');

      // Apply exit animation
      if (photoContainerRef.current) {
        // Wait a tiny bit for the transitioning asset to render
        setTimeout(() => {
          // Find the main and transitioning containers
          const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
          const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

          if (mainContainer && transitioningContainer) {
            // Animate both containers to their final positions
            mainContainer.style.transform = 'translateX(100%)';
            mainContainer.style.transition = 'transform 0.3s ease';

            transitioningContainer.style.transform = 'translateX(0)';
            transitioningContainer.style.transition = 'transform 0.3s ease';

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
            }, 300);
          }
        }, 50);
      } else {
        // Fallback if ref not available
        setCurrentAsset(prevAsset);
        setTransitioningAsset(null);
        setTransitionDirection(null);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    }
  };

  // Navigate to next asset with animation
  const goToNext = () => {
    if (currentIndex < assets.length - 1) {
      const nextAsset = assets[currentIndex + 1];

      // Ensure the next asset is preloaded
      preloadImage(nextAsset.id);

      // Set the transitioning asset and direction
      setTransitioningAsset(nextAsset);
      setTransitionDirection('left');

      // Apply exit animation
      if (photoContainerRef.current) {
        // Wait a tiny bit for the transitioning asset to render
        setTimeout(() => {
          // Find the main and transitioning containers
          const mainContainer = photoContainerRef.current.querySelector('[data-main="true"]') as HTMLElement;
          const transitioningContainer = photoContainerRef.current.querySelector('[data-transitioning="true"]') as HTMLElement;

          if (mainContainer && transitioningContainer) {
            // Animate both containers to their final positions
            mainContainer.style.transform = 'translateX(-100%)';
            mainContainer.style.transition = 'transform 0.3s ease';

            transitioningContainer.style.transform = 'translateX(0)';
            transitioningContainer.style.transition = 'transform 0.3s ease';

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
            }, 300);
          }
        }, 50);
      } else {
        // Fallback if ref not available
        setCurrentAsset(nextAsset);
        setTransitioningAsset(null);
        setTransitionDirection(null);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
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

    // Preload next image if available
    if (currentIndex < assets.length - 1) {
      preloadImage(assets[currentIndex + 1].id);
    }

    // Preload previous image if available
    if (currentIndex > 0) {
      preloadImage(assets[currentIndex - 1].id);
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
        overflow: 'hidden' // Prevent content from being visible outside the container
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
                <img
                  src={assetThumbnailUrl}
                  alt={currentAsset.originalFileName}
                  style={{
                    position: 'absolute',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    filter: 'blur(8px)',
                    opacity: loadingStatus[currentAsset.id]?.fullImageLoaded ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                  }}
                />

                {/* Full resolution version */}
                <img
                  src={assetFullUrl}
                  alt={currentAsset.originalFileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    opacity: loadingStatus[currentAsset.id]?.fullImageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                  }}
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
                  <img
                    src={apiService.getAssetThumbnailUrl(transitioningAsset.id, 'webp')}
                    alt={transitioningAsset.originalFileName}
                    style={{
                      position: 'absolute',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      filter: 'blur(8px)',
                      opacity: loadingStatus[transitioningAsset.id]?.fullImageLoaded ? 0 : 1,
                      transition: 'opacity 0.3s ease'
                    }}
                  />

                  {/* Full resolution version of transitioning asset */}
                  <img
                    src={apiService.getAssetUrl(transitioningAsset.id)}
                    alt={transitioningAsset.originalFileName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      opacity: loadingStatus[transitioningAsset.id]?.fullImageLoaded ? 1 : 0,
                      transition: 'opacity 0.3s ease'
                    }}
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
