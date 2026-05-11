import { useState, useEffect } from 'react';
import WorldMap from './components/WorldMap.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import BandsSeen from './components/BandsSeen.jsx';
import MyTimeline from './components/MyTimeline.jsx';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('bands');
  const [visits, setVisits] = useState([]);

  const fetchVisits = () =>
    fetch('/api/visits').then(r => r.json()).then(setVisits);

  useEffect(() => { fetchVisits(); }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Things I've Done</h1>
        <nav>
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Places I've Been</button>
          <button className={tab === 'bands' ? 'active' : ''} onClick={() => setTab('bands')}>Bands I've Seen</button>
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>My Timeline</button>
        </nav>
      </header>
      <main className="main">
        {tab === 'map' && <WorldMap visits={visits} onRefresh={fetchVisits} onAdminOpen={() => setTab('admin')} />}
        {tab === 'admin' && <AdminPanel visits={visits} onRefresh={fetchVisits} />}
        {tab === 'bands' && <BandsSeen />}
        {tab === 'timeline' && <MyTimeline />}
      </main>
    </div>
  );
}
