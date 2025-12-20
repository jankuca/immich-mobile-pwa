import { useCallback, useState } from 'preact/hooks'
import { type SharedLink, type SharedLinkCreateParams, apiService } from '../../services/api'
import {
  EXPIRATION_OPTIONS,
  type ExpirationOption,
  FormField,
  ShareModalWrapper,
  ToggleRow,
  getExpirationDate,
  inputStyle,
} from './ShareModalComponents'

interface AssetShareModalProps {
  assetIds: string[]
  onClose: () => void
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

  const photoCount = assetIds.length
  const photoLabel = photoCount === 1 ? '1 photo' : `${photoCount} photos`
  const title = createdLink ? 'Link created' : `Share ${photoLabel}`

  return (
    <ShareModalWrapper title={title} onClose={onClose}>
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
        />
      )}
    </ShareModalWrapper>
  )
}

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

    <ToggleRow label="Show metadata" checked={showMetadata} onChange={setShowMetadata} />
    <ToggleRow label="Allow download" checked={allowDownload} onChange={setAllowDownload} />

    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
      <button
        type="button"
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
        type="button"
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
