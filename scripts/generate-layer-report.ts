// @ts-nocheck — script de utilidad, ejecutar con: npx tsx scripts/generate-layer-report.ts
import { writeFileSync, mkdirSync } from 'fs';
import ExcelJS from 'exceljs';
import { LAYER_DEFINITIONS } from '../src/app/config/layers/layer-definitions';
import { LayerCategory } from '../src/app/models/layers/models';

function cell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(fields: unknown[]): string { return fields.map(cell).join(','); }

function isBarbTile(r: { kind?: string }): boolean { return r.kind === 'barb-tile'; }
function renderName(r: Record<string, unknown>): string {
  const pqName = (r['pointQuery'] as Record<string, unknown> | undefined)?.['name'];
  if (pqName) return String(pqName);
  if (isBarbTile(r)) return 'Barbas';
  const suffix = String(r['id'] ?? '').split('-').at(-1) ?? '';
  switch (suffix) {
    case 'mslp': case 'slp': case 'isobars': case 'isobaras': return 'Presión a nivel del mar';
    case 'gust_threshold': return 'Umbral de ráfagas';
    case 'shear_850_500': return 'Cortante 850-500 hPa';
    case 'shear_850_700': return 'Cortante 850-700 hPa';
    case 'brn': return 'Bulk Richardson Number';
    case 'haildiammax': return 'Diámetro máximo de granizo';
    default: return suffix.replace(/[_-]+/g, ' ');
  }
}

// ── Groups ────────────────────────────────────────────────────────────────────
const groupRows = ['groupId,groupName,groupDescription'];
for (const g of LAYER_DEFINITIONS)
  groupRows.push(csvRow([g.id, g.name, g.description ?? '']));

// ── Subgroups ─────────────────────────────────────────────────────────────────
const subgroupRows = ['subgroupId,groupId,subgroupName,subgroupDescription'];
for (const g of LAYER_DEFINITIONS)
  for (const sub of g.subgroups)
    subgroupRows.push(csvRow([sub.id, g.id, sub.name, sub.description ?? '']));

// ── Layers ────────────────────────────────────────────────────────────────────
const LAYER_HEADERS = [
  'layerId', 'subgroupId',
  'layerName', 'layerDescription',
  'availablePeriods',
  'activeLayerLabel',
  'pointQueryLabel', 'pointQueryUnit',
];
const layerRows = [LAYER_HEADERS.join(',')];
const renderRows = ['layerId,renderName,pointQueryLabel,pointQueryUnit'];

const seenRadarProducts = new Set<string>();

for (const g of LAYER_DEFINITIONS) {
  for (const sub of g.subgroups) {
    for (const layer of sub.layers as Record<string, unknown>[]) {
      const category = layer['category'];
      const periods = layer['availablePeriods'];
      const scaleUnit = String((layer['scale'] as Record<string, unknown> | undefined)?.['unit'] ?? '');

      // Radar: una fila por producto, no por estación
      if (category === LayerCategory.RADAR) {
        const product = String(layer['name']);
        if (seenRadarProducts.has(product)) continue;
        seenRadarProducts.add(product);

        layerRows.push(csvRow([
          `radar/RMA{N}/${product}`, 'rma{N}',
          product, `Producto ${product} del radar meteorológico RMA {N} de {ubicación}`,
          Array.isArray(periods) ? periods.join(';') : '',
          `RMA {N} - ${product}`,
          `RMA {N} - ${product} - {elevation}`, scaleUnit,
        ]));
        continue;
      }

      let activeLabel = '', pqLabel = '', pqUnit = scaleUnit;

      switch (category) {
        case LayerCategory.GOES_19:
          activeLabel = `GOES 19 - ${sub.name} - ${layer['name']}`;
          pqLabel = activeLabel;
          break;
        case LayerCategory.ECMWF_TP:
          activeLabel = `ECMWF - ${layer['name']}`;
          pqLabel = `${activeLabel} - corrida {corrida}`;
          break;
        case LayerCategory.WRF:
          activeLabel = `WRF - ${layer['name']}`;
          pqLabel = `${activeLabel} - corrida {corrida}`;
          break;
        case LayerCategory.WEATHER_STATIONS:
          activeLabel = `SMN - ${layer['name']}`;
          pqLabel = activeLabel;
          break;
        case LayerCategory.IGN_WMS:
          activeLabel = `IGN - ${sub.name} - ${layer['name']}`;
          pqUnit = '';
          break;
      }

      layerRows.push(csvRow([
        layer['id'], sub.id,
        layer['name'], layer['description'] ?? '',
        Array.isArray(periods) ? periods.join(';') : '',
        activeLabel,
        pqLabel, pqUnit,
      ]));

      // Secondary renders
      const renders: Record<string, unknown>[] = [];
      if (layer['secondaryRender']) renders.push(layer['secondaryRender'] as Record<string, unknown>);
      if (Array.isArray(layer['secondaryRenders'])) renders.push(...layer['secondaryRenders'] as Record<string, unknown>[]);
      for (const r of renders) {
        const pq = r['pointQuery'] as Record<string, unknown> | undefined;
        const rName = renderName(r);
        // ECMWF isobar: label hardcodeado en el service (no viene de pointQuery)
        const isEcmwfIsobar = String(layer['id']).startsWith('ecmwf/') && !pq;
        const pqLabel = isEcmwfIsobar
          ? 'ECMWF - Presión a nivel del mar - corrida {corrida}'
          : pq ? `${rName} - corrida {corrida}` : '';
        renderRows.push(csvRow([layer['id'], rName, pqLabel, pq?.['unit'] ?? '']));
      }
    }
  }
}

