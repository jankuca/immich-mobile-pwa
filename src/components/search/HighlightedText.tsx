import { getMatchIndices } from '../../utils/fuzzySearch'

interface HighlightedTextProps {
  text: string
  query: string
  class?: string
  style?: Record<string, string | number>
}

/**
 * Renders text with fuzzy-matched characters highlighted.
 */
export function HighlightedText({ text, query, class: className, style }: HighlightedTextProps) {
  if (!query.trim()) {
    return (
      <span class={className} style={style}>
        {text}
      </span>
    )
  }

  const matchIndices = new Set(getMatchIndices(query, text))

  if (matchIndices.size === 0) {
    return (
      <span class={className} style={style}>
        {text}
      </span>
    )
  }

  // Build segments of highlighted and non-highlighted text
  const segments: Array<{ text: string; highlighted: boolean }> = []
  let currentSegment = ''
  let currentHighlighted = matchIndices.has(0)

  for (let i = 0; i < text.length; i++) {
    const isHighlighted = matchIndices.has(i)

    if (isHighlighted !== currentHighlighted) {
      if (currentSegment) {
        segments.push({ text: currentSegment, highlighted: currentHighlighted })
      }
      currentSegment = text[i]
      currentHighlighted = isHighlighted
    } else {
      currentSegment += text[i]
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, highlighted: currentHighlighted })
  }

  return (
    <span class={className} style={style}>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  )
}

