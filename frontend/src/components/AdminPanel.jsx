import { useState } from 'react';
import './AdminPanel.css';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
  'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
  'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming','Puerto Rico','U.S. Virgin Islands'
];

const AUS_STATES = [
  'New South Wales','Victoria','Queensland','South Australia',
  'Western Australia','Tasmania','Northern Territory','Australian Capital Territory'
];

const COUNTRIES_WITH_STATES = ['United States', 'Australia'];

export default function AdminPanel({ visits, onRefresh }) {
  const [form, setForm] = useState({ country: '', state: '', year: new Date().getFullYear() });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const stateOptions = form.country === 'United States' ? US_STATES
    : form.country === 'Australia' ? AUS_STATES : [];

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.country || !form.year) { setError('Country and year required'); return; }
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) { setError('Failed to save'); return; }
    setForm({ country: '', state: '', year: new Date().getFullYear() });
    onRefresh();
  };

  const handleDelete = async id => {
    await fetch(`/api/visits/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const filtered = visits.filter(v =>
    !filter || v.country.toLowerCase().includes(filter.toLowerCase()) ||
    (v.state && v.state.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="admin">
      <section className="admin-form">
        <h2>Add Visit</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Country</label>
            <input
              type="text"
              list="country-list"
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value, state: '' }))}
              placeholder="e.g. France"
              required
            />
            <datalist id="country-list">
              {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {COUNTRIES_WITH_STATES.includes(form.country) && (
            <div className="field">
              <label>State / Territory</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                <option value="">— select —</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label>Year</label>
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-add">Add</button>
        </form>
      </section>

      <section className="admin-table">
        <div className="table-header">
          <h2>Visits ({visits.length})</h2>
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>ID</th><th>Country</th><th>State</th><th>Year</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.country}</td>
                  <td>{v.state || '—'}</td>
                  <td>{v.year}</td>
                  <td>
                    <button className="btn-delete" onClick={() => handleDelete(v.id)}>×</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty">No entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const COMMON_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Angola','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Bolivia','Brazil','Bulgaria','Cambodia','Cameroon','Canada',
  'Chile','China','Colombia','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Ecuador','Egypt','El Salvador','Ethiopia','Finland','France','Germany',
  'Ghana','Greece','Guatemala','Haiti','Honduras','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','South Korea','North Korea','Kuwait','Laos','Lebanon','Libya','Luxembourg',
  'Mexico','Morocco','Mozambique','Nepal','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Saudi Arabia','Senegal','Sierra Leone','Slovakia',
  'Slovenia','Somalia','South Africa','Spain','Sudan','Sweden','Switzerland','Syria',
  'Thailand','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uruguay','Venezuela','Vietnam','Yemen','Zimbabwe',
];
