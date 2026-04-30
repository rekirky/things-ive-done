import { useState, useMemo, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import VisitModal from './VisitModal.jsx';
import './WorldMap.css';

const WORLD_URL = '/custom.geo-hr.json';
const US_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const AUS_URL = '/aus-states.geojson';

const US_STATE_NAMES = {
  '01':'Alabama','02':'Alaska','04':'Arizona','05':'Arkansas','06':'California',
  '08':'Colorado','09':'Connecticut','10':'Delaware','11':'District of Columbia',
  '12':'Florida','13':'Georgia','15':'Hawaii','16':'Idaho','17':'Illinois',
  '18':'Indiana','19':'Iowa','20':'Kansas','21':'Kentucky','22':'Louisiana',
  '23':'Maine','24':'Maryland','25':'Massachusetts','26':'Michigan','27':'Minnesota',
  '28':'Mississippi','29':'Missouri','30':'Montana','31':'Nebraska','32':'Nevada',
  '33':'New Hampshire','34':'New Jersey','35':'New Mexico','36':'New York',
  '37':'North Carolina','38':'North Dakota','39':'Ohio','40':'Oklahoma',
  '41':'Oregon','42':'Pennsylvania','44':'Rhode Island','45':'South Carolina',
  '46':'South Dakota','47':'Tennessee','48':'Texas','49':'Utah','50':'Vermont',
  '51':'Virginia','53':'Washington','54':'West Virginia','55':'Wisconsin','56':'Wyoming',
  '72':'Puerto Rico','78':'U.S. Virgin Islands',
};

const CONTINENTS = {
  'Africa':        { visited: '#d4a017', unvisited: '#2d2508' },
  'Asia':          { visited: '#e07b39', unvisited: '#2d1a0a' },
  'Europe':        { visited: '#4a90d9', unvisited: '#0e2035' },
  'North America': { visited: '#27ae60', unvisited: '#0a2010' },
  'South America': { visited: '#8e44ad', unvisited: '#1e0a2a' },
  'Oceania':       { visited: '#16a085', unvisited: '#071e18' },
};

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8)  & 0xff) + 40);
  const b = Math.min(255, ( n        & 0xff) + 40);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function WorldMap({ visits, onRefresh, onAdminOpen }) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, lines: [] });
  const [clickTarget, setClickTarget] = useState(null);

  const visitMap = useMemo(() => {
    const map = {};
    visits.forEach(v => {
      const key = v.state ? `${v.country}::${v.state}` : v.country;
      if (!map[key]) map[key] = [];
      map[key].push(v.year);
    });
    return map;
  }, [visits]);

  const visitedCountries = useMemo(() => new Set(visits.map(v => v.country)), [visits]);

  // Continent stats: total and visited per continent
  const continentStats = useMemo(() => {
    const stats = {};
    Object.keys(CONTINENTS).forEach(c => { stats[c] = { total: 0, visited: 0 }; });

    Object.entries(numericToContinent).forEach(([id, continent]) => {
      if (!stats[continent]) return;
      const name = numericToName[parseInt(id)];
      if (!name) return;
      stats[continent].total += 1;
      // Normalise USA name mismatch
      const lookupName = name === 'United States of America' ? 'United States' : name;
      if (visitedCountries.has(lookupName) || visitedCountries.has(name)) {
        stats[continent].visited += 1;
      }
    });
    return stats;
  }, [visitedCountries]);

  const showTooltip = useCallback((e, name, years) => {
    setTooltip({
      visible: true,
      x: e.clientX + 12,
      y: e.clientY - 10,
      lines: years?.length ? [name, [...new Set(years)].sort().join(', ')] : [name],
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(t => ({ ...t, visible: false })), []);

  const geoStyle = {
    default: { outline: 'none', transition: 'fill 0.15s' },
    hover:   { outline: 'none', cursor: 'pointer' },
    pressed: { outline: 'none' },
  };

  const getFill = (continent, visited) =>
    CONTINENTS[continent]?.[visited ? 'visited' : 'unvisited'] ?? (visited ? '#e94560' : '#2a2a2a');

  const getHoverFill = (continent, visited) =>
    lighten(getFill(continent, visited));

  return (
    <div className="map-container">
      <button className="map-gear-btn" onClick={onAdminOpen} title="Admin">⚙</button>

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 160 }}
        style={{ width: '100%', height: 'calc(100vh - 64px)' }}
      >
        <ZoomableGroup>

          <Geographies geography={WORLD_URL}>
            {({ geographies }) => geographies.map(geo => {
              const numId = parseInt(geo.properties?.iso_n3);
              const name = numericToName[numId];
              const continent = numericToContinent[numId];

              if (name === 'United States of America' || name === 'Australia') return null;
              if (!name || !continent) {
                return (
                  <Geography key={geo.rsmKey} geography={geo}
                    fill="#222" stroke="#1a1a2e" strokeWidth={0.5} style={geoStyle} />
                );
              }

              const visited = visitedCountries.has(name);
              const years = visitMap[name];
              const fill = getFill(continent, visited);
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  fill={fill} stroke="#1a1a2e" strokeWidth={0.5}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: getHoverFill(continent, visited) } }}
                  onMouseMove={e => showTooltip(e, name, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: name, state: null, displayName: name })}
                />
              );
            })}
          </Geographies>

          <Geographies geography={US_URL}>
            {({ geographies }) => geographies.map(geo => {
              const fips = String(geo.id).padStart(2, '0');
              const stateName = US_STATE_NAMES[fips];
              if (!stateName) return null;
              const key = `United States::${stateName}`;
              const years = visitMap[key];
              const visited = Boolean(years);
              const fill = getFill('North America', visited);
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  fill={fill} stroke="#1a1a2e" strokeWidth={0.3}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: getHoverFill('North America', visited) } }}
                  onMouseMove={e => showTooltip(e, `${stateName}, USA`, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: 'United States', state: stateName, displayName: `${stateName}, USA` })}
                />
              );
            })}
          </Geographies>

          <Geographies geography={AUS_URL}>
            {({ geographies }) => geographies.map(geo => {
              const stateName = geo.properties?.STATE_NAME;
              if (!stateName) return null;
              const key = `Australia::${stateName}`;
              const years = visitMap[key];
              const visited = Boolean(years);
              const fill = getFill('Oceania', visited);
              return (
                <Geography
                  key={geo.rsmKey} geography={geo}
                  fill={fill} stroke="#1a1a2e" strokeWidth={0.3}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: getHoverFill('Oceania', visited) } }}
                  onMouseMove={e => showTooltip(e, `${stateName}, Australia`, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: 'Australia', state: stateName, displayName: `${stateName}, Australia` })}
                />
              );
            })}
          </Geographies>

        </ZoomableGroup>
      </ComposableMap>

      <ContinentPanel stats={continentStats} />

      {tooltip.visible && (
        <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {clickTarget && (
        <VisitModal
          {...clickTarget}
          onSave={() => { setClickTarget(null); onRefresh(); }}
          onClose={() => setClickTarget(null)}
        />
      )}
    </div>
  );
}

