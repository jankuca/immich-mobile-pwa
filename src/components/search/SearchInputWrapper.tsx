import type { ComponentChildren } from 'preact'
import { createPortal } from 'preact/compat'
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight'

interface SearchInputWrapperProps {
  children: ComponentChildren
}

/**
 * A wrapper component that positions its children (typically a SearchInput)
 * at the bottom of the screen, above the tab bar, and adjusts for the
 * on-screen keyboard when it appears.
 *
 * Uses a portal to render at the document body level, which prevents iOS
 * from scrolling the page content when focusing the input.
 */
export function SearchInputWrapper({ children }: SearchInputWrapperProps) {
  const keyboardHeight = useKeyboardHeight()

  // Base offset using CSS variables (tab bar + safe area)
  const baseOffset = 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))'

  // Use CSS max() to ensure we never go below the base offset
  // When keyboard is visible, position above it with some spacing
  const bottomOffset = `max(${keyboardHeight}px + var(--spacing-md), ${baseOffset})`

  const content = (
    <div
      class="ios-search-wrapper"
      style={{
        bottom: bottomOffset,
      }}
    >
      {children}
    </div>
  )

  // Render via portal to document.body to prevent iOS from scrolling
  // the page content when the input is focused
  return createPortal(content, document.body)
}
