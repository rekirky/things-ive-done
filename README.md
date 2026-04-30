# Things I've Done

A personal dashboard for tracking life experiences.

## Places I've Been

An interactive world map showing countries and territories visited.

- Countries coloured by continent; visited places light up in their continent colour
- USA and Australia broken down to state/territory level
- Hover any country or state for a tooltip showing the year(s) visited
- Zoom controls (buttons or scroll wheel) and click-drag to pan
- Continent panel showing visited/total count and percentage per continent
- Click a country to log a visit (country, optional state, year)

## Bands I've Seen

A card-based catalogue of live concerts attended.

- Spotify integration automatically pulls artist images and genres when adding a concert
- Filter by who attended (Jon, Mel, Adam, Tegan, or custom names)
- Sort by newest, oldest, or alphabetically
- Each card links to the artist's Spotify profile
- Add, edit, and delete concert entries

## Deployment

Self-hosted via Docker Compose. Images are built and pushed automatically via GitHub Actions on every push to `main`.

```bash
docker compose up -d
```

Frontend: port `6800` · Backend API: port `6801`
