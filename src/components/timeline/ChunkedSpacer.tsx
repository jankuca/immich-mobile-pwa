/**
 * Maximum height per spacer chunk to stay within browser limits.
 * Browsers typically fail at 10-33 million pixels for single elements,
 * so we use 500k per chunk to be safe.
 */
const MAX_CHUNK_HEIGHT = 500_000

interface ChunkedSpacerProps {
  height: number
}

/**
 * Renders a spacer as multiple smaller divs to avoid browser height limits.
 * When a single element's height exceeds browser limits (typically 10-33M pixels),
 * scrolling behavior becomes undefined. By chunking the spacer into smaller
 * elements, we can support arbitrarily large virtual heights.
 */
export function ChunkedSpacer({ height }: ChunkedSpacerProps) {
  if (height <= 0) {
    return null
  }

  // If height is within limits, render a single div
  if (height <= MAX_CHUNK_HEIGHT) {
    return <div style={{ height: `${height}px` }} />
  }

  // Otherwise, render multiple chunks
  const chunks: number[] = []
  let remaining = height

  while (remaining > 0) {
    const chunkHeight = Math.min(remaining, MAX_CHUNK_HEIGHT)
    chunks.push(chunkHeight)
    remaining -= chunkHeight
  }

  return (
    <>
      {chunks.map((chunkHeight, index) => (
        <div key={index} style={{ height: `${chunkHeight}px` }} />
      ))}
    </>
  )
}