// ── Scales (agrupadas por routingKey si existe, si no por referencia de objeto) ──
type LayerEntry = { layer: Record<string, unknown>; sub: typeof LAYER_DEFINITIONS[0]['subgroups'][0] };
// Clave: routingKey string | scale object reference
const scaleUsers = new Map<string | object, LayerEntry[]>();
// Para grupos con routingKey, acumulamos todos los scaleDisplayNames
const scaleDisplayNames = new Map<string | object, Set<string>>();
// Guardamos un scale representativo por clave para serializar sus campos
const scaleByKey = new Map<string | object, Record<string, unknown>>();

for (const g of LAYER_DEFINITIONS)
  for (const sub of g.subgroups)
    for (const layer of sub.layers as Record<string, unknown>[]) {
      const scale = layer['scale'] as Record<string, unknown> | undefined;
      if (!scale) continue;
      const key: string | object = (scale['scaleRoutingKey'] as string | undefined) ?? scale;
      if (!scaleUsers.has(key)) {
        scaleUsers.set(key, []);
        scaleDisplayNames.set(key, new Set());
        scaleByKey.set(key, scale);
      }
      scaleUsers.get(key)!.push({ layer, sub });
      if (scale['scaleDisplayName']) scaleDisplayNames.get(key)!.add(scale['scaleDisplayName'] as string);
    }

function usedBy(entries: LayerEntry[]): string {
  const radarByProduct = new Map<string, number[]>();
  const others: string[] = [];
  for (const { layer, sub } of entries) {
    if (layer['category'] === LayerCategory.RADAR) {
      const product = String(layer['name']);
      const n = Number(sub.id.match(/rma(\d+)/i)?.[1] ?? 0);
      if (!radarByProduct.has(product)) radarByProduct.set(product, []);
      radarByProduct.get(product)!.push(n);
    } else {
      others.push(String(layer['name']));
    }
  }
  const parts: string[] = [];
  for (const [product, nums] of radarByProduct) {
    nums.sort((a, b) => a - b);
    const range = nums.length === 18 ? 'RMA {N}' : `RMA ${nums[0]}-${nums[nums.length - 1]}`;
    parts.push(`${range} (${product})`);
  }
  parts.push(...others);
  return parts.join('; ');
}

const scaleRows = ['scaleDisplayName,unit,scaleType,scaleMin,scaleMax,usedBy'];
for (const [key, entries] of scaleUsers) {
  const s = scaleByKey.get(key)!;
  const vals = ((s['entries'] as { value: number }[]) ?? []).map(e => e.value);
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const names = [...scaleDisplayNames.get(key)!].join(' / ') || (s['scaleDisplayName'] ?? '');

  scaleRows.push(csvRow([
    names, s['unit'] ?? '', s['type'] ?? '',
    min ?? '', max ?? '',
    usedBy(entries),
  ]));
}

// ── Unit settings ─────────────────────────────────────────────────────────────
// Documenta las conversiones de unidades configurables por el usuario.
// Los valores de escala se almacenan siempre en la unidad base (columna "storedUnit");
// getDisplayUnit() los convierte a la unidad elegida por el usuario antes de mostrarlos.
const unitSettingRows = [
  'setting,displayOptions,default',
  'Temperatura,"K, °C",°C',
  'Velocidad de viento,"kt, km/h",kt',
];

