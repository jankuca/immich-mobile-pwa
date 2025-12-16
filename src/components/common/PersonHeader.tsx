import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { Person } from '../../services/api'
import { apiService } from '../../services/api'
import './PersonHeader.css'
import { SectionPill } from './SectionPill'

interface PersonHeaderProps {
  person: Person | null
  assetCount?: number
  leftAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
  rightAction?: {
    icon: ComponentChildren
    onClick: () => void
  }
}

export const PersonHeader = ({
  person,
  assetCount,
  leftAction,
  rightAction,
}: PersonHeaderProps) => {
  const headerRef = useRef<HTMLElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)

  useEffect(() => {
    const header = headerRef.current
    if (!header) {
      return
    }

    const updateHeight = () => {
      const height = header.offsetHeight
      setHeaderHeight(height)
      // Set the CSS variable on the parent .ios-page element
      const page = header.closest('.ios-page') as HTMLElement | null
      if (page) {
        page.style.setProperty('--measured-header-height', `${height}px`)
      }
    }

    // Initial measurement
    updateHeight()

    // Re-measure on resize
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(header)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Scroll-based animation via JS
  useEffect(() => {
    const header = headerRef.current
    if (!header) {
      return
    }

    const page = header.closest('.ios-page') as HTMLElement | null
    if (!page) {
      return
    }

    let scrollContainer: HTMLElement | null = null
    let cleanupScroll: (() => void) | null = null

    const handleScroll = () => {
      if (!scrollContainer) {
        return
      }
      const scrollTop = scrollContainer.scrollTop
      // Animation completes over 80px of scroll
      const progress = Math.min(1, Math.max(0, scrollTop / 80))
      setScrollProgress(progress)
    }

    const attachScrollListener = (container: HTMLElement) => {
      scrollContainer = container
      container.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll() // Initial check
      cleanupScroll = () => container.removeEventListener('scroll', handleScroll)
    }

    // Try to find scroll container immediately
    const existingContainer = page.querySelector(
      '.virtualized-timeline-scroll',
    ) as HTMLElement | null
    if (existingContainer) {
      attachScrollListener(existingContainer)
    }

    // Watch for scroll container to appear (it may render after the header)
    const observer = new MutationObserver(() => {
      if (scrollContainer) {
        return // Already attached
      }
      const container = page.querySelector('.virtualized-timeline-scroll') as HTMLElement | null
      if (container) {
        attachScrollListener(container)
      }
    })

    observer.observe(page, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      cleanupScroll?.()
    }
  }, [])

  // Calculate animated values
  const avatarScale = 1 - scrollProgress * 0.4 // 1 -> 0.6
  const fadeOutOpacity = 1 - Math.min(1, scrollProgress / 0.75) // Fade faster
  const fadeInOpacity = Math.max(0, (scrollProgress - 0.5) / 0.5) // Start at 50%, complete at 100%
  // Height transitions from full header height to collapsed state
  // Collapsed height = scaled avatar (38px) + padding (~24px) + safe area = 62px + safe area
  // Use CSS calc so safe area is included dynamically
  const expandedPortion = headerHeight * (1 - scrollProgress)
  const bgHeight =
    headerHeight > 0
      ? `calc(${expandedPortion}px + ${scrollProgress} * (62px + env(safe-area-inset-top, 0px)))`
      : '100%'

  return (
    <header ref={headerRef} class="ios-header person-header">
      {/* Dark background section that shrinks on scroll */}
      <div class="person-header-collapser" style={{ height: bgHeight }}>
        <div class="person-header-bg" style={{ height: '100%' }} />

        {/* Name pill - fades in on scroll, positioned below dark section */}
        <div class="person-header-pill" style={{ opacity: fadeInOpacity }}>
          <SectionPill sticky={true}>{person?.name ?? ''}</SectionPill>
        </div>
      </div>

      {/* Left action - stays in place */}
      {leftAction && (
        <button class="person-header-left-action" onClick={leftAction.onClick} type="button">
          {leftAction.icon}
        </button>
      )}

      {/* Main content area */}
      <div class="person-header-content">
        {/* Person thumbnail - shrinks on scroll */}
        <div
          class="person-header-avatar"
          style={{ transform: `scale(${avatarScale}) translateY(-${scrollProgress * 30}px)` }}
        >
          {person?.thumbnailPath && (
            <img
              src={apiService.getPersonThumbnailUrl(person.id)}
              alt={person.name}
              class="person-header-avatar-img"
            />
          )}
        </div>

        {/* Name and count - fade out on scroll */}
        <h1 class="person-header-title" style={{ opacity: fadeOutOpacity }}>
          {person ? person.name : 'Loading…'}
        </h1>

        {assetCount !== undefined && assetCount > 0 && (
          <p class="person-header-count" style={{ opacity: fadeOutOpacity }}>
            {assetCount} {assetCount === 1 ? 'photo' : 'photos'}
          </p>
        )}
      </div>

      {/* Right action - stays in place */}
      {rightAction && (
        <button class="person-header-right-action" onClick={rightAction.onClick} type="button">
          {rightAction.icon}
        </button>
      )}
    </header>
  )
}
