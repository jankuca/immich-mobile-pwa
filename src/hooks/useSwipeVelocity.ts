import { useState } from 'preact/hooks';

interface UseSwipeVelocityReturn {
  /**
   * Current swipe velocity in pixels per millisecond
   */
  swipeVelocity: number;
  /**
   * Update velocity based on current position
   */
  updateVelocity: (currentX: number) => void;
  /**
   * Reset velocity tracking state
   */
  resetVelocity: () => void;
}

/**
 * Hook to track and calculate swipe velocity
 */
export function useSwipeVelocity(): UseSwipeVelocityReturn {
  const [lastX, setLastX] = useState<number | null>(null);
  const [lastMoveTime, setLastMoveTime] = useState<number | null>(null);
  const [swipeVelocity, setSwipeVelocity] = useState<number>(0);

  const updateVelocity = (currentX: number) => {
    const currentTime = Date.now();

    if (lastX === null || lastMoveTime === null) {
      setLastX(currentX);
      setLastMoveTime(currentTime);
      return;
    }

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
  };

  const resetVelocity = () => {
    setLastX(null);
    setLastMoveTime(null);
    setSwipeVelocity(0);
  };

  return {
    swipeVelocity,
    updateVelocity,
    resetVelocity
  };
}