// ── Radar stations ────────────────────────────────────────────────────────────
const radarGroup = LAYER_DEFINITIONS.find(g => g.id === 'radar');
const radarStationRows = ['stationId,stationNumber,location'];
for (const sub of radarGroup?.subgroups ?? []) {
  const n = sub.id.match(/rma(\d+)/i)?.[1] ?? '';
  const location = sub.name.split(' - ')[1] ?? '';
  radarStationRows.push(csvRow([sub.id, n, location]));
}

// ── Elevations (compartidas por todos los radares) ────────────────────────────
const elevationRows = ['elevationName,isDefault', '0.5°,true', '0.9°,false', '1.3°,false'];

// ── Write output ──────────────────────────────────────────────────────────────
mkdirSync('layer-report', { recursive: true });
writeFileSync('layer-report/groups.csv', groupRows.join('\n'), 'utf-8');
writeFileSync('layer-report/subgroups.csv', subgroupRows.join('\n'), 'utf-8');
writeFileSync('layer-report/layers.csv', layerRows.join('\n'), 'utf-8');
writeFileSync('layer-report/scales.csv', scaleRows.join('\n'), 'utf-8');
writeFileSync('layer-report/secondary-renders.csv', renderRows.join('\n'), 'utf-8');
writeFileSync('layer-report/unit-settings.csv', unitSettingRows.join('\n'), 'utf-8');
writeFileSync('layer-report/radar-stations.csv', radarStationRows.join('\n'), 'utf-8');
writeFileSync('layer-report/elevations.csv', elevationRows.join('\n'), 'utf-8');

console.log(`✓ groups.csv              : ${groupRows.length - 1} filas`);
console.log(`✓ subgroups.csv           : ${subgroupRows.length - 1} filas`);
console.log(`✓ layers.csv              : ${layerRows.length - 1} filas`);
console.log(`✓ scales.csv              : ${scaleRows.length - 1} filas`);
console.log(`✓ secondary-renders.csv   : ${renderRows.length - 1} filas`);
console.log(`✓ unit-settings.csv       : ${unitSettingRows.length - 1} filas`);
console.log(`✓ radar-stations.csv      : ${radarStationRows.length - 1} filas`);
console.log(`✓ elevations.csv          : ${elevationRows.length - 1} filas`);

// ── Excel ─────────────────────────────────────────────────────────────────────
const SHEETS = [
  { name: 'Grupos',             rows: groupRows },
  { name: 'Subgrupos',          rows: subgroupRows },
  { name: 'Capas',              rows: layerRows },
  { name: 'Escalas',            rows: scaleRows },
  { name: 'Config. Unidades',   rows: unitSettingRows },
  { name: 'Renders Secundarios',rows: renderRows },
  { name: 'Estaciones Radar',   rows: radarStationRows },
  { name: 'Elevaciones',        rows: elevationRows },
];

const TABLE_STYLES = [
  'TableStyleMedium2',  // azul
  'TableStyleMedium7',  // verde
  'TableStyleMedium3',  // naranja
  'TableStyleMedium4',  // gris
  'TableStyleMedium5',  // amarillo
  'TableStyleMedium6',  // celeste
  'TableStyleMedium1',  // azul claro
];

const workbook = new ExcelJS.Workbook();
workbook.creator = 'mapasmn/visualizer';

for (let si = 0; si < SHEETS.length; si++) {
  const { name, rows } = SHEETS[si];
  const [headerRow, ...dataRows] = rows.map(r => {
    // Parsear CSV respetando campos entre comillas
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur);
    return cells;
  });

  const ws = workbook.addWorksheet(name);

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  ws.addTable({
    name: name.replace(/\s/g, '_'),
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: TABLE_STYLES[si % TABLE_STYLES.length], showRowStripes: true },
    columns: headerRow.map(h => ({ name: h, filterButton: true })),
    rows: dataRows,
  });

  // Auto-fit column widths
  ws.columns.forEach((col, i) => {
    const maxLen = [headerRow[i], ...dataRows.map(r => r[i] ?? '')]
      .reduce((m, v) => Math.max(m, String(v ?? '').length), 10);
    col.width = Math.min(maxLen + 2, 60);
  });
}

workbook.xlsx.writeFile('layer-report/layer-report.xlsx').then(() => {
  console.log(`✓ layer-report.xlsx       : ${SHEETS.length} hojas`);
});