function ContinentPanel({ stats }) {
  return (
    <div className="continent-panel">
      {Object.entries(CONTINENTS).map(([name, colors]) => {
        const { total, visited } = stats[name] || { total: 0, visited: 0 };
        const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
        return (
          <div key={name} className="continent-row">
            <div className="continent-row__label" style={{ color: colors.visited }}>{name}</div>
            <div className="continent-row__bar-wrap">
              <div className="continent-row__bar-bg">
                <div
                  className="continent-row__bar-fill"
                  style={{ width: `${pct}%`, background: colors.visited }}
                />
              </div>
            </div>
            <div className="continent-row__nums">
              <span>{visited}/{total}</span>
              <span className="continent-row__pct">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const numericToName = {
  4:'Afghanistan', 8:'Albania', 12:'Algeria', 20:'Andorra', 24:'Angola',
  28:'Antigua and Barbuda', 32:'Argentina', 36:'Australia', 40:'Austria',
  51:'Armenia', 31:'Azerbaijan', 44:'Bahamas', 48:'Bahrain', 50:'Bangladesh',
  52:'Barbados', 56:'Belgium', 84:'Belize', 204:'Benin', 64:'Bhutan', 68:'Bolivia',
  70:'Bosnia and Herzegovina', 72:'Botswana', 76:'Brazil', 96:'Brunei',
  100:'Bulgaria', 854:'Burkina Faso', 108:'Burundi', 132:'Cabo Verde',
  116:'Cambodia', 120:'Cameroon', 124:'Canada', 140:'Central African Republic',
  148:'Chad', 152:'Chile', 156:'China', 170:'Colombia', 174:'Comoros',
  178:'Congo', 180:'Democratic Republic of the Congo', 188:'Costa Rica',
  384:'Ivory Coast', 191:'Croatia', 192:'Cuba', 196:'Cyprus', 203:'Czech Republic',
  208:'Denmark', 262:'Djibouti', 212:'Dominica', 214:'Dominican Republic',
  218:'Ecuador', 818:'Egypt', 222:'El Salvador', 226:'Equatorial Guinea',
  232:'Eritrea', 233:'Estonia', 231:'Ethiopia', 242:'Fiji', 246:'Finland',
  250:'France', 266:'Gabon', 270:'Gambia', 268:'Georgia', 276:'Germany',
  288:'Ghana', 300:'Greece', 308:'Grenada', 320:'Guatemala', 324:'Guinea',
  624:'Guinea-Bissau', 328:'Guyana', 332:'Haiti', 340:'Honduras', 348:'Hungary',
  356:'India', 360:'Indonesia', 364:'Iran', 368:'Iraq', 372:'Ireland',
  376:'Israel', 380:'Italy', 388:'Jamaica', 392:'Japan', 400:'Jordan',
  398:'Kazakhstan', 404:'Kenya', 296:'Kiribati', 408:'North Korea',
  410:'South Korea', 414:'Kuwait', 417:'Kyrgyzstan', 418:'Laos', 428:'Latvia',
  422:'Lebanon', 426:'Lesotho', 430:'Liberia', 434:'Libya', 438:'Liechtenstein',
  440:'Lithuania', 442:'Luxembourg', 450:'Madagascar', 454:'Malawi',
  458:'Malaysia', 462:'Maldives', 466:'Mali', 470:'Malta', 584:'Marshall Islands',
  478:'Mauritania', 480:'Mauritius', 484:'Mexico', 583:'Micronesia',
  498:'Moldova', 492:'Monaco', 496:'Mongolia', 499:'Montenegro', 504:'Morocco',
  508:'Mozambique', 104:'Myanmar', 516:'Namibia', 520:'Nauru', 524:'Nepal',
  528:'Netherlands', 554:'New Zealand', 558:'Nicaragua', 562:'Niger',
  566:'Nigeria', 807:'North Macedonia', 578:'Norway', 512:'Oman',
  586:'Pakistan', 585:'Palau', 275:'Palestine', 591:'Panama',
  598:'Papua New Guinea', 600:'Paraguay', 604:'Peru', 608:'Philippines',
  616:'Poland', 620:'Portugal', 634:'Qatar', 642:'Romania', 643:'Russia',
  646:'Rwanda', 659:'Saint Kitts and Nevis', 662:'Saint Lucia',
  670:'Saint Vincent and the Grenadines', 882:'Samoa', 674:'San Marino',
  678:'São Tomé and Príncipe', 682:'Saudi Arabia', 686:'Senegal', 688:'Serbia',
  690:'Seychelles', 694:'Sierra Leone', 702:'Singapore', 703:'Slovakia',
  705:'Slovenia', 90:'Solomon Islands', 706:'Somalia', 710:'South Africa',
  728:'South Sudan', 724:'Spain', 144:'Sri Lanka', 729:'Sudan', 740:'Suriname',
  748:'Eswatini', 752:'Sweden', 756:'Switzerland', 760:'Syria', 762:'Tajikistan',
  834:'Tanzania', 764:'Thailand', 626:'Timor-Leste', 768:'Togo', 776:'Tonga',
  780:'Trinidad and Tobago', 788:'Tunisia', 792:'Turkey', 795:'Turkmenistan',
  798:'Tuvalu', 800:'Uganda', 804:'Ukraine', 784:'United Arab Emirates',
  826:'United Kingdom', 840:'United States of America', 858:'Uruguay',
  860:'Uzbekistan', 548:'Vanuatu', 862:'Venezuela', 704:'Vietnam',
  887:'Yemen', 894:'Zambia', 716:'Zimbabwe', 895:'Kosovo', 112:'Belarus',
  352:'Iceland', 372:'Ireland',
};

const numericToContinent = {
  // Africa
  12:'Africa', 24:'Africa', 204:'Africa', 72:'Africa', 854:'Africa', 108:'Africa',
  132:'Africa', 120:'Africa', 140:'Africa', 148:'Africa', 174:'Africa', 178:'Africa',
  180:'Africa', 262:'Africa', 818:'Africa', 226:'Africa', 232:'Africa', 748:'Africa',
  231:'Africa', 266:'Africa', 270:'Africa', 288:'Africa', 324:'Africa', 624:'Africa',
  384:'Africa', 404:'Africa', 426:'Africa', 430:'Africa', 434:'Africa', 450:'Africa',
  454:'Africa', 466:'Africa', 478:'Africa', 480:'Africa', 504:'Africa', 508:'Africa',
  516:'Africa', 562:'Africa', 566:'Africa', 646:'Africa', 678:'Africa', 686:'Africa',
  690:'Africa', 694:'Africa', 706:'Africa', 710:'Africa', 728:'Africa', 729:'Africa',
  834:'Africa', 768:'Africa', 788:'Africa', 800:'Africa', 894:'Africa', 716:'Africa',
  706:'Africa', 710:'Africa',
  // Asia
  4:'Asia', 51:'Asia', 31:'Asia', 48:'Asia', 50:'Asia', 64:'Asia', 96:'Asia',
  116:'Asia', 156:'Asia', 196:'Asia', 268:'Asia', 356:'Asia', 360:'Asia', 364:'Asia',
  368:'Asia', 376:'Asia', 392:'Asia', 400:'Asia', 398:'Asia', 414:'Asia', 417:'Asia',
  418:'Asia', 422:'Asia', 458:'Asia', 462:'Asia', 496:'Asia', 104:'Asia', 524:'Asia',
  408:'Asia', 410:'Asia', 512:'Asia', 586:'Asia', 275:'Asia', 608:'Asia', 634:'Asia',
  682:'Asia', 702:'Asia', 144:'Asia', 760:'Asia', 762:'Asia', 764:'Asia', 626:'Asia',
  792:'Asia', 795:'Asia', 784:'Asia', 860:'Asia', 704:'Asia', 887:'Asia',
  // Europe
  8:'Europe', 20:'Europe', 40:'Europe', 112:'Europe', 56:'Europe', 70:'Europe',
  100:'Europe', 191:'Europe', 203:'Europe', 208:'Europe', 233:'Europe', 246:'Europe',
  250:'Europe', 276:'Europe', 300:'Europe', 348:'Europe', 352:'Europe', 372:'Europe',
  380:'Europe', 895:'Europe', 428:'Europe', 438:'Europe', 440:'Europe', 442:'Europe',
  470:'Europe', 498:'Europe', 492:'Europe', 499:'Europe', 528:'Europe', 807:'Europe',
  578:'Europe', 616:'Europe', 620:'Europe', 642:'Europe', 643:'Europe', 674:'Europe',
  688:'Europe', 703:'Europe', 705:'Europe', 724:'Europe', 752:'Europe', 756:'Europe',
  804:'Europe', 826:'Europe',
  // North America
  28:'North America', 44:'North America', 52:'North America', 84:'North America',
  124:'North America', 188:'North America', 192:'North America', 212:'North America',
  214:'North America', 222:'North America', 308:'North America', 320:'North America',
  332:'North America', 340:'North America', 388:'North America', 484:'North America',
  558:'North America', 591:'North America', 659:'North America', 662:'North America',
  670:'North America', 780:'North America', 840:'North America',
  // South America
  32:'South America', 68:'South America', 76:'South America', 152:'South America',
  170:'South America', 218:'South America', 328:'South America', 600:'South America',
  604:'South America', 740:'South America', 858:'South America', 862:'South America',
  // Oceania
  36:'Oceania', 242:'Oceania', 296:'Oceania', 584:'Oceania', 583:'Oceania',
  520:'Oceania', 554:'Oceania', 585:'Oceania', 598:'Oceania', 882:'Oceania',
  90:'Oceania', 776:'Oceania', 798:'Oceania', 548:'Oceania',
};
