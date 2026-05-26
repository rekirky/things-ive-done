import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './AnimalsIveTouched.css';

const INAT = 'https://api.inaturalist.org/v1';

async function searchTaxa(query) {
  try {
    const r = await fetch(`${INAT}/taxa?q=${encodeURIComponent(query)}&per_page=6&is_active=true`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).map(t => ({
      id: t.id,
      commonName: t.preferred_common_name || t.name,
      scientificName: t.preferred_common_name ? t.name : '',
      imageUrl: t.default_photo?.medium_url || t.default_photo?.square_url || null,
      description: t.wikipedia_summary
        ? t.wikipedia_summary.replace(/<[^>]+>/g, '').split('.')[0] + '.'
        : '',
    }));
  } catch {
    return [];
  }
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function AnimalsIveTouched() {
  const [animals, setAnimals] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('animals-theme') || 'jungle');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showForm, setShowForm] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState(null);
  const [selectedAnimal, setSelectedAnimal] = useState(null);

  const fetchAnimals = useCallback(() =>
    fetch('/api/animals').then(r => r.json()).then(setAnimals), []);

  useEffect(() => { fetchAnimals(); }, [fetchAnimals]);

  function toggleTheme() {
    const next = theme === 'jungle' ? 'classic' : 'jungle';
    setTheme(next);
    localStorage.setItem('animals-theme', next);
  }

  async function saveAnimal(data) {
    const method = editingAnimal ? 'PUT' : 'POST';
    const url = editingAnimal ? `/api/animals/${editingAnimal.id}` : '/api/animals';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetchAnimals();
    setShowForm(false);
    setEditingAnimal(null);
  }

  async function deleteAnimal(id) {
    if (!confirm('Remove this animal encounter?')) return;
    await fetch(`/api/animals/${id}`, { method: 'DELETE' });
    await fetchAnimals();
    setSelectedAnimal(null);
  }

  const filtered = useMemo(() => {
    let list = animals;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.animal_name.toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q) ||
        (a.scientific_name || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'date-desc') return b.encounter_date.localeCompare(a.encounter_date);
      if (sortBy === 'date-asc') return a.encounter_date.localeCompare(b.encounter_date);
      return a.animal_name.localeCompare(b.animal_name);
    });
  }, [animals, search, sortBy]);

  return (
    <div className="at-page" data-theme={theme}>
      <div className="at-header">
        <div className="at-header-left">
          <h2 className="at-title">
            <span className="at-title-icon">🌿</span>
            Animals I've Touched
          </h2>
          {animals.length > 0 && (
            <span className="at-count">{animals.length} encounter{animals.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="at-header-right">
          <button className="at-theme-toggle" onClick={toggleTheme} title="Switch theme">
            {theme === 'jungle' ? '🎨 Classic' : '🌿 Jungle'}
          </button>
          <button
            className="at-btn at-btn--primary"
            onClick={() => { setEditingAnimal(null); setShowForm(true); }}
          >
            + Log Animal
          </button>
        </div>
      </div>

      <div className="at-toolbar">
        <div className="at-search-wrap">
          <span className="at-search-icon">🔍</span>
          <input
            className="at-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by animal or location…"
          />
          {search && (
            <button className="at-search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>
        <select className="at-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="alpha">A – Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="at-empty">
          <div className="at-empty-icon">{animals.length === 0 ? '🦁' : '🔎'}</div>
          <h3>{animals.length === 0 ? 'No encounters logged yet' : 'No animals match your search'}</h3>
          {animals.length === 0 && (
            <p>Log every wild, domestic, or exotic animal you've interacted with</p>
          )}
        </div>
      ) : (
        <div className="at-grid">
          {filtered.map(animal => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              onClick={() => setSelectedAnimal(animal)}
              onEdit={e => { e.stopPropagation(); setEditingAnimal(animal); setShowForm(true); }}
              onDelete={e => { e.stopPropagation(); deleteAnimal(animal.id); }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AnimalFormModal
          animal={editingAnimal}
          onSave={saveAnimal}
          onClose={() => { setShowForm(false); setEditingAnimal(null); }}
        />
      )}
      {selectedAnimal && (
        <AnimalDetailModal
          animal={selectedAnimal}
          onEdit={() => { setEditingAnimal(selectedAnimal); setSelectedAnimal(null); setShowForm(true); }}
          onDelete={() => deleteAnimal(selectedAnimal.id)}
          onClose={() => setSelectedAnimal(null)}
        />
      )}
    </div>
  );
}

// ── Animal card ───────────────────────────────────────────────────────────────

function AnimalCard({ animal, onClick, onEdit, onDelete }) {
  return (
    <div className="at-card" onClick={onClick}>
      <div className="at-card-img">
        {animal.image_url
          ? <img src={animal.image_url} alt={animal.animal_name} loading="lazy" />
          : <div className="at-card-no-img">🐾</div>
        }
      </div>
      <div className="at-card-overlay">
        <div className="at-card-name">{animal.animal_name}</div>
        {animal.scientific_name && (
          <div className="at-card-sci">{animal.scientific_name}</div>
        )}
        <div className="at-card-meta">
          {animal.encounter_date && <span>📅 {fmtDate(animal.encounter_date)}</span>}
          {animal.location && <span>📍 {animal.location}</span>}
        </div>
      </div>
      <div className="at-card-actions">
        <button className="at-card-btn" onClick={onEdit} title="Edit">✎</button>
        <button className="at-card-btn at-card-btn--del" onClick={onDelete} title="Delete">×</button>
      </div>
    </div>
  );
}

// ── Add / edit modal ──────────────────────────────────────────────────────────

function AnimalFormModal({ animal, onSave, onClose }) {
  const [animalName, setAnimalName] = useState(animal?.animal_name || '');
  const [scientificName, setScientificName] = useState(animal?.scientific_name || '');
  const [imageUrl, setImageUrl] = useState(animal?.image_url || '');
  const [wikiExtract, setWikiExtract] = useState(animal?.wiki_extract || '');
  const [date, setDate] = useState(animal?.encounter_date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(animal?.location || '');
  const [notes, setNotes] = useState(animal?.notes || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  function onNameChange(val) {
    setAnimalName(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const results = await searchTaxa(val);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } finally {
        setLoadingSearch(false);
      }
    }, 350);
  }

  async function pickSuggestion(taxon) {
    setAnimalName(taxon.commonName);
    setScientificName(taxon.scientificName);
    setSuggestions([]);
    setShowSuggestions(false);
    if (taxon.imageUrl || taxon.description) {
      setLoadingImg(true);
      setImageUrl(taxon.imageUrl || '');
      setWikiExtract(taxon.description || '');
      setLoadingImg(false);
    }
  }

  function submit() {
    if (!animalName.trim() || !date) return;
    onSave({
      animal_name: animalName.trim(),
      scientific_name: scientificName,
      image_url: imageUrl,
      wiki_extract: wikiExtract,
      encounter_date: date,
      location,
      notes,
    });
  }

  return (
    <div className="at-overlay" onClick={onClose}>
      <div className="at-modal" onClick={e => e.stopPropagation()}>
        <div className="at-modal-head">
          <h3>{animal ? 'Edit Encounter' : 'Log Animal Encounter'}</h3>
          <button className="at-modal-x" onClick={onClose}>×</button>
        </div>

        <div className="at-modal-body">
          <label className="at-label">Animal *</label>
          <div className="at-autocomplete-wrap">
            <input
              ref={inputRef}
              className="at-input"
              type="text"
              value={animalName}
              onChange={e => onNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. African Elephant, Red Fox, Axolotl…"
              autoFocus
              autoComplete="off"
            />
            {loadingSearch && <span className="at-spinner">⟳</span>}
            {showSuggestions && (
              <div className="at-suggestions">
                {suggestions.map(t => (
                  <button key={t.id} className="at-suggestion" onMouseDown={() => pickSuggestion(t)}>
                    {t.imageUrl && (
                      <img className="at-suggestion-thumb" src={t.imageUrl.replace('medium', 'square')} alt="" />
                    )}
                    <div className="at-suggestion-text">
                      <span className="at-suggestion-common">{t.commonName}</span>
                      {t.scientificName && (
                        <span className="at-suggestion-sci">{t.scientificName}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingImg && <div className="at-loading-wiki">Loading animal info…</div>}

          {imageUrl && (
            <div className="at-preview">
              <img src={imageUrl} alt={animalName} className="at-preview-img" />
              {wikiExtract && <p className="at-preview-extract">{wikiExtract}</p>}
              <button className="at-preview-clear" onClick={() => { setImageUrl(''); setWikiExtract(''); }}>
                Clear image
              </button>
            </div>
          )}

          <div className="at-form-row">
            <div className="at-form-col">
              <label className="at-label">Date *</label>
              <input
                type="date"
                className="at-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="at-form-col">
              <label className="at-label">Location</label>
              <input
                className="at-input"
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Kruger National Park"
              />
            </div>
          </div>

          <label className="at-label">Notes</label>
          <textarea
            className="at-input at-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any special memories or context…"
            rows={3}
          />
        </div>

        <div className="at-modal-foot">
          <button className="at-btn" onClick={onClose}>Cancel</button>
          <button
            className="at-btn at-btn--primary"
            disabled={!animalName.trim() || !date}
            onClick={submit}
          >
            {animal ? 'Save Changes' : 'Log Encounter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function AnimalDetailModal({ animal, onEdit, onDelete, onClose }) {
  const longDate = animal.encounter_date
    ? new Date(animal.encounter_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="at-overlay" onClick={onClose}>
      <div className="at-modal at-modal--detail" onClick={e => e.stopPropagation()}>
        {animal.image_url && (
          <div className="at-detail-hero">
            <img src={animal.image_url} alt={animal.animal_name} />
            <div className="at-detail-hero-grad">
              <h2 className="at-detail-hero-name">{animal.animal_name}</h2>
              {animal.scientific_name && (
                <p className="at-detail-hero-sci">{animal.scientific_name}</p>
              )}
            </div>
          </div>
        )}

        <div className="at-modal-head at-modal-head--detail">
          {!animal.image_url && <h3>{animal.animal_name}</h3>}
          <button className="at-modal-x" onClick={onClose}>×</button>
        </div>

        <div className="at-modal-body">
          {longDate && (
            <div className="at-detail-row">
              <span className="at-detail-icon">📅</span>
              <span>{longDate}</span>
            </div>
          )}
          {animal.location && (
            <div className="at-detail-row">
              <span className="at-detail-icon">📍</span>
              <span>{animal.location}</span>
            </div>
          )}
          {animal.wiki_extract && (
            <p className="at-detail-extract">{animal.wiki_extract}</p>
          )}
          {animal.notes && (
            <blockquote className="at-detail-notes">{animal.notes}</blockquote>
          )}
          {animal.image_url && (
            <p className="at-detail-credit">
              Photo via <a href="https://www.inaturalist.org" target="_blank" rel="noreferrer">iNaturalist</a>
            </p>
          )}
        </div>

        <div className="at-modal-foot">
          <button className="at-btn at-btn--danger" onClick={onDelete}>Delete</button>
          <button className="at-btn" onClick={onClose}>Close</button>
          <button className="at-btn at-btn--primary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}
