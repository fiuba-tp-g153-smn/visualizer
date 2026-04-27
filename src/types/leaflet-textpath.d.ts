import 'leaflet';

declare module 'leaflet' {
  interface TextPathOptions {
    /** Repeat the text along the entire path. Default: false. */
    repeat?: boolean;
    /** Center the text on the path. Default: false. */
    center?: boolean;
    /** Render text below the line. Default: false. */
    below?: boolean;
    /** Pixel offset perpendicular to the path. Negative values shift above. */
    offset?: number;
    /** Orientation: 'auto', 'flip', or a number of degrees. */
    orientation?: 'auto' | 'flip' | number;
    /** SVG attributes applied to the rendered <text>/<textPath>. */
    attributes?: Record<string, string>;
  }

  interface Polyline {
    /**
     * Render text along the polyline. Provided by `leaflet-textpath`.
     * Pass `null` to remove a previously-set label.
     */
    setText(text: string | null, options?: TextPathOptions): this;
  }
}
