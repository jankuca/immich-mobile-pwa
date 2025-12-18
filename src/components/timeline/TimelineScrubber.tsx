import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

export interface TimeBucket {
  timeBucket: string
  count: number
}

interface YearMonth {
  year: number
  month: number
  label: string
  bucketIndex: number // First bucket index for this month
}

interface YearGroup {
  year: number
  months: YearMonth[]
}

interface TimelineScrubberProps {
  buckets: TimeBucket[]
  /** Current visible date string from the timeline viewport */
  visibleDate: string | null
  /** Called when user drags to a bucket position */
  onScrub: (bucketIndex: number) => void
  /** Called when user stops dragging with final bucket index */
  onScrubEnd: (bucketIndex: number) => void
}

// Item heights for positioning calculations (including gap)
const YEAR_ITEM_HEIGHT = 17 // year label: 11px font line-height ~15px + 4px padding-y + 2px gap ≈ 17px
const MONTH_ITEM_HEIGHT = 14 // month label: 10px font line-height ~12px + 2px padding-y + 2px gap ≈ 14px
// Active month item height (larger when active)
const ACTIVE_MONTH_ITEM_HEIGHT = 32 // 14px font + 12px padding-y + 6px gap

interface MonthItemProps {
  label: string
  year: number
  isActive: boolean
}

function MonthItem({ label, year, isActive }: MonthItemProps) {
  const displayLabel = `${label} ${year}`

  if (isActive) {
    return (
      <div
        class="liquid-glass"
        style={{
          padding: '6px 12px',
          marginRight: '40px', // Offset from finger
          borderRadius: '12px',
          fontSize: '14px',
          color: 'var(--color-text)',
          fontWeight: 'var(--font-weight-semibold)',
          border: 'none',
        }}
      >
        {displayLabel}
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '1px 8px',
        marginRight: '8px',
        borderRadius: '8px',
        fontSize: '10px',
        color: 'var(--color-gray)',
        fontWeight: 'var(--font-weight-regular)',
      }}
    >
      {displayLabel}
    </div>
  )
}

interface ScrubberListProps {
  yearGroups: YearGroup[]
  activeYearIndex: number
  currentPosition: { year: number; month: number }
  dragY: number
}

