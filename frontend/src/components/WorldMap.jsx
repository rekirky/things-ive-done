import { useState, useMemo, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import VisitModal from './VisitModal.jsx';
import './WorldMap.css';

// World and US data from CDN (world-atlas, us-atlas)
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const US_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
// Australian state boundaries: georgique/world-geojson (GPL-3.0)
// https://github.com/georgique/world-geojson
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

export default function WorldMap({ visits, onRefresh }) {
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

  return (
    <div className="map-container">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 160 }}
        style={{ width: '100%', height: 'calc(100vh - 64px)' }}
      >
        <ZoomableGroup>

          {/* World countries */}
          <Geographies geography={WORLD_URL}>
            {({ geographies }) => geographies.map(geo => {
              const name = numericToName[geo.id];
              if (!name) return null;
              if (name === 'United States of America' || name === 'Australia') return null;
              const years = visitMap[name];
              const fill = visitedCountries.has(name) ? '#e94560' : '#444';
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#1a1a2e"
                  strokeWidth={0.5}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: years ? '#c0392b' : '#666' } }}
                  onMouseMove={e => showTooltip(e, name, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: name, state: null, displayName: name })}
                />
              );
            })}
          </Geographies>

          {/* US states */}
          <Geographies geography={US_URL}>
            {({ geographies }) => geographies.map(geo => {
              const fips = String(geo.id).padStart(2, '0');
              const stateName = US_STATE_NAMES[fips];
              if (!stateName) return null;
              const key = `United States::${stateName}`;
              const years = visitMap[key];
              const fill = years ? '#e94560' : '#444';
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#1a1a2e"
                  strokeWidth={0.3}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: years ? '#c0392b' : '#666' } }}
                  onMouseMove={e => showTooltip(e, `${stateName}, USA`, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: 'United States', state: stateName, displayName: `${stateName}, USA` })}
                />
              );
            })}
          </Geographies>

          {/* Australian states — georgique/world-geojson (GPL-3.0) */}
          <Geographies geography={AUS_URL}>
            {({ geographies }) => geographies.map(geo => {
              const stateName = geo.properties?.STATE_NAME;
              if (!stateName) return null;
              const key = `Australia::${stateName}`;
              const years = visitMap[key];
              const fill = years ? '#e94560' : '#444';
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#1a1a2e"
                  strokeWidth={0.3}
                  style={{ ...geoStyle, hover: { ...geoStyle.hover, fill: years ? '#c0392b' : '#666' } }}
                  onMouseMove={e => showTooltip(e, `${stateName}, Australia`, years)}
                  onMouseLeave={hideTooltip}
                  onClick={() => setClickTarget({ country: 'Australia', state: stateName, displayName: `${stateName}, Australia` })}
                />
              );
            })}
          </Geographies>

        </ZoomableGroup>
      </ComposableMap>

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

const numericToName = {
  4:'Afghanistan',8:'Albania',12:'Algeria',24:'Angola',32:'Argentina',36:'Australia',
  40:'Austria',50:'Bangladesh',56:'Belgium',64:'Bhutan',68:'Bolivia',76:'Brazil',
  100:'Bulgaria',104:'Myanmar',116:'Cambodia',120:'Cameroon',124:'Canada',
  144:'Sri Lanka',152:'Chile',156:'China',170:'Colombia',188:'Costa Rica',
  191:'Croatia',192:'Cuba',196:'Cyprus',203:'Czech Republic',208:'Denmark',
  218:'Ecuador',818:'Egypt',222:'El Salvador',231:'Ethiopia',246:'Finland',
  250:'France',276:'Germany',288:'Ghana',300:'Greece',320:'Guatemala',
  332:'Haiti',340:'Honduras',348:'Hungary',356:'India',360:'Indonesia',
  364:'Iran',368:'Iraq',372:'Ireland',376:'Israel',380:'Italy',388:'Jamaica',
  392:'Japan',400:'Jordan',398:'Kazakhstan',404:'Kenya',410:'South Korea',
  408:'North Korea',414:'Kuwait',418:'Laos',422:'Lebanon',430:'Liberia',
  434:'Libya',442:'Luxembourg',484:'Mexico',504:'Morocco',508:'Mozambique',
  524:'Nepal',528:'Netherlands',554:'New Zealand',566:'Nigeria',578:'Norway',
  586:'Pakistan',591:'Panama',600:'Paraguay',604:'Peru',608:'Philippines',
  616:'Poland',620:'Portugal',634:'Qatar',642:'Romania',643:'Russia',
  682:'Saudi Arabia',686:'Senegal',694:'Sierra Leone',703:'Slovakia',
  705:'Slovenia',706:'Somalia',710:'South Africa',724:'Spain',729:'Sudan',
  752:'Sweden',756:'Switzerland',760:'Syria',764:'Thailand',792:'Turkey',
  800:'Uganda',804:'Ukraine',784:'United Arab Emirates',826:'United Kingdom',
  840:'United States of America',858:'Uruguay',862:'Venezuela',704:'Vietnam',
  887:'Yemen',716:'Zimbabwe',895:'Kosovo',499:'Montenegro',688:'Serbia',
  807:'North Macedonia',70:'Bosnia and Herzegovina',112:'Belarus',
  440:'Lithuania',428:'Latvia',233:'Estonia',
};
