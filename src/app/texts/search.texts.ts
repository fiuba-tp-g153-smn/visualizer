/** Texts for the map explorer: place search and base map selector. */
export const SEARCH_TEXTS = {
  tabs: {
    search: 'Buscar',
    baseMap: 'Mapa base',
  },
  place: {
    placeholder: 'Buscar localidad, departamento o provincia…',
    clear: 'Limpiar texto',
    showConfig: 'Configuración de búsqueda',
    hideConfig: 'Ocultar configuración de búsqueda',
    source: 'Fuente de búsqueda',
    ign: 'IGN (Argentina)',
    ignHint:
      'Nomenclátor oficial argentino: localidades, departamentos y provincias, ubicadas por centroide.',
    nominatim: 'Nominatim (OSM)',
    nominatimHint:
      'OpenStreetMap: también puede marcar el límite de un área como un polígono en el mapa.',
    areaDisplay: 'Cómo mostrar resultados de área',
    polygon: 'Polígono',
    polygonHint: 'Dibuja el límite del área como un polígono sobre el mapa.',
    marker: 'Marcador',
    markerHint: 'Marca el centro del área con un pin, sin dibujar su límite.',
    animate: 'Animar desplazamiento al resultado',
    animateHint: 'Anima el desplazamiento del mapa al ir a un resultado, en vez de saltar directo.',
    promptTitle: 'Buscá un lugar de Argentina',
    promptHint: (minLength: number): string =>
      `Escribí al menos ${minLength} letras de una localidad, departamento o provincia`,
    noResults: 'No se encontraron resultados',
    noResultsHint: 'Probá con otros términos de búsqueda',
    resultTooltip: (title: string, subtitle: string): string => `${title} — ${subtitle}`,
    clearMarker: 'Quitar marca del mapa',
    loadingMore: 'Cargando…',
    loadMore: 'Cargar más resultados',
    error: 'No se pudo completar la búsqueda',
  },
  baseMaps: {
    loading: 'Cargando mapas base…',
    error: 'No se pudieron cargar los mapas base.',
    empty: 'No hay mapas base configurados.',
  },
} as const;