function ScrubberList({ yearGroups, activeYearIndex, currentPosition, dragY }: ScrubberListProps) {
  // Calculate the offset to position the active item at the finger position
  // We need to know how much height is above the active month
  let heightAboveActive = 0

  // Inactive years before active year: each shows just a year label
  for (let i = 0; i < activeYearIndex; i++) {
    heightAboveActive += YEAR_ITEM_HEIGHT
  }

  // Active year has no year label, just months - add height of months above active month
  const activeGroup = yearGroups[activeYearIndex]
  if (activeGroup) {
    for (const month of activeGroup.months) {
      if (month.month === currentPosition.month) {
        break
      }
      heightAboveActive += MONTH_ITEM_HEIGHT
    }
  }

  // The list should be positioned so the active item is centered at dragY
  // We use transform to move the list up by the calculated offset, then down by dragY
  // Subtract half the active month item height to center the active item under the finger
  const listOffset = dragY - heightAboveActive - ACTIVE_MONTH_ITEM_HEIGHT / 2

  return (
    <div
      class="scrubber-list"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '2px',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-gray)',
        transform: `translateY(${listOffset}px)`,
      }}
    >
      {yearGroups.map((group, groupIndex) => {
        const isActive = groupIndex === activeYearIndex
        return (
          <div
            key={group.year}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
          >
            {/* Inactive years: show just the year label */}
            {!isActive && (
              <div
                style={{
                  padding: '2px 8px',
                  marginRight: '8px',
                  borderRadius: '10px',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize: '11px',
                  color: 'var(--color-gray)',
                }}
              >
                {group.year}
              </div>
            )}
            {/* Active year: show months with year (e.g. "Mar 2016") */}
            {isActive &&
              group.months.map((month) => (
                <MonthItem
                  key={month.month}
                  label={month.label}
                  year={group.year}
                  isActive={month.month === currentPosition.month}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export function TimelineScrubber({
  buckets,
  visibleDate,
  onScrub,
  onScrubEnd,
}: TimelineScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragBucketIndex, setDragBucketIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [dragY, setDragY] = useState(0) // Track Y position of finger for positioning the list

  // Delay collapsing the scrubber after drag ends for better UX
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const expandScrubber = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    setIsExpanded(true)
  }, [])

  const collapseScrubberDelayed = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
      collapseTimeoutRef.current = null
    }, 600) // Collapse after 600ms
  }, [])

  // Group buckets by year and month (memoized, only recalculates when buckets change)
  const yearGroups = useMemo(() => {
    const groups: Map<number, YearGroup> = new Map()

    for (let index = 0; index < buckets.length; index++) {
      const bucket = buckets[index]
      if (!bucket) {
        continue
      }
      const date = new Date(bucket.timeBucket)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (!groups.has(year)) {
        groups.set(year, { year, months: [] })
      }

      const group = groups.get(year)
      if (group) {
        // Only add month if not already present
        const monthExists = group.months.some((m) => m.month === month)
        if (!monthExists) {
          const monthLabel = date.toLocaleDateString('en-US', { month: 'short' })
          group.months.push({
            year,
            month,
            label: monthLabel,
            bucketIndex: index,
          })
        }
      }
    }

    // Sort years descending, months within years descending
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.year - a.year)
    for (const group of sortedGroups) {
      group.months.sort((a, b) => b.month - a.month)
    }

    return sortedGroups
  }, [buckets])

  // Calculate current position from visible date or drag position
  const currentPosition = useMemo(() => {
    if (isDragging) {
      const bucket = buckets[dragBucketIndex]
      if (bucket) {
        const date = new Date(bucket.timeBucket)
        return { year: date.getFullYear(), month: date.getMonth() }
      }
    }

    if (visibleDate) {
      const date = new Date(visibleDate)
      return { year: date.getFullYear(), month: date.getMonth() }
    }

    // Fallback to first bucket
    const firstBucket = buckets[0]
    if (firstBucket) {
      const date = new Date(firstBucket.timeBucket)
      return { year: date.getFullYear(), month: date.getMonth() }
    }

    return { year: new Date().getFullYear(), month: 0 }
  }, [buckets, visibleDate, isDragging, dragBucketIndex])

  // Find active year index
  const activeYearIndex = useMemo(() => {
    return yearGroups.findIndex((g) => g.year === currentPosition.year)
  }, [yearGroups, currentPosition.year])

  // Calculate the current bucket index from visible date for positioning
  const currentBucketIndex = useMemo(() => {
    if (isDragging) {
      return dragBucketIndex
    }
    if (!visibleDate || buckets.length === 0) {
      return 0
    }
    // Find the bucket that matches the visible date (buckets are sorted descending by date)
    const visibleDateStr = visibleDate.split('T')[0] ?? ''
    const index = buckets.findIndex((bucket) => {
      const bucketDateStr = bucket.timeBucket.split('T')[0] ?? ''
      return bucketDateStr <= visibleDateStr
    })
    return index === -1 ? buckets.length - 1 : index
  }, [buckets, visibleDate, isDragging, dragBucketIndex])

  // Calculate the relative position (0-1) for the collapsed indicator
  const relativePosition = useMemo(() => {
    if (buckets.length <= 1) {
      return 0
    }
    return currentBucketIndex / (buckets.length - 1)
  }, [currentBucketIndex, buckets.length])

  // Convert Y position to bucket index
  const yPositionToBucketIndex = useCallback(
    (y: number, containerHeight: number): number => {
      const progress = Math.max(0, Math.min(1, y / containerHeight))
      return Math.floor(progress * (buckets.length - 1))
    },
    [buckets.length],
  )

  // Handle drag
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      setIsDragging(true)
      expandScrubber()

      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top
      setDragY(y)
      const bucketIndex = yPositionToBucketIndex(y, rect.height)
      setDragBucketIndex(bucketIndex)
      onScrub(bucketIndex)
    },
    [expandScrubber, onScrub, yPositionToBucketIndex],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) {
        return
      }

      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top
      setDragY(y)
      const bucketIndex = yPositionToBucketIndex(y, rect.height)
      setDragBucketIndex(bucketIndex)
      onScrub(bucketIndex)
    },
    [isDragging, onScrub, yPositionToBucketIndex],
  )

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      onScrubEnd(dragBucketIndex)
      collapseScrubberDelayed()
    }
  }, [isDragging, onScrubEnd, dragBucketIndex, collapseScrubberDelayed])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
      return () => {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  if (buckets.length === 0) {
    return null
  }

  // Get the current month label for the collapsed state
  const activeGroup = yearGroups[activeYearIndex]
  const activeMonthData = activeGroup?.months.find((m) => m.month === currentPosition.month)
  const currentMonthLabel = activeMonthData?.label ?? ''

  return (
    <div
      ref={containerRef}
      class="timeline-scrubber"
      onPointerDown={handlePointerDown}
      style={{
        position: 'fixed',
        right: 0,
        // Start below the page header + first section header (48px)
        top: 'calc(var(--header-height) + 48px + env(safe-area-inset-top, 0px))',
        // End above search input + spacing
        bottom:
          'calc(var(--tabbar-height) + var(--search-input-height) + var(--spacing-md) * 2 + env(safe-area-inset-bottom, 0px))',
        width: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        zIndex: 10,
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Collapsed state: show only current period, positioned based on timeline position */}
      {!isExpanded && (
        <div
          class="scrubber-collapsed liquid-glass"
          style={{
            position: 'absolute',
            top: `${relativePosition * 100}%`,
            right: 0,
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            // Rounded left corners, sharp right edge
            borderRadius: '12px 0 0 12px',
            border: 'none',
            borderRight: 'none',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
            }}
          >
            {currentMonthLabel} {currentPosition.year}
          </div>
        </div>
      )}

      {/* Expanded state: show full year/month list positioned at finger */}
      {isExpanded && (
        <ScrubberList
          yearGroups={yearGroups}
          activeYearIndex={activeYearIndex}
          currentPosition={currentPosition}
          dragY={dragY}
        />
      )}
    </div>
  )
}
