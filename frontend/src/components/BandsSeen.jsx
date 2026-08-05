import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import AddConcertModal from './AddConcertModal.jsx';
import EventEditModal from './EventEditModal.jsx';
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
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('band'); // 'band' | 'gig'
  const [showAdd, setShowAdd] = useState(false);
  const [editConcert, setEditConcert] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [filterAttendees, setFilterAttendees] = useState([]);
  const [filterMedal, setFilterMedal] = useState(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterFestivalsOnly, setFilterFestivalsOnly] = useState(false);
  const [showPosters, setShowPosters] = useState(true);
  const [sortBy, setSortBy] = useState('year-desc');

  const fetchConcerts = () =>
    fetch('/api/concerts').then(r => r.json()).then(setConcerts);
  const fetchEvents = () =>
    fetch('/api/events').then(r => r.json()).then(setEvents);
  const refetchAll = () => { fetchConcerts(); fetchEvents(); };

  useEffect(() => { refetchAll(); }, []);

  const toggleFilter = (person) =>
    setFilterAttendees(prev =>
      prev.includes(person) ? prev.filter(p => p !== person) : [...prev, person]
    );

  const allAttendees = useMemo(() => {
    const fromData = concerts.flatMap(c => c.attendees || []);
    return [...new Set([...PRESET_ATTENDEES, ...fromData])];
  }, [concerts]);

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

  const allYears = useMemo(() => {
    const years = new Set(concerts.map(c => c.year));
    return [...years].sort((a, b) => b - a);
  }, [concerts]);

  const filteredGroups = useMemo(() => {
    let list = [...groups];
    if (filterAttendees.length > 0)
      list = list.filter(g =>
        g.all.some(c => filterAttendees.every(p => (c.attendees || []).includes(p)))
      );
    if (filterMedal)
      list = list.filter(g => getMedal(g.count) === filterMedal);
    if (filterYear)
      list = list.filter(g => g.all.some(c => c.year === parseInt(filterYear)));
    if (sortBy === 'year-desc') list.sort((a, b) => b.latest.year - a.latest.year);
    else if (sortBy === 'year-asc') list.sort((a, b) => a.all[a.all.length - 1].year - b.all[b.all.length - 1].year);
    else if (sortBy === 'band-asc') list.sort((a, b) => a.latest.band_name.localeCompare(b.latest.band_name));
    else if (sortBy === 'most-seen') list.sort((a, b) => b.count - a.count || b.latest.year - a.latest.year);
    return list;
  }, [groups, filterAttendees, filterMedal, filterYear, sortBy]);

  const totalConcerts = filteredGroups.reduce((n, g) => n + g.count, 0);

  // Group by shared gig/festival (event_id) instead of by band — one card per night out
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

  const gigGroups = useMemo(() => {
    const byEvent = new Map();
    const solo = [];
    concerts.forEach(c => {
      if (c.event_id) {
        if (!byEvent.has(c.event_id)) byEvent.set(c.event_id, []);
        byEvent.get(c.event_id).push(c);
      } else {
        solo.push(c);
      }
    });
    const grouped = Array.from(byEvent.entries()).map(([eventId, cs]) => {
      const sorted = [...cs].sort((a, b) => {
        if (a.billing === 'headliner' && b.billing !== 'headliner') return -1;
        if (b.billing === 'headliner' && a.billing !== 'headliner') return 1;
        return a.band_name.localeCompare(b.band_name);
      });
      return { id: `event-${eventId}`, event: eventById.get(Number(eventId)) || null, concerts: sorted, year: Math.max(...cs.map(c => c.year)) };
    });
    const soloGroups = solo.map(c => ({ id: `solo-${c.id}`, event: null, concerts: [c], year: c.year }));
    return [...grouped, ...soloGroups];
  }, [concerts, eventById]);

  const filteredGigGroups = useMemo(() => {
    let list = [...gigGroups];
    if (filterAttendees.length > 0)
      list = list.filter(g =>
        g.concerts.some(c => filterAttendees.every(p => (c.attendees || []).includes(p)))
      );
    if (filterYear)
      list = list.filter(g => g.concerts.some(c => c.year === parseInt(filterYear)));
    if (filterFestivalsOnly)
      list = list.filter(g => g.event?.type === 'festival');
    if (sortBy === 'year-asc') list.sort((a, b) => a.year - b.year);
    else list.sort((a, b) => b.year - a.year);
    return list;
  }, [gigGroups, filterAttendees, filterYear, filterFestivalsOnly, sortBy]);

  return (
    <div className="bands-seen">
      <div className="bands-seen__toolbar">
        <div className="bands-seen__filters">
          <div className="view-toggle">
            <button className={viewMode === 'band' ? 'active' : ''} onClick={() => setViewMode('band')}>By Band</button>
            <button className={viewMode === 'gig' ? 'active' : ''} onClick={() => setViewMode('gig')}>By Gig</button>
          </div>
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
          {viewMode === 'band' && (
            <div className="medal-filters">
              {['gold', 'silver', 'bronze'].map(m => (
                <button
                  key={m}
                  className={`medal-filter medal-filter--${m} ${filterMedal === m ? 'active' : ''}`}
                  onClick={() => setFilterMedal(prev => prev === m ? null : m)}
                  title={m.charAt(0).toUpperCase() + m.slice(1)}
                >
                  {MEDAL_EMOJI[m]}
                </button>
              ))}
            </div>
          )}
          {viewMode === 'gig' && (
            <button
              className={`control-toggle ${filterFestivalsOnly ? 'active' : ''}`}
              onClick={() => setFilterFestivalsOnly(v => !v)}
              title="Festivals only"
            >
              🎪 Festivals
            </button>
          )}
          {viewMode === 'gig' && (
            <button
              className={`control-toggle ${showPosters ? 'active' : ''}`}
              onClick={() => setShowPosters(v => !v)}
              title="Show posters by default"
            >
              🖼️ Posters
            </button>
          )}
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="year-desc">Newest first</option>
            <option value="year-asc">Oldest first</option>
            {viewMode === 'band' && <option value="band-asc">Band A–Z</option>}
            {viewMode === 'band' && <option value="most-seen">Most seen</option>}
          </select>
          <button className="add-concert-btn" onClick={() => setShowAdd(true)}>+ Add Concert</button>
        </div>
      </div>

      {viewMode === 'band' ? (
        <>
          <div className="bands-seen__count">
            {filteredGroups.length} band{filteredGroups.length !== 1 ? 's' : ''}
            {' · '}
            {totalConcerts} concert{totalConcerts !== 1 ? 's' : ''}
            {filterAttendees.length > 0 && ` with ${filterAttendees.join(' & ')}`}
          </div>

          <div className="concerts-grid">
            {filteredGroups.map(group => (
              <BandGroupCard
                key={group.latest.spotify_id || group.latest.band_name}
                group={group}
                onDelete={refetchAll}
                onEdit={setEditConcert}
              />
            ))}
            {filteredGroups.length === 0 && (
              <div className="concerts-empty">No concerts yet. Add one!</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bands-seen__count">
            {filteredGigGroups.length} gig{filteredGigGroups.length !== 1 ? 's' : ''}
            {filterAttendees.length > 0 && ` with ${filterAttendees.join(' & ')}`}
          </div>

          <div className="gigs-grid">
            {filteredGigGroups.map(group => (
              <GigCard key={group.id} group={group} onDelete={refetchAll} onEdit={setEditConcert} onEditEvent={setEditEvent} showPosters={showPosters} />
            ))}
            {filteredGigGroups.length === 0 && (
              <div className="concerts-empty">No concerts yet. Add one!</div>
            )}
          </div>
        </>
      )}

      {showAdd && (
        <AddConcertModal
          knownAttendees={allAttendees}
          onSave={() => { setShowAdd(false); refetchAll(); }}
          onSaveKeepOpen={refetchAll}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editConcert && (
        <AddConcertModal
          concert={editConcert}
          knownAttendees={allAttendees}
          onSave={() => { setEditConcert(null); refetchAll(); }}
          onClose={() => setEditConcert(null)}
        />
      )}
      {editEvent && (
        <EventEditModal
          event={editEvent}
          onSave={() => { setEditEvent(null); refetchAll(); }}
          onClose={() => setEditEvent(null)}
        />
      )}
    </div>
  );
}

function BandGroupCard({ group, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const { latest, all, count } = group;
  const medal = getMedal(count);

  return (
    <div className={`concert-card ${medal ? `concert-card--${medal}` : ''}`}>
      {medal && (
        <div className={`medal-badge medal-badge--${medal}`}>
          {MEDAL_EMOJI[medal]} ×{count}
        </div>
      )}
      {count > 1 && !medal && (
        <div className="count-badge">×{count}</div>
      )}

      <div
        className={`concert-card__clickable${count > 1 ? ' concert-card__clickable--multi' : ''}`}
        onClick={() => count > 1 && setExpanded(e => !e)}
      >
        {latest.spotify_image && (
          <div className="concert-card__img-wrap">
            <img src={latest.spotify_image} alt={latest.band_name} className="concert-card__img" />
            {count > 1 && (
              <div className="concert-card__img-overlay">
                {expanded ? 'collapse ▴' : `${count} shows ▾`}
              </div>
            )}
          </div>
        )}

        <div className="concert-card__body">
          <div className="concert-card__top">
            <h3 className="concert-card__name">
              {latest.spotify_id ? (
                <a
                  href={`spotify:artist:${latest.spotify_id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  {latest.band_name}
                </a>
              ) : latest.band_name}
            </h3>
            {count === 1 && (
              <button
                className="concert-card__edit"
                onClick={e => { e.stopPropagation(); onEdit(latest); }}
                title="Edit"
              >✎</button>
            )}
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
            <ConcertRow key={c.id} concert={c} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConcertRow({ concert, onDelete, onEdit }) {
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
        <button className="concert-row__edit" onClick={() => onEdit(concert)} title="Edit">✎</button>
        <button className="concert-row__del" onClick={handleDelete} title="Remove">×</button>
      </div>
      {concert.notes && <p className="concert-row__notes">{concert.notes}</p>}
    </div>
  );
}

function GigCard({ group, onDelete, onEdit, onEditEvent, showPosters }) {
  const { event, concerts } = group;
  const isLineup = concerts.length > 1;
  const billedHeadliners = concerts.filter(c => c.billing === 'headliner');
  // Fall back to treating the first act as headliner only when nobody's been billed as one
  const headliners = billedHeadliners.length > 0 ? billedHeadliners : [concerts[0]];
  const support = concerts.filter(c => !headliners.includes(c));
  const title = event?.name || headliners.map(c => c.band_name).join(' & ');
  const dateLabel = event?.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : String(headliners[0].year);
  const venue = event?.venue || headliners[0].location;
  const poster = event?.poster_url || concerts.find(c => c.poster_url)?.poster_url;

  const frontRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(null);
  const [flipped, setFlipped] = useState(Boolean(poster) && showPosters);

  // Global "show posters" toggle drives the resting face; per-card clicks flip away from it
  useEffect(() => { setFlipped(Boolean(poster) && showPosters); }, [showPosters, poster]);

  useLayoutEffect(() => {
    if (frontRef.current) setCardHeight(frontRef.current.offsetHeight);
  }, [concerts, poster]);

  const infoFace = (
    <>
      <div className="gig-card__header">
        {event?.type === 'festival' && <span className="gig-card__type-badge">🎪 Festival</span>}
        <div className="gig-card__title-row">
          <h3 className="gig-card__title">{title}</h3>
          {event && (
            <button className="gig-card__edit" onClick={e => { e.stopPropagation(); onEditEvent(event); }} title="Edit gig details">✎</button>
          )}
        </div>
        <div className="gig-card__meta">
          <span className="gig-card__date">{dateLabel}</span>
          {venue && <span className="gig-card__venue">{venue}</span>}
        </div>
      </div>
      <div className="gig-card__lineup" onClick={e => e.stopPropagation()}>
        {headliners.map(c => (
          <GigBandRow key={c.id} concert={c} isHeadliner={isLineup} showBilling={isLineup} onDelete={onDelete} onEdit={onEdit} />
        ))}
        {support.map(c => (
          <GigBandRow key={c.id} concert={c} isHeadliner={false} showBilling={isLineup} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </div>
    </>
  );

  if (!poster) {
    return (
      <div className={`gig-card ${event?.type === 'festival' ? 'gig-card--festival' : ''}`}>
        {infoFace}
      </div>
    );
  }

  return (
    <div
      className={`gig-card gig-card--flippable ${event?.type === 'festival' ? 'gig-card--festival' : ''}`}
      style={cardHeight ? { height: cardHeight } : undefined}
      onClick={() => setFlipped(f => !f)}
      title="Click to flip"
    >
      <div className={`gig-card__flip ${flipped ? 'gig-card__flip--back' : ''}`}>
        <div className="gig-card__face gig-card__face--front" ref={frontRef}>
          {infoFace}
        </div>
        <div className="gig-card__face gig-card__face--back">
          <img src={poster} alt={`${title} poster`} />
          <div className="gig-card__back-caption">
            <span className="gig-card__back-title">{title}</span>
            <span className="gig-card__back-meta">{dateLabel}{venue ? ` · ${venue}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GigBandRow({ concert, isHeadliner, showBilling, onDelete, onEdit }) {
  const handleDelete = async () => {
    if (!confirm(`Remove ${concert.band_name} (${concert.year})?`)) return;
    await fetch(`/api/concerts/${concert.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <div className={`gig-band-row ${isHeadliner ? 'gig-band-row--headliner' : ''}`}>
      {concert.spotify_image && (
        <img className="gig-band-row__img" src={concert.spotify_image} alt={concert.band_name} />
      )}
      <div className="gig-band-row__info">
        <div className="gig-band-row__top">
          <span className="gig-band-row__name">
            {concert.spotify_id ? (
              <a href={`spotify:artist:${concert.spotify_id}`} target="_blank" rel="noreferrer">{concert.band_name}</a>
            ) : concert.band_name}
          </span>
          {showBilling && (
            <span className={`gig-band-row__tag ${isHeadliner ? 'gig-band-row__tag--headliner' : ''}`}>
              {isHeadliner ? 'Headliner' : 'Support'}
            </span>
          )}
        </div>
        {concert.attendees?.length > 0 && (
          <div className="gig-band-row__attendees">
            {concert.attendees.map(p => <span key={p} className="attendee-tag small">{p}</span>)}
          </div>
        )}
        {concert.notes && <p className="gig-band-row__notes">{concert.notes}</p>}
      </div>
      <div className="gig-band-row__actions">
        <button onClick={() => onEdit(concert)} title="Edit">✎</button>
        <button onClick={handleDelete} title="Remove">×</button>
      </div>
    </div>
  );
}
