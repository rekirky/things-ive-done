import { useState, useEffect, useRef } from 'react';
import './AddConcertModal.css';

const PRESET_ATTENDEES = ['Jon', 'Mel', 'Adam', 'Tegan'];

export default function AddConcertModal({ onSave, onClose, concert, knownAttendees = PRESET_ATTENDEES }) {
  const isEdit = Boolean(concert);
  const [bandQuery, setBandQuery] = useState(concert?.band_name || '');
  const [spotifyResult, setSpotifyResult] = useState(
    concert?.spotify_id ? { id: concert.spotify_id, name: concert.band_name, image_url: concert.spotify_image, genres: concert.spotify_genres } : null
  );
  const [searching, setSearching] = useState(false);
  const [spotifySkipped, setSpotifySkipped] = useState(false);
  const [year, setYear] = useState(concert?.year || new Date().getFullYear());
  const [location, setLocation] = useState(concert?.location || '');
  const [attendees, setAttendees] = useState(concert?.attendees || []);
  const [customAttendee, setCustomAttendee] = useState('');
  const [extraAttendees, setExtraAttendees] = useState([]);
  const [notes, setNotes] = useState(concert?.notes || '');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!bandQuery.trim() || spotifySkipped) { setSpotifyResult(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/spotify/artist?name=${encodeURIComponent(bandQuery)}`);
        const d = await r.json();
        setSpotifyResult(r.ok ? d : null);
      } catch {
        setSpotifyResult(null);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [bandQuery, spotifySkipped]);

  const toggleAttendee = (person) =>
    setAttendees(prev => prev.includes(person) ? prev.filter(p => p !== person) : [...prev, person]);

  const addCustomAttendee = () => {
    const name = customAttendee.trim();
    if (!name) return;
    if (!allAttendees.includes(name))
      setExtraAttendees(prev => [...prev, name]);
    if (!attendees.includes(name)) setAttendees(prev => [...prev, name]);
    setCustomAttendee('');
  };

  const handleSave = async () => {
    if (!bandQuery.trim() || !year) return;
    setSaving(true);
    const payload = {
      band_name: spotifyResult?.name || bandQuery.trim(),
      spotify_id: spotifyResult?.id || null,
      spotify_image: spotifyResult?.image_url || null,
      spotify_genres: spotifyResult?.genres || [],
      year: parseInt(year),
      location: location.trim() || null,
      attendees,
      notes: notes.trim() || null,
    };
    await fetch(isEdit ? `/api/concerts/${concert.id}` : '/api/concerts', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    onSave();
  };

  const allAttendees = [...new Set([...knownAttendees, ...extraAttendees])];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="acm" onClick={e => e.stopPropagation()}>
        <div className="acm__header">
          <h2>{isEdit ? 'Edit Concert' : 'Add Concert'}</h2>
          <button className="acm__close" onClick={onClose}>×</button>
        </div>

        <div className="acm__field">
          <label>Band</label>
          <input
            value={bandQuery}
            onChange={e => setBandQuery(e.target.value)}
            placeholder="Search Spotify..."
            autoFocus
          />
          {searching && <div className="acm__hint">Searching...</div>}
          {spotifyResult && !spotifySkipped && (
            <div className="acm__spotify-match">
              {spotifyResult.image_url && <img src={spotifyResult.image_url} alt={spotifyResult.name} />}
              <div className="acm__spotify-match__info">
                <strong>{spotifyResult.name}</strong>
                {spotifyResult.genres?.length > 0 && (
                  <div className="acm__spotify-genres">{spotifyResult.genres.slice(0, 3).join(', ')}</div>
                )}
              </div>
              <button
                type="button"
                className="acm__spotify-skip"
                onClick={() => { setSpotifySkipped(true); setSpotifyResult(null); }}
                title="Don't link Spotify"
              >✕ Skip</button>
            </div>
          )}
          {spotifySkipped && (
            <div className="acm__hint">
              No Spotify link.{' '}
              <button type="button" className="acm__spotify-undo" onClick={() => setSpotifySkipped(false)}>
                undo
              </button>
            </div>
          )}
        </div>

        <div className="acm__row">
          <div className="acm__field acm__field--year">
            <label>Year</label>
            <input type="number" value={year} onChange={e => setYear(e.target.value)} min="1900" max="2099" />
          </div>
          <div className="acm__field">
            <label>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue, City" />
          </div>
        </div>

        <div className="acm__field">
          <label>Who Was There</label>
          <div className="acm__attendees">
            {allAttendees.map(person => (
              <button
                key={person}
                type="button"
                className={`attendee-tag ${attendees.includes(person) ? 'active' : ''}`}
                onClick={() => toggleAttendee(person)}
              >
                {person}
              </button>
            ))}
            <div className="acm__custom">
              <input
                value={customAttendee}
                onChange={e => setCustomAttendee(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomAttendee()}
                placeholder="Add person..."
              />
              <button type="button" onClick={addCustomAttendee}>+</button>
            </div>
          </div>
        </div>

        <div className="acm__field">
          <label>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Opening acts, memories..." />
        </div>

        <div className="acm__actions">
          <button onClick={onClose}>Cancel</button>
          <button className="acm__save" onClick={handleSave} disabled={saving || !bandQuery.trim()}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
