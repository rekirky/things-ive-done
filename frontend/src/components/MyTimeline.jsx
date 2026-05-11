import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './MyTimeline.css';

const YEAR_HEIGHT = 110;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const AXIS_WIDTH = 130;
const LANE_WIDTH = 215;
const ITEM_WIDTH = 204;
const MIN_ITEM_HEIGHT = 36;

// Horizontal mode constants
const AXIS_H = 56;
const LANE_H = 96;
const ITEM_H_H = 80;

const TAG_PALETTE = [
  '#e94560', '#60a5fa', '#4ade80', '#f59e0b',
  '#a78bfa', '#fb923c', '#34d399', '#f472b6',
  '#22d3ee', '#84cc16', '#c084fc', '#fbbf24',
];

function tagColor(tag, overrides = {}) {
  if (overrides[tag]) return overrides[tag];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

function dateToTop(date, birthDate) {
  return Math.max(0, (date.getTime() - birthDate.getTime()) / MS_PER_YEAR * YEAR_HEIGHT);
}

function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

function fmtDate(str) {
  if (!str) return '';
  const d = parseDate(str);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function assignLanes(items, birthDate, today) {
  const sorted = [...items].sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));
  const laneEnds = [];
  return sorted.map(item => {
    const start = parseDate(item.start_date);
    const end = item.end_date ? parseDate(item.end_date) : today;
    const startTop = dateToTop(start, birthDate);
    const rawH = dateToTop(end, birthDate) - startTop;
    const height = Math.max(MIN_ITEM_HEIGHT, rawH);
    const bottomTop = startTop + height;

    let lane = laneEnds.findIndex(e => e <= startTop - 2);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bottomTop + 4;

    return { ...item, lane, startTop, height, start, end };
  });
}

