import type { ComponentChildren } from 'preact'
import { useCallback, useState } from 'preact/hooks'
import { type SharedLink, type SharedLinkCreateParams, apiService } from '../../services/api'

interface AssetShareModalProps {
  assetIds: string[]
  onClose: () => void
}

type ExpirationOption = 'never' | '30min' | '1hour' | '6hours' | '1day' | '7days' | '30days'

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '30min', label: '30 minutes' },
  { value: '1hour', label: '1 hour' },
  { value: '6hours', label: '6 hours' },
  { value: '1day', label: '1 day' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
]

const getExpirationDate = (option: ExpirationOption): string | null => {
  if (option === 'never') {
    return null
  }
  const now = new Date()
  switch (option) {
    case '30min':
      return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    case '1hour':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    case '6hours':
      return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
    case '1day':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    case '7days':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30days':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

export const AssetShareModal = ({ assetIds, onClose }: AssetShareModalProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [createdLink, setCreatedLink] = useState<SharedLink | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Form state
  const [description, setDescription] = useState('')
  const [expiration, setExpiration] = useState<ExpirationOption>('never')
  const [showMetadata, setShowMetadata] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)

  const handleCreateLink = useCallback(async () => {
    setIsCreating(true)
    try {
      const params: SharedLinkCreateParams = {
        type: 'INDIVIDUAL',
        assetIds,
        description: description || null,
        expiresAt: getExpirationDate(expiration),
        showMetadata,
        allowDownload,
      }
      const link = await apiService.createSharedLink(params)
      setCreatedLink(link)
    } catch (error) {
      console.error('Failed to create shared link:', error)
    } finally {
      setIsCreating(false)
    }
  }, [assetIds, description, expiration, showMetadata, allowDownload])

  const handleCopyLink = useCallback(async () => {
    if (!createdLink) {
      return
    }
    try {
      const url = await apiService.getSharedLinkUrl(createdLink)
      await navigator.clipboard.writeText(url)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }, [createdLink])

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const inputStyle = {
    width: '100%',
    padding: 'var(--spacing-sm)',
    border: '1px solid var(--color-gray-light)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-md)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
  }

  const photoCount = assetIds.length
  const photoLabel = photoCount === 1 ? '1 photo' : `${photoCount} photos`

  return (
    <div
      class="share-modal-backdrop"
      role="button"
      tabIndex={0}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-index-modal)',
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        class="share-modal"
        style={{
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md)',
            borderBottom: '1px solid var(--color-gray-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <LinkIcon />
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {createdLink ? 'Link created' : `Share ${photoLabel}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--spacing-xs)',
              color: 'var(--color-gray)',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--spacing-md)' }}>
          {createdLink ? (
            <SuccessView onCopy={handleCopyLink} copySuccess={copySuccess} onClose={onClose} />
          ) : (
            <CreateForm
              description={description}
              setDescription={setDescription}
              expiration={expiration}
              setExpiration={setExpiration}
              showMetadata={showMetadata}
              setShowMetadata={setShowMetadata}
              allowDownload={allowDownload}
              setAllowDownload={setAllowDownload}
              onCancel={onClose}
              onCreate={handleCreateLink}
              isCreating={isCreating}
              inputStyle={inputStyle}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface SuccessViewProps {
  onCopy: () => void
  copySuccess: boolean
  onClose: () => void
}

const SuccessView = ({ onCopy, copySuccess, onClose }: SuccessViewProps) => (
  <div style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-success)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto var(--spacing-md)',
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 6L9 17L4 12"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <p style={{ color: 'var(--color-gray)', marginBottom: 'var(--spacing-lg)' }}>
      Your share link has been created. Copy it to share with others.
    </p>
    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
      <button
        onClick={onClose}
        style={{
          flex: 1,
          padding: 'var(--spacing-sm) var(--spacing-md)',
          border: '1px solid var(--color-gray-light)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'transparent',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-md)',
        }}
      >
        Done
      </button>
      <button
        onClick={onCopy}
        style={{
          flex: 1,
          padding: 'var(--spacing-sm) var(--spacing-md)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          cursor: 'pointer',
          fontSize: 'var(--font-size-md)',
        }}
      >
        {copySuccess ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  </div>
)

interface CreateFormProps {
  description: string
  setDescription: (value: string) => void
  expiration: ExpirationOption
  setExpiration: (value: ExpirationOption) => void
  showMetadata: boolean
  setShowMetadata: (value: boolean) => void
  allowDownload: boolean
  setAllowDownload: (value: boolean) => void
  onCancel: () => void
  onCreate: () => void
  isCreating: boolean
  inputStyle: Record<string, string>
}

const CreateForm = ({
  description,
  setDescription,
  expiration,
  setExpiration,
  showMetadata,
  setShowMetadata,
  allowDownload,
  setAllowDownload,
  onCancel,
  onCreate,
  isCreating,
  inputStyle,
}: CreateFormProps) => (
  <div>
    <p
      style={{
        color: 'var(--color-gray)',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      Create a link to share these photos with anyone.
    </p>

    <FormField label="Description (optional)">
      <input
        type="text"
        value={description}
        onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
        placeholder="Add a description"
        style={inputStyle}
      />
    </FormField>

    <FormField label="Link expires">
      <select
        value={expiration}
        onChange={(e) => setExpiration((e.target as HTMLSelectElement).value as ExpirationOption)}
        style={inputStyle}
      >
        {EXPIRATION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>

    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <input
          type="checkbox"
          checked={showMetadata}
          onChange={(e) => setShowMetadata((e.target as HTMLInputElement).checked)}
        />
        <span style={{ fontSize: 'var(--font-size-sm)' }}>Show metadata</span>
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={allowDownload}
          onChange={(e) => setAllowDownload((e.target as HTMLInputElement).checked)}
        />
        <span style={{ fontSize: 'var(--font-size-sm)' }}>Allow download</span>
      </label>
    </div>

    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
      <button
        onClick={onCancel}
        style={{
          flex: 1,
          padding: 'var(--spacing-sm) var(--spacing-md)',
          border: '1px solid var(--color-gray-light)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'transparent',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-md)',
        }}
      >
        Cancel
      </button>
      <button
        onClick={onCreate}
        disabled={isCreating}
        style={{
          flex: 1,
          padding: 'var(--spacing-sm) var(--spacing-md)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          opacity: isCreating ? 0.7 : 1,
          fontSize: 'var(--font-size-md)',
        }}
      >
        {isCreating ? 'Creating...' : 'Create Link'}
      </button>
    </div>
  </div>
)

interface FormFieldProps {
  label: string
  children: ComponentChildren
}

const FormField = ({ label, children }: FormFieldProps) => (
  <div style={{ marginBottom: 'var(--spacing-md)' }}>
    <label
      style={{
        display: 'block',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        marginBottom: 'var(--spacing-xs)',
        color: 'var(--color-text)',
      }}
    >
      {label}
    </label>
    {children}
  </div>
)
