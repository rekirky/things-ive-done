import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import './MyTimeline.css';

const YEAR_PX = 110;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Pin layout — horizontal (time → x)
const H_AXIS_Y    = 164;
const H_STALK_BASE = 72;
const H_STALK_STEP = 58;
const H_BOX_W     = 168;
const H_BOX_H     = 34;

// Pin layout — vertical (time → y)
const V_AXIS_X    = 130;
const V_STALK_BASE = 72;
const V_STALK_STEP = 58;
const V_BOX_W     = 156;
const V_BOX_H     = 34;

const DOT_R    = 5;
const MIN_GAP  = 182;   // min px between box centres on the same side/lane

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

function dateToPx(date, birthDate) {
  return Math.max(0, (date.getTime() - birthDate.getTime()) / MS_PER_YEAR * YEAR_PX);
}
// keep legacy alias used in some places
const dateToTop = dateToPx;

function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

function fmtDate(str) {
  if (!str) return '';
  const d = parseDate(str);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function assignStalks(items, birthDate, today) {
  const sorted = [...items].sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));
  const todayAbs = dateToPx(today, birthDate);
  const used = { a: [], b: [] };
  return sorted.map((item, idx) => {
    const px    = dateToPx(parseDate(item.start_date), birthDate);
    const endPx = item.end_date ? dateToPx(parseDate(item.end_date), birthDate) : todayAbs;
    const findLane = s => {
      let l = 0;
      while (used[s].some(u => u.lane === l && Math.abs(u.px - px) < MIN_GAP)) l++;
      return l;
    };
    const la = findLane('a'), lb = findLane('b');
    // prefer alternating; tie-break to side with lower lane needed
    const side = (idx % 2 === 0 ? la <= lb : lb <= la) ? 'a' : 'b';
    const lane = side === 'a' ? la : lb;
    used[side].push({ px, lane });
    return { ...item, px, endPx, side, lane };
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
  const [orient, setOrient] = useState('horizontal');
  const [showFull, setShowFull] = useState(false);
  const scrollRef = useRef(null);
  const innerRef = useRef(null);
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
    const todayAbs  = dateToPx(today, birthDate);

    // Trim dead space when a tag filter is active
    let viewStart = 0;
    let viewEndAbs = todayAbs;
    if (activeTags.length > 0 && filteredItems.length > 0) {
      const pad = YEAR_PX * 0.75;
      const starts = filteredItems.map(i => dateToPx(parseDate(i.start_date), birthDate));
      const ends   = filteredItems.map(i =>
        i.end_date ? dateToPx(parseDate(i.end_date), birthDate) : todayAbs
      );
      viewStart  = Math.max(0, Math.min(...starts) - pad);
      viewEndAbs = Math.min(todayAbs, Math.max(...ends) + pad);
    }

    const todayTop = todayAbs - viewStart;
    const timePx   = viewEndAbs - viewStart + YEAR_PX * 0.5;

    const yearMarks = [];
    for (let y = birthYear; y <= todayYear + 1; y++) {
      const date = y === birthYear ? birthDate : new Date(y, 0, 1);
      if (date > today && y > todayYear) break;
      const top = dateToPx(date, birthDate) - viewStart;
      if (top < -YEAR_PX || top > timePx + YEAR_PX) continue;
      yearMarks.push({ year: y, age: y - birthYear, top, major: (y - birthYear) % 5 === 0 });
    }

    const birthdays = [];
    for (let y = birthYear + 1; y <= todayYear; y++) {
      const date = new Date(y, birthDate.getMonth(), birthDate.getDate());
      if (date > today) break;
      const top = dateToPx(date, birthDate) - viewStart;
      if (top < 0 || top > timePx) continue;
      birthdays.push({ year: y, age: y - birthYear, top, milestone: (y - birthYear) % 5 === 0 });
    }

    const pins = assignStalks(filteredItems, birthDate, today).map(p => ({
      ...p,
      px:    p.px    - viewStart,
      endPx: p.endPx - viewStart,
    }));

    const showBirth = viewStart < YEAR_PX * 0.25;
    const showToday = todayTop <= timePx;

    return { yearMarks, birthdays, todayTop, timePx, pins, showBirth, showToday };
  }, [birthDate, today, filteredItems, activeTags]);

  // Cross-axis layout — how far pins stack out to each side of the time axis.
  // Computed dynamically (rather than a fixed offset) so a busy cluster of
  // items never needs negative coordinates, which would render unreachably
  // off the top/left edge of the scroll area.
  const layout = useMemo(() => {
    if (!tl) return null;
    const H = orient === 'horizontal';
    const crossBase  = H ? H_AXIS_Y : V_AXIS_X;
    const stalkBase  = H ? H_STALK_BASE : V_STALK_BASE;
    const stalkStep  = H ? H_STALK_STEP : V_STALK_STEP;
    const crossBoxLen = H ? H_BOX_H : V_BOX_W;

    const maxLane = side => tl.pins.reduce((m, p) => p.side === side ? Math.max(m, p.lane) : m, 0);
    const extentFor = lane => stalkBase + lane * stalkStep + crossBoxLen + 56;
    const aExtent = extentFor(maxLane('a'));
    const bExtent = extentFor(maxLane('b'));

    const axisPos = Math.max(crossBase, aExtent);
    const innerW = H ? tl.timePx + 80 : axisPos + bExtent;
    const innerH = H ? axisPos + bExtent : tl.timePx;

    return { H, axisPos, innerW, innerH };
  }, [tl, orient]);

  useEffect(() => {
    if (!scrollRef.current || !tl || !layout) return;
    const el = scrollRef.current;
    if (layout.H) {
      el.scrollLeft = Math.max(0, tl.todayTop - el.clientWidth / 2);
      el.scrollTop  = Math.max(0, layout.axisPos - el.clientHeight / 2);
    } else {
      el.scrollTop  = Math.max(0, tl.todayTop - el.clientHeight / 2);
      el.scrollLeft = Math.max(0, layout.axisPos - el.clientWidth / 2);
    }
  }, [tl?.todayTop, layout]);

  // When the timeline is smaller than the viewport, center it via margin
  // rather than flex alignment — flex `justify-content: center` on an
  // overflowing child doesn't reliably expose the full scrollable range in
  // every browser, which would make the far end of a big timeline unreachable.
  useEffect(() => {
    if (!scrollRef.current || !innerRef.current || !layout) return;
    const el = scrollRef.current;
    innerRef.current.style.marginLeft = `${Math.max(0, (el.clientWidth - layout.innerW) / 2)}px`;
    innerRef.current.style.marginTop  = `${Math.max(0, (el.clientHeight - layout.innerH) / 2)}px`;
  }, [layout]);

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
          <label className="tl-checkbox">
            <input type="checkbox" checked={showFull} onChange={e => setShowFull(e.target.checked)} />
            Show full timeline
          </label>
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
        {tl && layout && (() => {
          const { H, axisPos, innerW, innerH } = layout;

          return (
            <div className="tl-inner" ref={innerRef} style={{ width: innerW, height: innerH }}>

              {/* Axis — past segment */}
              <div className="tl-axis-past" style={H
                ? { top: axisPos - 2, left: 0, width: Math.min(tl.todayTop, innerW), height: 4 }
                : { left: axisPos - 2, top: 0, height: Math.min(tl.todayTop, innerH), width: 4 }} />
              {/* Axis — future segment */}
              {tl.showToday && (
                <div className="tl-axis-future" style={H
                  ? { top: axisPos - 1, left: tl.todayTop, width: innerW - tl.todayTop, height: 2 }
                  : { left: axisPos - 1, top: tl.todayTop, height: innerH - tl.todayTop, width: 2 }} />
              )}

              {/* Birth marker */}
              {tl.showBirth && (
                <div className={`tl-birth${H ? ' tl-birth--h' : ''}`}
                     style={H ? { left: 4, top: axisPos } : { top: 0, left: axisPos }}>
                  <div className="tl-birth-dot" />
                  <span className={`tl-birth-label${H ? ' tl-birth-label--h' : ''}`}>Born · {fmtDate(birthdate)}</span>
                </div>
              )}

              {/* Year ticks */}
              {tl.yearMarks.map(({ year, age, top, major }) => H ? (
                <div key={year} className={`tl-year tl-year--h${major ? ' tl-year--major' : ''}`}
                     style={{ left: top, top: axisPos }}>
                  <div className="tl-year-tick-h" />
                  <span className="tl-year-num">{year}</span>
                  <span className="tl-year-age">{age}</span>
                </div>
              ) : (
                <div key={year} className={`tl-year${major ? ' tl-year--major' : ''}`} style={{ top }}>
                  <span className="tl-year-num">{year}</span>
                  <span className="tl-year-age">age {age}</span>
                  <div className="tl-year-tick" style={{ left: axisPos - 10 }} />
                </div>
              ))}

              {/* Birthdays */}
              {tl.birthdays.map(({ year, age, top, milestone }) => (
                <div key={`bd-${year}`}
                     className={`tl-birthday${milestone ? ' tl-birthday--big' : ''}`}
                     style={H ? { left: top, top: axisPos + 14, transform: 'translateX(-50%)' } : { top, left: axisPos + 10 }}
                     title={`Birthday — Age ${age}`}>
                  🎂{milestone && <span className="tl-bd-label">Age {age}</span>}
                </div>
              ))}

              {/* Today */}
              {tl.showToday && (H ? (
                <div className="tl-today tl-today--h" style={{ left: tl.todayTop }}>
                  <div className="tl-today-line-v" style={{ height: innerH }} />
                  <span className="tl-today-label" style={{ top: axisPos + 14, left: 6 }}>
                    Today · Age {today.getFullYear() - birthDate.getFullYear()}
                  </span>
                </div>
              ) : (
                <div className="tl-today" style={{ top: tl.todayTop }}>
                  <div className="tl-today-line" style={{ width: innerW }} />
                  <span className="tl-today-label" style={{ left: axisPos + 14 }}>
                    Today · Age {today.getFullYear() - birthDate.getFullYear()}
                  </span>
                </div>
              ))}

              {/* Pins */}
              {tl.pins.map(item => {
                const isA    = item.side === 'a';
                const sLen   = (H ? H_STALK_BASE : V_STALK_BASE) + item.lane * (H ? H_STALK_STEP : V_STALK_STEP);
                const color  = item.tags?.length ? tc(item.tags[0]) : '#6060a0';
                const isSel  = selectedItem?.id === item.id;
                const spanLen = Math.max(0, item.endPx - item.px);
                const full   = showFull && !!item.end_date && spanLen > 0;
                const boxLen = full ? Math.max(spanLen, 40) : (H ? H_BOX_W : V_BOX_W);
                const alongEnd = item.px + boxLen;

                const dotStyle    = H ? { left: item.px - DOT_R, top: axisPos - DOT_R }
                                      : { top: item.px - DOT_R,  left: axisPos - DOT_R };
                const dotEndStyle = H ? { left: alongEnd - DOT_R, top: axisPos - DOT_R }
                                      : { top: alongEnd - DOT_R,  left: axisPos - DOT_R };
                const stalkStyle    = H ? { left: item.px - 1, top: isA ? axisPos - sLen : axisPos, width: 2, height: sLen }
                                        : { top: item.px - 1,  left: isA ? axisPos - sLen : axisPos, height: 2, width: sLen };
                const stalkEndStyle = H ? { left: alongEnd - 1, top: isA ? axisPos - sLen : axisPos, width: 2, height: sLen }
                                        : { top: alongEnd - 1,  left: isA ? axisPos - sLen : axisPos, height: 2, width: sLen };

                const boxCrossStyle = H
                  ? { top: isA ? axisPos - sLen - H_BOX_H : axisPos + sLen }
                  : { left: isA ? axisPos - sLen - V_BOX_W : axisPos + sLen, width: V_BOX_W };
                const boxAlongStyle = H
                  ? (full ? { left: item.px, width: boxLen } : { left: Math.max(4, item.px - H_BOX_W / 2), width: H_BOX_W })
                  : (full ? { top: item.px, height: boxLen } : { top: Math.max(4, item.px - V_BOX_H / 2) });
                const boxStyle = { ...boxCrossStyle, ...boxAlongStyle };

                const spanStyle  = H ? { left: item.px, top: axisPos - 3, width: spanLen, height: 6 }
                                     : { top: item.px,  left: axisPos - 3, height: spanLen, width: 6 };

                return (
                  <Fragment key={item.id}>
                    {isSel && spanLen > 0 && (
                      <div className="tl-span" style={{ ...spanStyle, background: color }} />
                    )}
                    <div className="tl-pin-dot"   style={{ ...dotStyle,   background: color }} />
                    {full && <div className="tl-pin-dot" style={{ ...dotEndStyle, background: color }} />}
                    <div className="tl-pin-stalk" style={{ ...stalkStyle, background: color }} />
                    {full && <div className="tl-pin-stalk" style={{ ...stalkEndStyle, background: color }} />}
                    <div
                      className={`tl-pin-box${isSel ? ' tl-pin-box--open' : ''}${full ? ' tl-pin-box--full' : ''}`}
                      style={{ ...boxStyle, '--ic': color }}
                      onClick={e => { e.stopPropagation(); setSelectedItem(isSel ? null : item); }}
                    >
                      <div className="tl-pin-title">{item.title}</div>
                      {isSel && (
                        <div className="tl-pin-detail">
                          {item.tags.length > 0 && (
                            <div className="tl-pin-tags">
                              {item.tags.map(t => <span key={t} className="tl-chip tl-chip--sm" style={{ '--tc': tc(t) }}>{t}</span>)}
                            </div>
                          )}
                          <div className="tl-pin-dates">
                            {fmtDate(item.start_date)}{item.end_date ? ` → ${fmtDate(item.end_date)}` : ' → Present'}
                          </div>
                          {item.description && <div className="tl-pin-desc">{item.description}</div>}
                          {item.image && <div className="tl-pin-img"><img src={item.image} alt={item.title} /></div>}
                          <div className="tl-pin-btns">
                            <button onClick={e => { e.stopPropagation(); setEditingItem(item); setSelectedItem(null); setShowForm(true); }}>✎ Edit</button>
                            <button className="tl-pin-del" onClick={e => { e.stopPropagation(); deleteItem(item.id); }}>× Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
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

