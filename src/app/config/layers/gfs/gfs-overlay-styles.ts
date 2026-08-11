import { VectorLineStyle, VectorTextpathOptions } from '../../../models';

// ============================================================================
// Estilos de los contornos GFS, traducidos de los scripts GrADS del SMN
// (`slpb.gs`, `tgv500b.gs`, `250b.gs`) para que el visualizador coincida con
// las cartas de referencia.
//
// Traducción de GrADS:
//   - `ccolor N` → color. 1 = negro, 2 = rojo, 3 = verde, 4 = azul; los índices
//     >= 16 son custom y salen de las definiciones `set rgb` de `jaecol`.
//   - `cstyle 1` → línea sólida; `cstyle 2` → punteada.
//   - `cthick N` → grosor. GrADS usa 1..10; acá se mapea a píxeles de Leaflet.
// ============================================================================

const COLOR_BLACK = '#000000'; // GrADS 1
const COLOR_RED = '#FF0000'; // GrADS 2
const COLOR_GREEN = '#00FF00'; // GrADS 3
const COLOR_BLUE = '#0000FF'; // GrADS 4
const COLOR_THICKNESS = '#1482BE'; // jaecol 49 — rgb(20, 130, 190)
const COLOR_THICKNESS_5280 = '#FFE878'; // jaecol 22 — rgb(255, 232, 120)

const DASHED = '5,4';

function makeTextpath(color: string): VectorTextpathOptions {
  return {
    center: true,
    offset: -3,
    attributes: {
      fill: color,
      'font-size': '9px',
      'font-weight': 'bold',
      'font-family': 'sans-serif',
    },
  };
}

/** Etiqueta entera, que es como rotula `clab` en las tres cartas. */
export const integerLabelFor = (value: number): string => `${Math.round(value)}`;

// ============================================================================
// Presión a nivel del mar (`slpb.gs`)
// ============================================================================

// Isobaras cada 3 hPa: 'set ccolor 1' + 'set cstyle 1' + 'set cthick 5'.
export const isobarStyleFor = (): VectorLineStyle => ({
  color: COLOR_BLACK,
  weight: 1.3,
  opacity: 0.95,
});
export const ISOBAR_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_BLACK);

/**
 * Espesores 1000/500 cada 60 m. El script los dibuja punteados y finos en
 * celeste ('cstyle 2', 'cthick 3', 'ccolor 49') y vuelve a dibujar cuatro
 * niveles de masa de aire con 'cthick 9' y un color propio cada uno.
 */
const HIGHLIGHTED_THICKNESS: ReadonlyMap<number, string> = new Map([
  [5280, COLOR_THICKNESS_5280], // ccolor 22
  [5400, COLOR_BLUE], // ccolor 4
  [5580, COLOR_GREEN], // ccolor 3
  [5700, COLOR_RED], // ccolor 2
]);

export const thicknessStyleFor = (value: number): VectorLineStyle => {
  const highlight = HIGHLIGHTED_THICKNESS.get(Math.round(value));
  if (highlight) {
    return { color: highlight, weight: 2.2, opacity: 1 };
  }
  return { color: COLOR_THICKNESS, weight: 0.8, dashArray: DASHED, opacity: 0.9 };
};

export const THICKNESS_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_THICKNESS);

// ============================================================================
// 500 hPa (`tgv500b.gs`)
// ============================================================================

// Geopotencial cada 60 m: 'set cstyle 1' + 'set ccolor 1' + 'set cthick 5'.
export const heights500StyleFor = (): VectorLineStyle => ({
  color: COLOR_BLACK,
  weight: 1.3,
  opacity: 0.95,
});
export const HEIGHTS_500_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_BLACK);

// Isotermas cada 5 °C: 'set ccolor 2' + 'set cstyle 2' + 'set cthick 6'.
export const isothermStyleFor = (): VectorLineStyle => ({
  color: COLOR_RED,
  weight: 1.5,
  dashArray: DASHED,
  opacity: 0.9,
});
export const ISOTHERM_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_RED);
export const isothermLabelFor = (value: number): string => `${Math.round(value)}°`;

// ============================================================================
// 250 hPa (`250b.gs`)
// ============================================================================

// Geopotencial cada 60 m. El script deja activo el 'set ccolor 2' previo al
// sombreado, así que estos contornos salen rojos y sólidos ('set cstyle 1').
export const heights250StyleFor = (): VectorLineStyle => ({
  color: COLOR_RED,
  weight: 1.2,
  opacity: 0.95,
});
export const HEIGHTS_250_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_RED);
