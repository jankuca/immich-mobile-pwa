import type { RefObject } from 'preact'
import type { ThumbnailPosition } from './ThumbnailPosition'

/** Controller interface for VirtualizedTimeline */
export interface TimelineController {
  /** Get the position of a thumbnail by asset ID */
  getThumbnailPosition: (assetId: string) => ThumbnailPosition | null
  /** Scroll to a specific bucket index */
  scrollToBucket: (bucketIndex: number) => void
  /** Refresh the scroll position (re-reads from anchored scroll getter) */
  refreshScroll: () => void
  /** Get the scroll container element */
  getScrollContainer: () => HTMLDivElement | null
}

/** Ref type for TimelineController */
export type TimelineControllerRef = RefObject<TimelineController | null>

/** Creates a noop controller for initial state */
export function createNoopController(): TimelineController {
  return {
    getThumbnailPosition: () => null,
    scrollToBucket: () => {},
    refreshScroll: () => {},
    getScrollContainer: () => null,
  }
}

