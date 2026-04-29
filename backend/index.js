const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

// Spotify token cache — token lasts 1 hour, refresh 5 min early
let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured');
  }

  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  return spotifyToken;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// GET all visits
app.get('/api/visits', (req, res) => {
  const visits = db.prepare('SELECT * FROM visits ORDER BY year ASC').all();
  res.json(visits);
});

// POST new visit
app.post('/api/visits', (req, res) => {
  const { country, state, year } = req.body;
  if (!country || !year) {
    return res.status(400).json({ error: 'country and year required' });
  }
  const result = db.prepare(
    'INSERT INTO visits (country, state, year) VALUES (?, ?, ?)'
  ).run(country, state || null, year);
  res.status(201).json({ id: result.lastInsertRowid, country, state, year });
});

// DELETE a visit
app.delete('/api/visits/:id', (req, res) => {
  db.prepare('DELETE FROM visits WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// GET Spotify artist image by name
app.get('/api/spotify/artist', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name query param required' });

  try {
    const token = await getSpotifyToken();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(r.status).json({ error: 'Spotify search failed' });

    const data = await r.json();
    const artist = data.artists?.items?.[0];
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    // Images are sorted largest first; pick smallest available for thumbnail
    const images = artist.images || [];
    const image = images[images.length - 1] || images[0] || null;

    res.json({
      id: artist.id,
      name: artist.name,
      image_url: image?.url || null,
      image_width: image?.width || null,
      image_height: image?.height || null,
      genres: artist.genres,
      popularity: artist.popularity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to frontend for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
