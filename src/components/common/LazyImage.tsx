import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

interface LazyImageProps {
  src: string
  alt: string
  style?: JSX.CSSProperties
  class?: string
  /** Root margin for the IntersectionObserver (default: '100px') */
  rootMargin?: string
  /** Threshold for the IntersectionObserver (default: 0) */
  threshold?: number
}

/**
 * A lazy-loading image component that uses IntersectionObserver
 * to only load the image when it becomes visible in the viewport.
 *
 * This is more reliable than the native `loading="lazy"` attribute,
 * especially for scrollable containers that aren't the main viewport.
 */
export function LazyImage({
  src,
  alt,
  style,
  class: className,
  rootMargin = '100px',
  threshold = 0,
}: LazyImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    // If already visible, don't re-observe
    if (isVisible) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        }
      },
      {
        rootMargin,
        threshold,
      },
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [isVisible, rootMargin, threshold])

  return (
    <div ref={containerRef} style={style} class={className}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  )
}
