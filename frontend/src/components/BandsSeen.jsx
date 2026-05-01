import { useState, useEffect, useMemo } from 'react';
import AddConcertModal from './AddConcertModal.jsx';
import './BandsSeen.css';

const PRESET_ATTENDEES = ['Jon', 'Mel', 'Adam', 'Tegan'];

function getMedal(count) {
  if (count >= 4) return 'gold';
  if (count === 3) return 'silver';
  if (count === 2) return 'bronze';
  return null;
}

const MEDAL_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' };

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

  // Group concerts by band (spotify_id preferred, fallback to lowercased name)
  const groups = useMemo(() => {
    const map = new Map();
    concerts.forEach(c => {
      const key = c.spotify_id || c.band_name.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return Array.from(map.values()).map(cs => {
      const sorted = [...cs].sort((a, b) => b.year - a.year);
      return { latest: sorted[0], all: sorted, count: sorted.length };
    });
  }, [concerts]);

  const filteredGroups = useMemo(() => {
    let list = [...groups];
    if (filterAttendees.length > 0) {
      list = list.filter(g =>
        g.all.some(c => filterAttendees.every(p => (c.attendees || []).includes(p)))
      );
    }
    if (sortBy === 'year-desc') list.sort((a, b) => b.latest.year - a.latest.year);
    else if (sortBy === 'year-asc') list.sort((a, b) => a.all[a.all.length - 1].year - b.all[b.all.length - 1].year);
    else if (sortBy === 'band-asc') list.sort((a, b) => a.latest.band_name.localeCompare(b.latest.band_name));
    else if (sortBy === 'most-seen') list.sort((a, b) => b.count - a.count || b.latest.year - a.latest.year);
    return list;
  }, [groups, filterAttendees, sortBy]);

  const totalConcerts = filteredGroups.reduce((n, g) => n + g.count, 0);

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
            <option value="most-seen">Most seen</option>
          </select>
          <button className="add-concert-btn" onClick={() => setShowAdd(true)}>+ Add Concert</button>
        </div>
      </div>

      <div className="bands-seen__count">
        {filteredGroups.length} band{filteredGroups.length !== 1 ? 's' : ''}
        {' · '}
        {totalConcerts} concert{totalConcerts !== 1 ? 's' : ''}
        {filterAttendees.length > 0 && ` with ${filterAttendees.join(' & ')}`}
      </div>

      <div className="concerts-grid">
        {filtered.map(concert => (
          <ConcertCard key={concert.id} concert={concert} onDelete={fetchConcerts} />
        ))}
        {filteredGroups.length === 0 && (
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

function ConcertCard({ concert, onDelete }) {
  const handleDelete = async () => {
    if (!confirm(`Remove ${concert.band_name}?`)) return;
    await fetch(`/api/concerts/${concert.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <div className={`concert-card ${medal ? `concert-card--${medal}` : ''}`}>
      {medal && (
        <div className={`medal-badge medal-badge--${medal}`}>
          {MEDAL_EMOJI[medal]} ×{count}
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
          <button className="concert-card__del" onClick={handleDelete} title="Remove">×</button>
        </div>

          <div className="concert-card__meta">
            <span className="concert-card__year">{latest.year}</span>
            {latest.location && <span className="concert-card__loc">{latest.location}</span>}
          </div>

          {latest.spotify_genres?.length > 0 && (
            <div className="concert-card__genres">
              {latest.spotify_genres.slice(0, 3).map(g => (
                <span key={g} className="genre-tag">{g}</span>
              ))}
            </div>
          )}

          {latest.attendees?.length > 0 && (
            <div className="concert-card__attendees">
              {latest.attendees.map(p => (
                <span key={p} className="attendee-tag small">{p}</span>
              ))}
            </div>
          )}

          {latest.notes && <p className="concert-card__notes">{latest.notes}</p>}
        </div>
      </div>

      {expanded && (
        <div className="concert-history">
          <div className="concert-history__label">All shows</div>
          {all.map(c => (
            <ConcertRow key={c.id} concert={c} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConcertRow({ concert, onDelete }) {
  const handleDelete = async () => {
    if (!confirm(`Remove ${concert.band_name} (${concert.year})?`)) return;
    await fetch(`/api/concerts/${concert.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <div className="concert-row">
      <div className="concert-row__main">
        <span className="concert-row__year">{concert.year}</span>
        {concert.location && <span className="concert-row__loc">{concert.location}</span>}
      </div>
      <div className="concert-row__right">
        {concert.attendees?.length > 0 && (
          <div className="concert-row__attendees">
            {concert.attendees.map(p => <span key={p} className="attendee-tag small">{p}</span>)}
          </div>
        )}
        <button className="concert-row__del" onClick={handleDelete} title="Remove">×</button>
      </div>
      {concert.notes && <p className="concert-row__notes">{concert.notes}</p>}
    </div>
  );
}
