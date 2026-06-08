import { Layer, Polyline, TextPathOptions } from 'leaflet';

export type TextPathLayer = Polyline & {
  setText(text: string | null, options?: TextPathOptions): Polyline;
};

export function isTextPathLayer(layer: Layer): layer is TextPathLayer {
  return (
    layer instanceof Polyline && typeof (layer as { setText?: unknown }).setText === 'function'
  );
}
