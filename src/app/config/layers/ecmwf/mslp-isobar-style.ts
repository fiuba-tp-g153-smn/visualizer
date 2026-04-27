import { VectorLineStyle, VectorTextpathOptions } from '../../../models';

/**
 * Estilos visuales para las isobaras de Mean Sea Level Pressure (MSLP).
 *
 * Patrón meteorológico clásico:
 *   - Múltiplos de 10 hPa (1000, 1010, ...) → líneas más gruesas, más oscuras, con etiqueta.
 *   - Múltiplos de 5 hPa que NO son de 10 (1005, 1015, ...) → finas, grises, sin etiqueta.
 */
const EMPHASIS_STYLE: VectorLineStyle = {
  color: '#1a1a1a',
  weight: 1.5,
  opacity: 0.9,
};

const NORMAL_STYLE: VectorLineStyle = {
  color: '#666666',
  weight: 0.8,
  opacity: 0.6,
};

/**
 * Resuelve el estilo de una isobara según su valor en hPa.
 */
export function isobarStyleFor(pressureHpa: number): VectorLineStyle {
  return pressureHpa % 10 === 0 ? EMPHASIS_STYLE : NORMAL_STYLE;
}

/**
 * Resuelve la etiqueta a mostrar sobre la isobara.
 * Solo se etiquetan los múltiplos de 10 hPa.
 */
export function isobarLabelFor(pressureHpa: number): string | null {
  return pressureHpa % 10 === 0 ? `${pressureHpa.toFixed(0)} hPa` : null;
}

/**
 * Opciones de `leaflet-textpath` para las etiquetas de isobaras.
 */
export const ISOBAR_TEXTPATH_OPTIONS: VectorTextpathOptions = {
  center: true,
  offset: -4,
  orientation: 'flip',
  attributes: {
    fill: '#1a1a1a',
    'font-size': '10px',
    'font-weight': 'bold',
    'font-family': 'sans-serif',
  },
};
