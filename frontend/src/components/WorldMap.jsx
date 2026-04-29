import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import VisitModal from './VisitModal.jsx';
import './WorldMap.css';

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const US_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const AUS_URL = '/aus-states-topo.json';

// ISO numeric -> country name mapping (subset covering likely visited countries)
// Full mapping loaded from world-atlas properties
const US_NUMERIC = '840';
const AUS_NUMERIC = '36';

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
  '72':'Puerto Rico','78':'U.S. Virgin Islands'
};

const AUS_STATE_NAMES = {
  'NSW':'New South Wales','VIC':'Victoria','QLD':'Queensland','SA':'South Australia',
  'WA':'Western Australia','TAS':'Tasmania','NT':'Northern Territory','ACT':'Australian Capital Territory'
};

export default function WorldMap({ visits, onRefresh }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [topoData, setTopoData] = useState(null);
  const [clickTarget, setClickTarget] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(WORLD_URL).then(r => r.json()),
      fetch(US_URL).then(r => r.json()),
      fetch(AUS_URL).then(r => r.json()).catch(() => null),
    ]).then(([world, us, ausGeo]) => setTopoData({ world, us, ausGeo }));
  }, []);

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
      content: years?.length
        ? `${name}\n${[...new Set(years)].sort().join(', ')}`
        : name,
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(t => ({ ...t, visible: false })), []);

  useEffect(() => {
    if (!topoData || !svgRef.current) return;

    const { world, us, ausGeo } = topoData;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 960;
    const height = svgRef.current.clientHeight || 500;

    const projection = d3.geoNaturalEarth1()
      .scale(width / 6.3)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const countries = topojson.feature(world, world.objects.countries);

    // Country name lookup via d3.json countries-110m doesn't include names;
    // use a bundled numeric->name map
    const numericToName = getNumericToName();

    const g = svg.append('g');

    // Draw world countries
    g.selectAll('.country')
      .data(countries.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', d => {
        const name = numericToName[d.id];
        if (!name) return '#444';
        if (name === 'United States of America') return visitedCountries.has('United States') ? '#2a5298' : '#444';
        if (name === 'Australia') return visitedCountries.has('Australia') ? '#2a5298' : '#444';
        return visitedCountries.has(name) ? '#e94560' : '#444';
      })
      .attr('stroke', '#1a1a2e')
      .attr('stroke-width', 0.5)
      .on('mousemove', (event, d) => {
        const name = numericToName[d.id];
        if (!name) return;
        if (name === 'United States of America' || name === 'Australia') return;
        const years = visitMap[name];
        showTooltip(event, name, years);
      })
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => {
        const name = numericToName[d.id];
        if (!name || name === 'United States of America' || name === 'Australia') return;
        setClickTarget({ country: name, state: null, displayName: name });
      });

    // Draw US states over USA
    if (us) {
      const usStates = topojson.feature(us, us.objects.states);
      g.selectAll('.us-state')
        .data(usStates.features)
        .join('path')
        .attr('class', 'us-state')
        .attr('d', path)
        .attr('fill', d => {
          const fips = String(d.id).padStart(2, '0');
          const stateName = US_STATE_NAMES[fips];
          const key = stateName ? `United States::${stateName}` : null;
          return key && visitMap[key] ? '#e94560' : '#444';
        })
        .attr('stroke', '#1a1a2e')
        .attr('stroke-width', 0.3)
        .on('mousemove', (event, d) => {
          const fips = String(d.id).padStart(2, '0');
          const stateName = US_STATE_NAMES[fips] || 'Unknown';
          const years = visitMap[`United States::${stateName}`];
          showTooltip(event, `${stateName}, USA`, years);
        })
        .on('mouseleave', hideTooltip)
        .on('click', (event, d) => {
          const fips = String(d.id).padStart(2, '0');
          const stateName = US_STATE_NAMES[fips];
          if (!stateName) return;
          setClickTarget({ country: 'United States', state: stateName, displayName: `${stateName}, USA` });
        });
    }

    // Draw Australian states
    if (ausGeo) {
      const ausFeatures = ausGeo.type === 'Topology'
        ? topojson.feature(ausGeo, ausGeo.objects[Object.keys(ausGeo.objects)[0]]).features
        : ausGeo.type === 'FeatureCollection'
          ? ausGeo.features
          : [];
      g.selectAll('.aus-state')
        .data(ausFeatures)
        .join('path')
        .attr('class', 'aus-state')
        .attr('d', path)
        .attr('fill', d => {
          const abbr = d.properties?.STATE_CODE || d.properties?.ste_code21 || d.id;
          const stateName = AUS_STATE_NAMES[abbr] || d.properties?.STATE_NAME || d.properties?.ste_name21;
          const key = stateName ? `Australia::${stateName}` : null;
          return key && visitMap[key] ? '#e94560' : '#444';
        })
        .attr('stroke', '#1a1a2e')
        .attr('stroke-width', 0.3)
        .on('mousemove', (event, d) => {
          const abbr = d.properties?.STATE_CODE || d.properties?.ste_code21 || d.id;
          const stateName = AUS_STATE_NAMES[abbr] || d.properties?.STATE_NAME || d.properties?.ste_name21 || 'Unknown';
          const years = visitMap[`Australia::${stateName}`];
          showTooltip(event, `${stateName}, Australia`, years);
        })
        .on('mouseleave', hideTooltip)
        .on('click', (event, d) => {
          const abbr = d.properties?.STATE_CODE || d.properties?.ste_code21 || d.id;
          const stateName = AUS_STATE_NAMES[abbr] || d.properties?.STATE_NAME || d.properties?.ste_name21;
          if (!stateName) return;
          setClickTarget({ country: 'Australia', state: stateName, displayName: `${stateName}, Australia` });
        });
    }

    // Zoom
    svg.call(d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', e => g.attr('transform', e.transform)));

  }, [topoData, visits, visitMap, showTooltip, hideTooltip]);

  return (
    <div className="map-container">
      <svg ref={svgRef} className="world-svg" />
      {tooltip.visible && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content.split('\n').map((line, i) => <div key={i}>{line}</div>)}
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

function getNumericToName() {
  // ISO 3166-1 numeric -> name (common countries, expand as needed)
  return {
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
    524:'Nepal',528:'Netherlands',540:'New Caledonia',554:'New Zealand',
    566:'Nigeria',578:'Norway',586:'Pakistan',591:'Panama',600:'Paraguay',
    604:'Peru',608:'Philippines',616:'Poland',620:'Portugal',630:'Puerto Rico',
    634:'Qatar',642:'Romania',643:'Russia',682:'Saudi Arabia',686:'Senegal',
    694:'Sierra Leone',703:'Slovakia',705:'Slovenia',706:'Somalia',710:'South Africa',
    724:'Spain',729:'Sudan',752:'Sweden',756:'Switzerland',760:'Syria',
    764:'Thailand',792:'Turkey',800:'Uganda',804:'Ukraine',
    784:'United Arab Emirates',826:'United Kingdom',840:'United States of America',
    858:'Uruguay',862:'Venezuela',704:'Vietnam',887:'Yemen',716:'Zimbabwe',
    895:'Kosovo',499:'Montenegro',688:'Serbia',807:'North Macedonia',
    70:'Bosnia and Herzegovina',112:'Belarus',440:'Lithuania',428:'Latvia',
    233:'Estonia',703:'Slovakia',
  };
}
