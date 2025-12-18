/**
 * Loading spinner indicator for the timeline.
 */
export function TimelineLoadingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 'var(--spacing-md)',
        color: 'var(--color-gray)',
      }}
    >
      <div
        class="loading-spinner"
        style={{
          width: '24px',
          height: '24px',
          border: '3px solid var(--color-gray-light)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
    </div>
  )
}

