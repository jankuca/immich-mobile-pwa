import { useState, useRef, useEffect } from 'preact/hooks';

interface UseVerticalSwipeProps {
  onClose: () => void;
  isAtTop?: boolean;
  threshold?: number;
}

interface UseVerticalSwipeReturn {
  startY: number | null;
  startX: number | null;
  swipeDirection: 'horizontal' | 'vertical' | null;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
  containerStyle: {
    transform: string;
    transition?: string;
  };
  backgroundOpacity: number;
}

/**
 * Custom hook for handling vertical swipe gestures, particularly for closing a modal/viewer
 * when swiping down from the top.
 */
const useVerticalSwipe = ({ 
  onClose, 
  isAtTop = true, 
  threshold = 0.1 
}: UseVerticalSwipeProps): UseVerticalSwipeReturn => {
  const [startY, setStartY] = useState<number | null>(null);
  const [startX, setStartX] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [containerTransform, setContainerTransform] = useState<string>('');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(1);

  // Handle touch start for swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    setStartX(currentX);
    setStartY(currentY);
    setSwipeDirection(null);
    setContainerTransform('');
    setBackgroundOpacity(1);
  };

  // Handle touch move for vertical swipe gestures
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
      if (absX > absY && absX > 2) {
        setSwipeDirection('horizontal');
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 2 && isAtTop) {
        setSwipeDirection('vertical');
      }
    }

    // Handle vertical swipe (swipe down to close functionality)
    if (swipeDirection === 'vertical' && isAtTop) {
      // Only handle downward swipes when at the top
      if (diffY > 10) {
        e.preventDefault();

        // Calculate the swipe progress (0 to 1)
        const maxSwipeDistance = window.innerHeight / 3; // 1/3 of screen height for full effect
        const progress = Math.min(diffY / maxSwipeDistance, 1);

        // Update transform and opacity values
        setContainerTransform(`translateY(${diffY}px)`);
        setBackgroundOpacity(1 - progress);
      }
    }
  };

  // Handle touch end for vertical swipe gestures
  const handleTouchEnd = () => {
    if (swipeDirection === 'vertical' && startY !== null && isAtTop) {
      // Extract the Y translation value from the transform
      const match = containerTransform.match(/translateY\((\d+)px\)/);

      if (match) {
        const swipeDistance = parseInt(match[1]);
        const maxSwipeDistance = window.innerHeight / 3;
        const progress = swipeDistance / maxSwipeDistance;

        if (progress > threshold) {
          // If swiped down more than the threshold of the max distance, close the viewer
          onClose();
        } else {
          // Otherwise, reset the transform and background
          setContainerTransform('');
          setBackgroundOpacity(1);
        }
      }
    }

    // Reset touch tracking state
    setStartX(null);
    setStartY(null);
    setSwipeDirection(null);
  };

  return {
    startY,
    startX,
    swipeDirection,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    containerStyle: {
      transform: containerTransform,
      transition: containerTransform === '' ? 'transform 0.3s ease' : undefined
    },
    backgroundOpacity
  };
};

export default useVerticalSwipe;
