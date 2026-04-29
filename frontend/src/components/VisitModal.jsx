import { useState } from 'react';
import './VisitModal.css';

export default function VisitModal({ country, state, displayName, onSave, onClose }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country, state: state || null, year }),
    });
    setSaving(false);
    if (!res.ok) { setError('Failed to save'); return; }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <p className="modal-location">{displayName}</p>
        <form onSubmit={handleSubmit}>
          <label className="modal-label">Year visited</label>
          <input
            className="modal-year"
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            autoFocus
            required
          />
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