export default function MyTimeline() {
  const [items, setItems] = useState([]);
  const [birthdate, setBirthdate] = useState(null);
  const [tagColors, setTagColors] = useState({});
  const [activeTags, setActiveTags] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [orient, setOrient] = useState('vertical');
  const scrollRef = useRef(null);
  const dragState = useRef(null);

  const fetchAll = useCallback(() =>
    Promise.all([
      fetch('/api/timeline/settings').then(r => r.json()),
      fetch('/api/timeline/items').then(r => r.json()),
    ]).then(([settings, list]) => {
      setBirthdate(settings.birthdate || null);
      setTagColors(settings.tag_colors || {});
      setItems(list);
    }), []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = useMemo(() => new Date(), []);
  const birthDate = useMemo(() => (birthdate ? parseDate(birthdate) : null), [birthdate]);

  const allTags = useMemo(() =>
    [...new Set(items.flatMap(i => i.tags))].sort(), [items]);

  const tc = (tag) => tagColor(tag, tagColors);

  const filteredItems = useMemo(() =>
    activeTags.length === 0
      ? items
      : items.filter(i => i.tags.some(t => activeTags.includes(t))),
    [items, activeTags]);

  const tl = useMemo(() => {
    if (!birthDate) return null;

    const birthYear = birthDate.getFullYear();
    const todayYear = today.getFullYear();
    const todayTopAbsolute = dateToTop(today, birthDate);

    // Trim dead space when a tag filter is active
    let viewStart = 0;
    let viewEndAbs = todayTopAbsolute;
    if (activeTags.length > 0 && filteredItems.length > 0) {
      const pad = YEAR_HEIGHT * 0.75;
      const starts = filteredItems.map(i => dateToTop(parseDate(i.start_date), birthDate));
      const ends = filteredItems.map(i =>
        i.end_date ? dateToTop(parseDate(i.end_date), birthDate) : todayTopAbsolute
      );
      viewStart = Math.max(0, Math.min(...starts) - pad);
      viewEndAbs = Math.min(todayTopAbsolute, Math.max(...ends) + pad);
    }

    const todayTop = todayTopAbsolute - viewStart;
    const totalHeight = viewEndAbs - viewStart + YEAR_HEIGHT;

    const yearMarks = [];
    for (let y = birthYear; y <= todayYear + 1; y++) {
      const date = y === birthYear ? birthDate : new Date(y, 0, 1);
      if (date > today && y > todayYear) break;
      const top = dateToTop(date, birthDate) - viewStart;
      if (top < -YEAR_HEIGHT || top > totalHeight + YEAR_HEIGHT) continue;
      yearMarks.push({
        year: y,
        age: y - birthYear,
        top,
        major: (y - birthYear) % 5 === 0,
      });
    }

    const birthdays = [];
    for (let y = birthYear + 1; y <= todayYear; y++) {
      const date = new Date(y, birthDate.getMonth(), birthDate.getDate());
      if (date > today) break;
      const top = dateToTop(date, birthDate) - viewStart;
      if (top < 0 || top > totalHeight) continue;
      birthdays.push({
        year: y,
        age: y - birthYear,
        top,
        milestone: (y - birthYear) % 5 === 0,
      });
    }

    const withLanes = assignLanes(filteredItems, birthDate, today).map(i => ({
      ...i,
      startTop: i.startTop - viewStart,
    }));
    const numLanes = withLanes.length > 0
      ? Math.max(...withLanes.map(i => i.lane)) + 1
      : 1;
    const totalWidth = AXIS_WIDTH + numLanes * LANE_WIDTH + 40;
    const showBirth = viewStart < YEAR_HEIGHT * 0.25;
    const showToday = todayTop <= totalHeight;

    return { yearMarks, birthdays, todayTop, totalHeight, totalWidth, withLanes, showBirth, showToday };
  }, [birthDate, today, filteredItems, activeTags]);

  useEffect(() => {
    if (scrollRef.current && tl) {
      if (orient === 'horizontal') scrollRef.current.scrollLeft = Math.max(0, tl.todayTop - 500);
      else scrollRef.current.scrollTop = Math.max(0, tl.todayTop - 300);
    }
  }, [tl?.todayTop, orient]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (orient === 'horizontal') scrollRef.current.scrollLeft = 0;
    else scrollRef.current.scrollTop = 0;
  }, [activeTags]);

  useEffect(() => {
    function onMove(e) {
      const ds = dragState.current;
      if (!ds || !scrollRef.current) return;
      const dx = e.clientX - ds.x;
      const dy = e.clientY - ds.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) ds.moved = true;
      scrollRef.current.scrollLeft = ds.sl - dx;
      scrollRef.current.scrollTop = ds.st - dy;
    }
    function onUp() {
      if (scrollRef.current) scrollRef.current.style.cursor = '';
      dragState.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onCapture(e) {
      if (dragState.current?.moved) {
        e.stopPropagation();
        dragState.current.moved = false;
      }
    }
    el.addEventListener('click', onCapture, true);
    return () => el.removeEventListener('click', onCapture, true);
  }, []);

  function onScrollMouseDown(e) {
    if (e.button !== 0 || !scrollRef.current) return;
    dragState.current = {
      x: e.clientX, y: e.clientY,
      sl: scrollRef.current.scrollLeft,
      st: scrollRef.current.scrollTop,
      moved: false,
    };
    scrollRef.current.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function toggleTag(tag) {
    setActiveTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  }

  async function saveSettings(bd, colors) {
    await fetch('/api/timeline/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthdate: bd, tag_colors: colors }),
    });
    setTagColors(colors || {});
    await fetchAll();
    setShowSettings(false);
  }

  async function saveItem(data) {
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem
      ? `/api/timeline/items/${editingItem.id}`
      : '/api/timeline/items';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetchAll();
    setShowForm(false);
    setEditingItem(null);
  }

  async function deleteItem(id) {
    if (!confirm('Delete this timeline item?')) return;
    await fetch(`/api/timeline/items/${id}`, { method: 'DELETE' });
    await fetchAll();
    setSelectedItem(null);
  }

  if (!birthdate) {
    return (
      <div className="tl tl--empty">
        <div className="tl-empty-state">
          <div className="tl-empty-icon">📅</div>
          <h2>Your Life Timeline</h2>
          <p>Set your birthdate to start building your timeline</p>
          <button className="tl-btn tl-btn--primary" onClick={() => setShowSettings(true)}>
            Set Birthdate
          </button>
        </div>
        {showSettings && (
          <SettingsModal birthdate={birthdate} tagColors={tagColors} allTags={allTags} onSave={saveSettings} onClose={() => setShowSettings(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="tl">
      <div className="tl-header">
        <h2 className="tl-title">My Timeline</h2>
        <div className="tl-controls">
          <button className="tl-btn tl-btn--primary" onClick={() => { setEditingItem(null); setShowForm(true); }}>
            + Add Item
          </button>
          <button
            className="tl-btn"
            onClick={() => setOrient(o => o === 'vertical' ? 'horizontal' : 'vertical')}
            title="Toggle layout"
          >
            {orient === 'horizontal' ? '↕ Vertical' : '↔ Horizontal'}
          </button>
          <button className="tl-btn" onClick={() => setShowSettings(true)}>⚙ Settings</button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="tl-filters">
          <button
            className={`tl-filter-btn${activeTags.length === 0 ? ' active' : ''}`}
            onClick={() => setActiveTags([])}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tl-filter-btn${activeTags.includes(tag) ? ' active' : ''}`}
              style={{ '--tc': tc(tag) }}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="tl-scroll" ref={scrollRef} onMouseDown={onScrollMouseDown}>
        {tl && (() => {
          const H = orient === 'horizontal';
          const numLanes = tl.withLanes.length > 0 ? Math.max(...tl.withLanes.map(i => i.lane)) + 1 : 1;
          const innerW = H ? tl.totalHeight + 60 : Math.max(tl.totalWidth, 600);
          const innerH = H ? AXIS_H + numLanes * LANE_H + 40 : tl.totalHeight;
          return (
            <div className={`tl-inner${H ? ' tl-inner--h' : ''}`} style={{ width: innerW, height: innerH }}>

              {/* Lifeline */}
              <div className="tl-line" style={H
                ? { top: AXIS_H, left: 0, width: Math.min(tl.todayTop, innerW), height: 3, transform: 'none' }
                : { left: AXIS_WIDTH, height: Math.min(tl.todayTop, tl.totalHeight) }} />
              {tl.showToday && <div className="tl-line tl-line--future" style={H
                ? { top: AXIS_H, left: tl.todayTop, width: innerW - tl.todayTop, height: 2, transform: 'none' }
                : { left: AXIS_WIDTH, top: tl.todayTop, height: tl.totalHeight - tl.todayTop }} />}

              {/* Birth marker */}
              {tl.showBirth && (H ? (
                <div className="tl-birth tl-birth--h" style={{ top: AXIS_H, left: 0 }}>
                  <div className="tl-birth-dot" />
                  <span className="tl-birth-label tl-birth-label--h">Born · {fmtDate(birthdate)}</span>
                </div>
              ) : (
                <div className="tl-birth" style={{ left: AXIS_WIDTH }}>
                  <div className="tl-birth-dot" />
                  <span className="tl-birth-label">Born · {fmtDate(birthdate)}</span>
                </div>
              ))}

              {/* Year ticks */}
              {tl.yearMarks.map(({ year, age, top, major }) => H ? (
                <div key={year} className={`tl-year tl-year--h${major ? ' tl-year--major' : ''}`} style={{ left: top }}>
                  <span className="tl-year-num">{year}</span>
                  <span className="tl-year-age">{age}</span>
                  <div className="tl-year-tick-h" />
                </div>
              ) : (
                <div key={year} className={`tl-year${major ? ' tl-year--major' : ''}`} style={{ top }}>
                  <span className="tl-year-num">{year}</span>
                  <span className="tl-year-age">age {age}</span>
                  <div className="tl-year-tick" style={{ left: AXIS_WIDTH - 10 }} />
                </div>
              ))}

              {/* Birthday markers */}
              {tl.birthdays.map(({ year, age, top, milestone }) => (
                <div
                  key={`bd-${year}`}
                  className={`tl-birthday${milestone ? ' tl-birthday--big' : ''}`}
                  style={H ? { left: top, top: AXIS_H + 6, transform: 'translateX(-50%)' } : { top, left: AXIS_WIDTH + 8 }}
                  title={`Birthday — Age ${age}`}
                >
                  🎂{milestone && <span className="tl-bd-label">Age {age}</span>}
                </div>
              ))}

              {/* Today marker */}
              {tl.showToday && (H ? (
                <div className="tl-today tl-today--h" style={{ left: tl.todayTop }}>
                  <div className="tl-today-line-v" style={{ height: innerH }} />
                  <span className="tl-today-label" style={{ top: AXIS_H + 6, left: 6 }}>
                    Today · Age {today.getFullYear() - birthDate.getFullYear()}
                  </span>
                </div>
              ) : (
                <div className="tl-today" style={{ top: tl.todayTop }}>
                  <div className="tl-today-line" style={{ width: innerW }} />
                  <span className="tl-today-label" style={{ left: AXIS_WIDTH + 12 }}>
                    Today · Age {today.getFullYear() - birthDate.getFullYear()}
                  </span>
                </div>
              ))}

              {/* Items */}
              {tl.withLanes.map(item => (
                <div
                  key={item.id}
                  className={`tl-item${!item.end_date ? ' tl-item--ongoing' : ''}${H ? ' tl-item--h' : ''}`}
                  style={H ? {
                    left: item.startTop,
                    top: AXIS_H + 18 + item.lane * LANE_H,
                    width: Math.max(MIN_ITEM_HEIGHT, item.height),
                    height: ITEM_H_H,
                    '--ic': item.tags?.length ? tc(item.tags[0]) : '#6060a0',
                  } : {
                    top: item.startTop,
                    left: AXIS_WIDTH + 18 + item.lane * LANE_WIDTH,
                    width: ITEM_WIDTH,
                    height: item.height,
                    '--ic': item.tags?.length ? tc(item.tags[0]) : '#6060a0',
                  }}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="tl-item-inner">
                    <div className="tl-item-body">
                      <div className="tl-item-title">{item.title}</div>
                      {item.tags.length > 0 && (
                        <div className="tl-item-tags">
                          {item.tags.map(t => (
                            <span key={t} className="tl-chip" style={{ '--tc': tc(t) }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="tl-item-dates">
                        {fmtDate(item.start_date)} → {item.end_date ? fmtDate(item.end_date) : 'Present'}
                      </div>
                      {item.image && <span className="tl-item-cam">📷</span>}
                    </div>
                    <div className="tl-item-actions">
                      <button
                        className="tl-action-btn"
                        title="Edit"
                        onClick={e => { e.stopPropagation(); setEditingItem(item); setShowForm(true); }}
                      >✎</button>
                      <button
                        className="tl-action-btn tl-action-btn--del"
                        title="Delete"
                        onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                      >×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {showSettings && (
        <SettingsModal birthdate={birthdate} tagColors={tagColors} allTags={allTags} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}
      {showForm && (
        <ItemFormModal
          item={editingItem}
          allTags={allTags}
          tagColors={tagColors}
          onSave={saveItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          tagColors={tagColors}
          onEdit={() => { setEditingItem(selectedItem); setSelectedItem(null); setShowForm(true); }}
          onDelete={() => deleteItem(selectedItem.id)}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ── Settings modal ────────────────────────────────────────────────────────────

function SettingsModal({ birthdate, tagColors = {}, allTags = [], onSave, onClose }) {
  const [value, setValue] = useState(birthdate || '');
  const [localColors, setLocalColors] = useState({ ...tagColors });

  function setColor(tag, color) {
    setLocalColors(p => ({ ...p, [tag]: color }));
  }

  function resetColor(tag) {
    setLocalColors(p => { const n = { ...p }; delete n[tag]; return n; });
  }

  return (
    <div className="tl-overlay" onClick={onClose}>
      <div className="tl-modal" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-head">
          <h3>Timeline Settings</h3>
          <button className="tl-modal-x" onClick={onClose}>×</button>
        </div>
        <div className="tl-modal-body">
          <label className="tl-label">Your Birthdate</label>
          <input
            type="date"
            className="tl-input"
            value={value}
            onChange={e => setValue(e.target.value)}
          />

          {allTags.length > 0 && (
            <>
              <label className="tl-label tl-label--mt">Tag Colors</label>
              <div className="tl-tag-colors">
                {allTags.map(tag => {
                  const color = localColors[tag] || tagColor(tag);
                  const overridden = !!localColors[tag];
                  return (
                    <div key={tag} className="tl-tag-color-row">
                      <span className="tl-chip" style={{ '--tc': color }}>{tag}</span>
                      <input
                        type="color"
                        className="tl-color-input"
                        value={color}
                        onChange={e => setColor(tag, e.target.value)}
                      />
                      {overridden && (
                        <button className="tl-color-reset" title="Reset to default" onClick={() => resetColor(tag)}>↺</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="tl-modal-foot">
          <button className="tl-btn" onClick={onClose}>Cancel</button>
          <button
            className="tl-btn tl-btn--primary"
            disabled={!value}
            onClick={() => value && onSave(value, localColors)}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Add / edit item modal ─────────────────────────────────────────────────────

function ItemFormModal({ item, allTags, tagColors = {}, onSave, onClose }) {
  const [title, setTitle] = useState(item?.title || '');
  const [desc, setDesc] = useState(item?.description || '');
  const [startDate, setStartDate] = useState(item?.start_date || '');
  const [endDate, setEndDate] = useState(item?.end_date || '');
  const [tags, setTags] = useState(item?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [image, setImage] = useState(item?.image || null);
  const fileRef = useRef(null);

  function addTag(raw) {
    const t = raw.trim();
    if (t && !tags.includes(t)) setTags(p => [...p, t]);
    setTagInput('');
  }

  function onTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
  }

  function onImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!title || !startDate) return;
    onSave({ title, description: desc, start_date: startDate, end_date: endDate || null, tags, image });
  }

  const suggestions = allTags.filter(t => !tags.includes(t));

  return (
    <div className="tl-overlay" onClick={onClose}>
      <div className="tl-modal tl-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-head">
          <h3>{item ? 'Edit' : 'Add'} Timeline Item</h3>
          <button className="tl-modal-x" onClick={onClose}>×</button>
        </div>

        <div className="tl-modal-body tl-modal-body--form">
          <label className="tl-label">Title *</label>
          <input
            className="tl-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. First car, Buddy the dog, New house…"
            autoFocus
          />

          <label className="tl-label">Description</label>
          <textarea
            className="tl-input tl-textarea"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Any notes or memories…"
            rows={3}
          />

          <div className="tl-form-row">
            <div className="tl-form-col">
              <label className="tl-label">Start Date *</label>
              <input type="date" className="tl-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="tl-form-col">
              <label className="tl-label">End Date (blank = ongoing)</label>
              <input type="date" className="tl-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <label className="tl-label">Tags</label>
          <div className="tl-tag-wrap">
            {tags.map(t => (
              <span key={t} className="tl-chip tl-chip--rm" style={{ '--tc': tagColor(t, tagColors) }}>
                {t}<button onClick={() => setTags(p => p.filter(x => x !== t))}>×</button>
              </span>
            ))}
            <input
              className="tl-tag-input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              placeholder="Type tag + Enter…"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="tl-tag-suggestions">
              {suggestions.map(t => (
                <button key={t} className="tl-tag-suggest" onClick={() => addTag(t)}>{t}</button>
              ))}
            </div>
          )}

          <label className="tl-label">Photo</label>
          {image ? (
            <div className="tl-img-preview">
              <img src={image} alt="preview" />
              <button className="tl-img-rm" onClick={() => setImage(null)}>Remove photo</button>
            </div>
          ) : (
            <button className="tl-img-upload-btn" onClick={() => fileRef.current?.click()}>
              📷 Upload Photo
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />
        </div>

        <div className="tl-modal-foot">
          <button className="tl-btn" onClick={onClose}>Cancel</button>
          <button className="tl-btn tl-btn--primary" disabled={!title || !startDate} onClick={submit}>
            {item ? 'Save Changes' : 'Add to Timeline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item detail modal ─────────────────────────────────────────────────────────

function ItemDetailModal({ item, tagColors = {}, onEdit, onDelete, onClose }) {
  return (
    <div className="tl-overlay" onClick={onClose}>
      <div className="tl-modal tl-modal--detail" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-head">
          <h3>{item.title}</h3>
          <button className="tl-modal-x" onClick={onClose}>×</button>
        </div>
        <div className="tl-modal-body">
          {item.image && (
            <div className="tl-detail-img">
              <img src={item.image} alt={item.title} />
            </div>
          )}
          <div className="tl-detail-dates">
            📅 {fmtDate(item.start_date)} → {item.end_date ? fmtDate(item.end_date) : 'Present'}
            {!item.end_date && <span className="tl-ongoing-badge">Ongoing</span>}
          </div>
          {item.tags.length > 0 && (
            <div className="tl-detail-tags">
              {item.tags.map(t => (
                <span key={t} className="tl-chip" style={{ '--tc': tagColor(t, tagColors) }}>{t}</span>
              ))}
            </div>
          )}
          {item.description && <p className="tl-detail-desc">{item.description}</p>}
        </div>
        <div className="tl-modal-foot">
          <button className="tl-btn tl-btn--danger" onClick={onDelete}>Delete</button>
          <button className="tl-btn" onClick={onClose}>Close</button>
          <button className="tl-btn tl-btn--primary" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}
