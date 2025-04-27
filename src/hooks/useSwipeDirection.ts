import { useState } from 'preact/hooks';

export type SwipeDirection = 'horizontal' | 'vertical' | null;

interface UseSwipeDirectionReturn {
  /**
   * Current detected swipe direction
   */
  swipeDirection: SwipeDirection;
  /**
   * Start X coordinate of the swipe
   */
  startX: number | null;
  /**
   * Start Y coordinate of the swipe
   */
  startY: number | null;
  /**
   * Handler for touch start event
   */
  handleTouchStart: (e: TouchEvent) => void;
  /**
   * Handler for determining swipe direction on touch move
   */
  handleDirectionDetection: (currentX: number, currentY: number) => SwipeDirection;
  /**
   * Reset swipe direction and coordinates
   */
  resetSwipeDirection: () => void;
}

/**
 * Hook to detect and track swipe direction (horizontal vs vertical)
 */
export function useSwipeDirection(): UseSwipeDirectionReturn {
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);

  const handleTouchStart = (e: TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    setStartX(currentX);
    setStartY(currentY);
    setSwipeDirection(null);
  };

  const handleDirectionDetection = (currentX: number, currentY: number): SwipeDirection => {
    if (startX === null || startY === null) return null;

    const diffX = currentX - startX;
    const diffY = currentY - startY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Only determine direction if not already set
    if (!swipeDirection) {
      // If horizontal movement is greater than vertical and exceeds threshold
      if (absX > absY && absX > 10) {
        setSwipeDirection('horizontal');
        return 'horizontal';
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 10) {
        setSwipeDirection('vertical');
        return 'vertical';
      }
    }

    return swipeDirection;
  };

  const resetSwipeDirection = () => {
    setStartX(null);
    setStartY(null);
    setSwipeDirection(null);
  };

  return {
    swipeDirection,
    startX,
    startY,
    handleTouchStart,
    handleDirectionDetection,
    resetSwipeDirection
  };
}
