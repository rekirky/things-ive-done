import { useState } from 'react';
import './BandSearch.css';

export default function BandSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/spotify/artist?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="band-search">
      <h2>Band Search</h2>
      <form onSubmit={search} className="band-search__form">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a band or artist..."
          className="band-search__input"
        />
        <button type="submit" disabled={loading} className="band-search__btn">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="band-search__error">{error}</p>}

      {result && (
        <div className="band-search__result">
          {result.image_url && (
            <img
              src={result.image_url}
              alt={result.name}
              className="band-search__image"
              width={result.image_width || 64}
              height={result.image_height || 64}
            />
          )}
          <div className="band-search__info">
            <h3>{result.name}</h3>
            {result.genres?.length > 0 && (
              <p className="band-search__genres">{result.genres.join(', ')}</p>
            )}
            <p className="band-search__meta">Spotify ID: {result.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}
