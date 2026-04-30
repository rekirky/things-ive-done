import { useState, useEffect, useMemo } from 'react';
import AddConcertModal from './AddConcertModal.jsx';
import './BandsSeen.css';

const PRESET_ATTENDEES = ['Jon', 'Mel', 'Adam', 'Tegan'];

export default function BandsSeen() {
  const [concerts, setConcerts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editConcert, setEditConcert] = useState(null);
  const [filterAttendees, setFilterAttendees] = useState([]);
  const [sortBy, setSortBy] = useState('year-desc');

  const fetchConcerts = () =>
    fetch('/api/concerts').then(r => r.json()).then(setConcerts);

  useEffect(() => { fetchConcerts(); }, []);

  const toggleFilter = (person) =>
    setFilterAttendees(prev =>
      prev.includes(person) ? prev.filter(p => p !== person) : [...prev, person]
    );

  const allAttendees = useMemo(() => {
    const fromData = concerts.flatMap(c => c.attendees || []);
    return [...new Set([...PRESET_ATTENDEES, ...fromData])];
  }, [concerts]);

  const filtered = useMemo(() => {
    let list = [...concerts];
    if (filterAttendees.length > 0)
      list = list.filter(c => filterAttendees.every(p => (c.attendees || []).includes(p)));
    if (sortBy === 'year-desc') list.sort((a, b) => b.year - a.year);
    else if (sortBy === 'year-asc') list.sort((a, b) => a.year - b.year);
    else if (sortBy === 'band-asc') list.sort((a, b) => a.band_name.localeCompare(b.band_name));
    return list;
  }, [concerts, filterAttendees, sortBy]);

  return (
    <div className="bands-seen">
      <div className="bands-seen__toolbar">
        <div className="bands-seen__filters">
          {allAttendees.map(person => (
            <button
              key={person}
              className={`attendee-tag ${filterAttendees.includes(person) ? 'active' : ''}`}
              onClick={() => toggleFilter(person)}
            >
              {person}
            </button>
          ))}
          {filterAttendees.length > 0 && (
            <button className="clear-filter" onClick={() => setFilterAttendees([])}>clear</button>
          )}
        </div>
        <div className="bands-seen__controls">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="year-desc">Newest first</option>
            <option value="year-asc">Oldest first</option>
            <option value="band-asc">Band A–Z</option>
          </select>
          <button className="add-concert-btn" onClick={() => setShowAdd(true)}>+ Add Concert</button>
        </div>
      </div>

      <div className="bands-seen__count">
        {filtered.length} concert{filtered.length !== 1 ? 's' : ''}
        {filterAttendees.length > 0 && ` with ${filterAttendees.join(' & ')}`}
      </div>

      <div className="concerts-grid">
        {filtered.map(concert => (
          <ConcertCard key={concert.id} concert={concert} onDelete={fetchConcerts} onEdit={setEditConcert} />
        ))}
        {filtered.length === 0 && (
          <div className="concerts-empty">No concerts yet. Add one!</div>
        )}
      </div>

      {showAdd && (
        <AddConcertModal
          onSave={() => { setShowAdd(false); fetchConcerts(); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editConcert && (
        <AddConcertModal
          concert={editConcert}
          onSave={() => { setEditConcert(null); fetchConcerts(); }}
          onClose={() => setEditConcert(null)}
        />
      )}
    </div>
  );
}

function ConcertCard({ concert, onDelete, onEdit }) {
  const handleDelete = async () => {
    if (!confirm(`Remove ${concert.band_name}?`)) return;
    await fetch(`/api/concerts/${concert.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <div className="concert-card">
      {concert.spotify_image && (
        <div className="concert-card__img-wrap">
          <img src={concert.spotify_image} alt={concert.band_name} className="concert-card__img" />
        </div>
      )}
      <div className="concert-card__body">
        <div className="concert-card__top">
          <h3 className="concert-card__name">
            {concert.spotify_id ? (
              <a
                href={`https://open.spotify.com/artist/${concert.spotify_id}`}
                target="_blank"
                rel="noreferrer"
              >
                {concert.band_name}
              </a>
            ) : concert.band_name}
          </h3>
          <div className="concert-card__actions">
            <button className="concert-card__edit" onClick={() => onEdit(concert)} title="Edit">✎</button>
            <button className="concert-card__del" onClick={handleDelete} title="Remove">×</button>
          </div>
        </div>

        <div className="concert-card__meta">
          <span className="concert-card__year">{concert.year}</span>
          {concert.location && <span className="concert-card__loc">{concert.location}</span>}
        </div>

        {concert.spotify_genres?.length > 0 && (
          <div className="concert-card__genres">
            {concert.spotify_genres.slice(0, 3).map(g => (
              <span key={g} className="genre-tag">{g}</span>
            ))}
          </div>
        )}

        {concert.attendees?.length > 0 && (
          <div className="concert-card__attendees">
            {concert.attendees.map(p => (
              <span key={p} className="attendee-tag small">{p}</span>
            ))}
          </div>
        )}

        {concert.notes && <p className="concert-card__notes">{concert.notes}</p>}
      </div>
    </div>
  );
}
