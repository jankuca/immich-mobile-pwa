import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  type Album,
  type SharedLink,
  type SharedLinkCreateParams,
  apiService,
} from '../../services/api'
import {
  EXPIRATION_OPTIONS,
  type ExpirationOption,
  FormField,
  ShareModalWrapper,
  ToggleRow,
  getExpirationDate,
  inputStyle,
} from './ShareModalComponents'

interface ShareModalProps {
  album: Album
  onClose: () => void
}

export const ShareModal = ({ album, onClose }: ShareModalProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [existingLinks, setExistingLinks] = useState<SharedLink[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  // Form state for creating new link
  const [customUrl, setCustomUrl] = useState('')
  const [password, setPassword] = useState('')
  const [description, setDescription] = useState('')
  const [expiration, setExpiration] = useState<ExpirationOption>('never')
  const [showMetadata, setShowMetadata] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)
  const [allowUpload, setAllowUpload] = useState(false)

  const loadLinks = useCallback(async () => {
    setIsLoading(true)
    try {
      const links = await apiService.getSharedLinks(album.id)
      setExistingLinks(links)
    } catch (error) {
      console.error('Failed to load shared links:', error)
    } finally {
      setIsLoading(false)
    }
  }, [album.id])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  const handleCreateLink = async () => {
    setIsCreating(true)
    try {
      const params: SharedLinkCreateParams = {
        type: 'ALBUM',
        albumId: album.id,
        description: description || null,
        expiresAt: getExpirationDate(expiration),
        password: password || null,
        slug: customUrl || null,
        showMetadata,
        allowDownload,
        allowUpload,
      }
      await apiService.createSharedLink(params)
      await loadLinks()
      setShowCreateForm(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create shared link:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    try {
      await apiService.deleteSharedLink(linkId)
      await loadLinks()
    } catch (error) {
      console.error('Failed to delete shared link:', error)
    }
  }

  const handleCopyLink = async (link: SharedLink) => {
    try {
      const url = await apiService.getSharedLinkUrl(link)
      await navigator.clipboard.writeText(url)
      setCopySuccess(link.id)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const resetForm = () => {
    setCustomUrl('')
    setPassword('')
    setDescription('')
    setExpiration('never')
    setShowMetadata(true)
    setAllowDownload(true)
    setAllowUpload(false)
  }

  const title = showCreateForm ? 'Create link to share' : 'Share album'

  return (
    <ShareModalWrapper title={title} onClose={onClose}>
      {isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            color: 'var(--color-gray)',
          }}
        >
          Loading...
        </div>
      )}
      {!isLoading && showCreateForm && (
        <CreateLinkForm
          customUrl={customUrl}
          setCustomUrl={setCustomUrl}
          password={password}
          setPassword={setPassword}
          description={description}
          setDescription={setDescription}
          expiration={expiration}
          setExpiration={setExpiration}
          showMetadata={showMetadata}
          setShowMetadata={setShowMetadata}
          allowDownload={allowDownload}
          setAllowDownload={setAllowDownload}
          allowUpload={allowUpload}
          setAllowUpload={setAllowUpload}
          onCancel={() => {
            setShowCreateForm(false)
            resetForm()
          }}
          onCreate={handleCreateLink}
          isCreating={isCreating}
        />
      )}
      {!isLoading && !showCreateForm && (
        <LinksList
          links={existingLinks}
          onCopy={handleCopyLink}
          onDelete={handleDeleteLink}
          onCreateNew={() => setShowCreateForm(true)}
          copySuccess={copySuccess}
        />
      )}
    </ShareModalWrapper>
  )
}

// Sub-components
interface LinksListProps {
  links: SharedLink[]
  onCopy: (link: SharedLink) => void
  onDelete: (linkId: string) => void
  onCreateNew: () => void
  copySuccess: string | null
}

const LinksList = ({ links, onCopy, onDelete, onCreateNew, copySuccess }: LinksListProps) => (
  <div>
    {links.length === 0 ? (
      <div
        style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-gray)' }}
      >
        <p style={{ marginBottom: 'var(--spacing-md)' }}>No shared links yet</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>
          Create a link to share this album with anyone.
        </p>
      </div>
    ) : (
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        {links.map((link) => (
          <div
            key={link.id}
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-light)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  {link.slug || `${link.key.slice(0, 12)}...`}
                </div>
                {link.expiresAt && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray)' }}>
                    Expires: {new Date(link.expiresAt).toLocaleDateString()}
                  </div>
                )}
                {link.description && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-gray)',
                      marginTop: '2px',
                    }}
                  >
                    {link.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <button
                  onClick={() => onCopy(link)}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor:
                      copySuccess === link.id ? 'var(--color-success)' : 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  {copySuccess === link.id ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => onDelete(link.id)}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
    <button
      onClick={onCreateNew}
      style={{
        width: '100%',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-primary)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontWeight: 'var(--font-weight-medium)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-md)',
      }}
    >
      Create new link
    </button>
  </div>
)

interface CreateLinkFormProps {
  customUrl: string
  setCustomUrl: (value: string) => void
  password: string
  setPassword: (value: string) => void
  description: string
  setDescription: (value: string) => void
  expiration: ExpirationOption
  setExpiration: (value: ExpirationOption) => void
  showMetadata: boolean
  setShowMetadata: (value: boolean) => void
  allowDownload: boolean
  setAllowDownload: (value: boolean) => void
  allowUpload: boolean
  setAllowUpload: (value: boolean) => void
  onCancel: () => void
  onCreate: () => void
  isCreating: boolean
}

const CreateLinkForm = ({
  customUrl,
  setCustomUrl,
  password,
  setPassword,
  description,
  setDescription,
  expiration,
  setExpiration,
  showMetadata,
  setShowMetadata,
  allowDownload,
  setAllowDownload,
  allowUpload,
  setAllowUpload,
  onCancel,
  onCreate,
  isCreating,
}: CreateLinkFormProps) => (
  <div>
    <p
      style={{
        color: 'var(--color-gray)',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      Let anyone with the link see photos and people in this album.
    </p>

    <FormField label="Custom URL" hint="Access this shared link with a custom URL">
      <input
        type="text"
        value={customUrl}
        onInput={(e) => setCustomUrl((e.target as HTMLInputElement).value)}
        placeholder="my-custom-url"
        style={inputStyle}
      />
    </FormField>

    <FormField label="Password" hint="Require a password to access this shared link">
      <input
        type="password"
        value={password}
        onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        style={inputStyle}
      />
    </FormField>

    <FormField label="Description">
      <input
        type="text"
        value={description}
        onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
        style={inputStyle}
      />
    </FormField>

    <FormField label="Expire after">
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
    <ToggleRow
      label="Allow public user to download"
      checked={allowDownload}
      onChange={setAllowDownload}
    />
    <ToggleRow
      label="Allow public user to upload"
      checked={allowUpload}
      onChange={setAllowUpload}
    />

    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)' }}>
      <button onClick={onCancel} disabled={isCreating} style={cancelButtonStyle}>
        Cancel
      </button>
      <button onClick={onCreate} disabled={isCreating} style={createButtonStyle}>
        {isCreating ? 'Creating...' : 'Create link'}
      </button>
    </div>
  </div>
)

// Styles
const cancelButtonStyle: import('preact').JSX.CSSProperties = {
  flex: 1,
  padding: 'var(--spacing-md)',
  backgroundColor: 'var(--color-gray-light)',
  color: 'var(--color-text)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
}

const createButtonStyle: import('preact').JSX.CSSProperties = {
  flex: 1,
  padding: 'var(--spacing-md)',
  backgroundColor: 'var(--color-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
}
