import { SectionPill } from '../common/SectionPill'

const HEADER_HEIGHT = 48

interface TimelineStickyHeaderProps {
  date: string
  isPlaceholder?: boolean | undefined
}

/**
 * Parse a YYYY-MM-DD date string as local time (not UTC).
 * This prevents timezone shifts when displaying dates.
 */
function parseDateAsLocal(dateStr: string): Date {
  const datePart = dateStr.split('T')[0] ?? dateStr
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0)
}

/**
 * Sticky header overlay for the timeline.
 * Rendered separately from the flow to avoid spacer instability.
 */
export function TimelineStickyHeader({ date, isPlaceholder }: TimelineStickyHeaderProps) {
  const headerDate = parseDateAsLocal(date)
  const formattedDate = isPlaceholder
    ? headerDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : headerDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: `${HEADER_HEIGHT}px`,
        marginBottom: `-${HEADER_HEIGHT}px`,
        pointerEvents: 'none',
      }}
    >
      <SectionPill sticky={true}>{formattedDate}</SectionPill>
    </div>
  )
}
