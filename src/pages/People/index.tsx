import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../../components/common/Header';
import apiService, { Person } from '../../services/api';

export function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  // Fetch people
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await apiService.getPeople();
        setPeople(data.people || []);
      } catch (err) {
        console.error('Error fetching people:', err);
        setError('Failed to load people. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeople();
  }, []);

  // Navigate to person detail
  const handlePersonClick = (personId: string) => {
    location.route(`/people/${personId}`);
  };

  // Group people by first letter of name
  const peopleByLetter: Record<string, Person[]> = {};

  people.forEach(person => {
    if (person.isHidden) return; // Skip hidden people

    const firstLetter = person.name.charAt(0).toUpperCase();

    if (!peopleByLetter[firstLetter]) {
      peopleByLetter[firstLetter] = [];
    }

    peopleByLetter[firstLetter].push(person);
  });

  // Sort letters alphabetically
  const sortedLetters = Object.keys(peopleByLetter).sort();

  return (
    <div class="ios-page">
      <Header title="People" />

      <div class="ios-content">
        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)'
          }}>
            <div class="loading-spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--color-gray-light)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading people...</p>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-danger)',
            padding: 'var(--spacing-lg)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : people.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)',
            padding: 'var(--spacing-lg)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>No people found</p>
          </div>
        ) : (
          <div class="people-list" style={{ padding: 'var(--spacing-md)' }}>
            {sortedLetters.map(letter => (
              <div key={letter} class="people-letter-section">
                <h2 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--spacing-md)',
                  marginTop: 'var(--spacing-lg)'
                }}>
                  {letter}
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--spacing-md)'
                }}>
                  {peopleByLetter[letter].map(person => (
                    <div
                      key={person.id}
                      class="person-card"
                      onClick={() => handlePersonClick(person.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-gray-light)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {person.thumbnailPath && (
                          <img
                            src={apiService.getPersonThumbnailUrl(person.id)}
                            alt={person.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            loading="lazy"
                          />
                        )}
                      </div>

                      <h3 style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        textAlign: 'center',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {person.name}
                      </h3>

                      {person.isFavorite && (
                        <div style={{
                          color: 'var(--color-danger)',
                          marginTop: 'var(--spacing-xs)'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default People;
