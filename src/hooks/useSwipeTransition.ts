import { useState, useRef } from 'preact/hooks';

export type TransitionDirection = 'left' | 'right' | null;

interface UseSwipeTransitionProps<T> {
  /**
   * Current item
   */
  currentItem: T;
  /**
   * Array of all items
   */
  items: T[];
  /**
   * Function to get unique ID from item
   */
  getItemId: (item: T) => string;
  /**
   * Base duration for transitions in seconds
   */
  baseDuration?: number;
  /**
   * Minimum duration for transitions in seconds
   */
  minDuration?: number;
  /**
   * Callback when transition completes
   */
  onTransitionComplete?: (newItem: T) => void;
}

interface UseSwipeTransitionReturn<T> {
  /**
   * Item being transitioned to
   */
  transitioningItem: T | null;
  /**
   * Direction of the transition
   */
  transitionDirection: TransitionDirection;
  /**
   * Whether a transition is currently in progress
   */
  isTransitioning: boolean;
  /**
   * Start transition to previous item
   */
  transitionToPrevious: () => void;
  /**
   * Start transition to next item
   */
  transitionToNext: () => void;
  /**
   * Start transition to a specific item
   */
  transitionToItem: (item: T, direction: TransitionDirection) => void;
  /**
   * Cancel current transition
   */
  cancelTransition: () => void;
  /**
   * Calculate transition duration based on velocity
   */
  calculateDuration: (velocity: number) => number;
}

/**
 * Hook to manage transitions between items during swipes
 */
export function useSwipeTransition<T>({
  currentItem,
  items,
  getItemId,
  baseDuration = 0.3,
  minDuration = 0.1,
  onTransitionComplete
}: UseSwipeTransitionProps<T>): UseSwipeTransitionReturn<T> {
  const [transitioningItem, setTransitioningItem] = useState<T | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Animation state reference
  const animationRef = useRef<{
    inProgress: boolean;
    startTime: number | null;
    targetItem: T | null;
    direction: TransitionDirection;
    interruptible: boolean;
  }>({
    inProgress: false,
    startTime: null,
    targetItem: null,
    direction: null,
    interruptible: true
  });

  // Find the index of the current item
  const currentIndex = items.findIndex(item => getItemId(item) === getItemId(currentItem));

  const transitionToPrevious = () => {
    if (isTransitioning || currentIndex <= 0) return;
    
    const prevItem = items[currentIndex - 1];
    transitionToItem(prevItem, 'right');
  };

  const transitionToNext = () => {
    if (isTransitioning || currentIndex >= items.length - 1) return;
    
    const nextItem = items[currentIndex + 1];
    transitionToItem(nextItem, 'left');
  };

  const transitionToItem = (item: T, direction: TransitionDirection) => {
    setTransitioningItem(item);
    setTransitionDirection(direction);
    setIsTransitioning(true);
    
    animationRef.current = {
      inProgress: true,
      startTime: Date.now(),
      targetItem: item,
      direction,
      interruptible: true
    };
  };

  const cancelTransition = () => {
    setTransitioningItem(null);
    setTransitionDirection(null);
    setIsTransitioning(false);
    
    animationRef.current = {
      inProgress: false,
      startTime: null,
      targetItem: null,
      direction: null,
      interruptible: true
    };
  };

  const calculateDuration = (velocity: number): number => {
    // Normalize velocity to 0-1 scale, but with higher sensitivity
    const velocityFactor = Math.min(Math.abs(velocity) / 1.5, 1);
    return Math.max(baseDuration - (velocityFactor * (baseDuration - minDuration)), minDuration);
  };

  const completeTransition = (item: T) => {
    onTransitionComplete?.(item);
    cancelTransition();
  };

  return {
    transitioningItem,
    transitionDirection,
    isTransitioning,
    transitionToPrevious,
    transitionToNext,
    transitionToItem,
    cancelTransition,
    calculateDuration
  };
}
