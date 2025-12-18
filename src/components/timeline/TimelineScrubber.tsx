import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

export interface TimeBucket {
  timeBucket: string
  count: number
}

interface YearMonth {
  year: number
  month: number
  label: string
  bucketIndex: number // Index into the original buckets array
}

interface YearGroup {
  year: number
  months: YearMonth[]
  totalCount: number
}

interface TimelineScrubberProps {
  buckets: TimeBucket[]
  /** Current scroll progress from 0 to 1 */
  scrollProgress: number
  /** Called when user drags to a new position (0-1 progress) */
  onScrub: (progress: number) => void
  /** Called when user starts dragging */
  onScrubStart?: () => void
  /** Called when user stops dragging */
  onScrubEnd?: () => void
}

export function TimelineScrubber({
  buckets,
  scrollProgress,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: TimelineScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)

  // Group buckets by year and month
  const yearGroups = useMemo(() => {
    const groups: Map<number, YearGroup> = new Map()

    buckets.forEach((bucket, index) => {
      const date = new Date(bucket.timeBucket)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (!groups.has(year)) {
        groups.set(year, { year, months: [], totalCount: 0 })
      }

      const group = groups.get(year)
      if (group) {
        group.totalCount += bucket.count
      }

      // Only add month if not already present
      if (group) {
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
    })

    // Sort years descending, months within years descending
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.year - a.year)
    for (const group of sortedGroups) {
      group.months.sort((a, b) => b.month - a.month)
    }

    return sortedGroups
  }, [buckets])

  // Calculate current position based on progress
  const currentPosition = useMemo(() => {
    const progress = isDragging ? dragProgress : scrollProgress
    if (buckets.length === 0) {
      return { year: new Date().getFullYear(), month: 0 }
    }

    const bucketIndex = Math.floor(progress * (buckets.length - 1))
    const bucket = buckets[Math.min(bucketIndex, buckets.length - 1)]
    if (!bucket) {
      return { year: new Date().getFullYear(), month: 0 }
    }

    const date = new Date(bucket.timeBucket)
    return { year: date.getFullYear(), month: date.getMonth() }
  }, [buckets, scrollProgress, isDragging, dragProgress])

  // Find active year index
  const activeYearIndex = useMemo(() => {
    return yearGroups.findIndex((g) => g.year === currentPosition.year)
  }, [yearGroups, currentPosition.year])

  // Handle drag
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      setIsDragging(true)
      onScrubStart?.()

      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top
      const progress = Math.max(0, Math.min(1, y / rect.height))
      setDragProgress(progress)
      onScrub(progress)
    },
    [onScrub, onScrubStart],
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
      const progress = Math.max(0, Math.min(1, y / rect.height))
      setDragProgress(progress)
      onScrub(progress)
    },
    [isDragging, onScrub],
  )

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      onScrubEnd?.()
    }
  }, [isDragging, onScrubEnd])

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
        position: 'absolute',
        right: 0,
        top: 'var(--timeline-header-offset)',
        bottom: 'var(--timeline-bottom-offset, var(--tabbar-height))',
        width: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        paddingRight: 'var(--spacing-sm)',
        zIndex: 10,
        touchAction: 'none',
        userSelect: 'none',
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
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: isActive
                    ? 'var(--font-weight-semibold)'
                    : 'var(--font-weight-regular)',
                  fontSize: 'var(--font-size-xs)',
                  color: isActive ? 'var(--color-text)' : 'var(--color-gray)',
                  background: isActive ? 'rgba(var(--color-text-rgb), 0.1)' : 'transparent',
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
                        padding: '1px 6px',
                        fontSize: '10px',
                        color: isActiveMonth ? 'var(--color-text)' : 'var(--color-gray)',
                        fontWeight: isActiveMonth
                          ? 'var(--font-weight-medium)'
                          : 'var(--font-weight-regular)',
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
