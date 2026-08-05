import { useState } from 'react';
import './AddConcertModal.css';

export default function EventEditModal({ event, onSave, onClose }) {
  const [name, setName] = useState(event.name || '');
  const [date, setDate] = useState(event.date || '');
  const [venue, setVenue] = useState(event.venue || '');
  const [type, setType] = useState(event.type || 'gig');
  const [posterUrl, setPosterUrl] = useState(event.poster_url || '');
  const [posterInput, setPosterInput] = useState('');
  const [posterDownloading, setPosterDownloading] = useState(false);
  const [posterError, setPosterError] = useState(null);
  const [saving, setSaving] = useState(false);

  const downloadPoster = async () => {
    if (!posterInput.trim()) return;
    setPosterDownloading(true);
    setPosterError(null);
    try {
      const r = await fetch('/api/posters/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: posterInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Download failed');
      setPosterUrl(d.url);
      setPosterInput('');
    } catch (err) {
      setPosterError(err.message);
    } finally {
      setPosterDownloading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || null,
        date: date || null,
        venue: venue.trim() || null,
        type,
        poster_url: posterUrl || null,
      }),
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="acm" onClick={e => e.stopPropagation()}>
        <div className="acm__header">
          <h2>Edit Gig / Festival</h2>
          <button className="acm__close" onClick={onClose}>×</button>
        </div>

        <div className="acm__field">
          <label>Event name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Lagerstein @ The Metro"
            autoFocus
          />
        </div>

        <div className="acm__row">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Venue" />
        </div>

        <div className="acm__event-type">
          <label>
            <input type="radio" checked={type === 'gig'} onChange={() => setType('gig')} /> Gig
          </label>
          <label>
            <input type="radio" checked={type === 'festival'} onChange={() => setType('festival')} /> Festival
          </label>
        </div>

        <div className="acm__field">
          <label>Poster</label>
          <div className="acm__poster-search">
            {posterUrl && (
              <div className="acm__poster-preview">
                <img src={posterUrl} alt="Poster" />
                <div className="acm__poster-preview__actions">
                  <button type="button" onClick={() => setPosterUrl('')}>Remove</button>
                </div>
              </div>
            )}
            <div className="acm__row">
              <input
                value={posterInput}
                onChange={e => setPosterInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), downloadPoster())}
                placeholder="Paste image URL..."
              />
              <button type="button" onClick={downloadPoster} disabled={posterDownloading || !posterInput.trim()}>
                {posterDownloading ? 'Downloading...' : 'Use image'}
              </button>
            </div>
            {posterError && <div className="acm__hint acm__poster-error">{posterError}</div>}
          </div>
        </div>

        <div className="acm__actions">
          <button onClick={onClose}>Cancel</button>
          <button className="acm__save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
