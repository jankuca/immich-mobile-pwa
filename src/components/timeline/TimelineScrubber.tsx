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

export function TimelineScrubber({
  buckets,
  visibleDate,
  onScrub,
  onScrubEnd,
}: TimelineScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragBucketIndex, setDragBucketIndex] = useState(0)

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

      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top
      const bucketIndex = yPositionToBucketIndex(y, rect.height)
      setDragBucketIndex(bucketIndex)
      onScrub(bucketIndex)
    },
    [onScrub, yPositionToBucketIndex],
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
    }
  }, [isDragging, onScrubEnd, dragBucketIndex])

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

  return (
    <div
      ref={containerRef}
      class="timeline-scrubber"
      onPointerDown={handlePointerDown}
      style={{
        position: 'fixed',
        right: 0,
        top: 'calc(var(--header-height) + env(safe-area-inset-top, 0px))',
        bottom: 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))',
        width: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingRight: 'var(--spacing-sm)',
        paddingTop: 'var(--spacing-sm)',
        zIndex: 10,
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Year/Month list */}
      <div
        class="scrubber-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-gray)',
        }}
      >
        {yearGroups.map((group, groupIndex) => {
          const isActive = groupIndex === activeYearIndex
          return (
            <div
              key={group.year}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
            >
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: isActive
                    ? 'var(--font-weight-semibold)'
                    : 'var(--font-weight-regular)',
                  fontSize: '11px',
                  color: isActive ? 'var(--color-text)' : 'var(--color-gray)',
                  background: isActive ? 'rgba(var(--color-text-rgb), 0.08)' : 'transparent',
                }}
              >
                {group.year}
              </div>
              {isActive &&
                group.months.map((month) => {
                  const isActiveMonth = month.month === currentPosition.month
                  return (
                    <div
                      key={month.month}
                      style={{
                        padding: '1px 8px',
                        borderRadius: '8px',
                        fontSize: '10px',
                        color: isActiveMonth ? 'var(--color-text)' : 'var(--color-gray)',
                        fontWeight: isActiveMonth
                          ? 'var(--font-weight-medium)'
                          : 'var(--font-weight-regular)',
                        background: isActiveMonth
                          ? 'rgba(var(--color-primary-rgb), 0.15)'
                          : 'transparent',
                      }}
                    >
                      {month.label}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
