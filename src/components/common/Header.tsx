import type { ComponentChildren } from 'preact'

interface HeaderAction {
  icon: ComponentChildren
  onClick: () => void
}

interface HeaderProps {
  title: string
  showBackButton?: boolean
  leftAction?: HeaderAction | undefined
  rightAction?: HeaderAction | undefined
  /** Multiple right actions - displayed in order from right to left */
  rightActions?: HeaderAction[] | undefined
}

export const Header = ({
  title,
  showBackButton = false,
  leftAction,
  rightAction,
  rightActions,
}: HeaderProps) => {
  const handleBack = () => {
    window.history.back()
  }

  // Combine rightAction and rightActions for rendering
  const allRightActions: HeaderAction[] = []
  if (rightAction) {
    allRightActions.push(rightAction)
  }
  if (rightActions) {
    allRightActions.push(...rightActions)
  }

  return (
    <header class="ios-header">
      {showBackButton && !leftAction && (
        <button
          class="ios-header-back-button"
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: 'var(--font-size-md)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12 19L5 12L12 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span style={{ marginLeft: 'var(--spacing-xs)' }}>Back</span>
        </button>
      )}

      {leftAction && (
        <button
          class="ios-header-left-action"
          onClick={leftAction.onClick}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {leftAction.icon}
        </button>
      )}

      <h1
        class="ios-header-title"
        style={{
          flex: 1,
          textAlign: showBackButton || leftAction ? 'center' : 'left',
          marginLeft: showBackButton || leftAction ? 0 : 'var(--spacing-md)',
        }}
      >
        {title}
      </h1>

      {allRightActions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          {allRightActions.map((action, index) => (
            <button
              key={index}
              class="ios-header-action ios-header-right-action"
              onClick={action.onClick}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
