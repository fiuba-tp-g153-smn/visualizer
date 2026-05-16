import * as L from 'leaflet';

export type TextPathLayer = L.Polyline & {
  setText(text: string | null, options?: L.TextPathOptions): L.Polyline;
};

export function isTextPathLayer(layer: L.Layer): layer is TextPathLayer {
  return (
    layer instanceof L.Polyline && typeof (layer as { setText?: unknown }).setText === 'function'
  );
}
