import { useState, useEffect } from 'react';
import WorldMap from './components/WorldMap.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('map');
  const [visits, setVisits] = useState([]);

  const fetchVisits = () =>
    fetch('/api/visits').then(r => r.json()).then(setVisits);

  useEffect(() => { fetchVisits(); }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Things I've Done</h1>
        <nav>
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map</button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
        </nav>
      </header>
      <main className="main">
        {tab === 'map'
          ? <WorldMap visits={visits} onRefresh={fetchVisits} />
          : <AdminPanel visits={visits} onRefresh={fetchVisits} />}
      </main>
    </div>
  );
}
