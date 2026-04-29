const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

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

// Fallback to frontend for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
