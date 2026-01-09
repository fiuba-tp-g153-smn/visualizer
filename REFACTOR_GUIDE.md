# Guía de Pasos para la Reconstrucción del Visualizador de Mapas

## SCOPE INICIAL

**Decisión:** Arrancar solo con **satélite ABI (3 canales)** para probar el flujo completo antes de agregar más features.

---

## FASES COMPLETADAS

### FASE 1 COMPLETADA: Setup Inicial y Mapa Básico

**Objetivo:** Tener un mapa funcional vacío

#### Decisiones de diseño - Fase 1

- ✅ Usar **Sass (SCSS)** para estilos (variables, anidación, mixins)
- ✅ Separar configuración en archivos dedicados:
  - `map.config.ts` → Config del mapa (centro, zoom, bounds)
  - `tile-providers.config.ts` → Catálogo de tile providers
- ✅ Assets del SMN (logos, favicon) en `/public`
- ✅ Import estático de Leaflet (`import * as L from 'leaflet'`) en lugar de dinámico

**Resultado:**

- Mapa funcionando con ArgenMAP por defecto
- Centro en Argentina (-40, -64), zoom 4
- 5 tile providers disponibles (ArgenMAP, OSM, Satélite, CartoDB, CartoDB Dark)

**Commits:**

- `feat: Clean refactor - Phase 1 complete`
- `feat: Add SMN branding assets`
- `fix: Replace Angular favicon with SMN icon`

---

### FASE 2 COMPLETADA: Servicios Base y Arquitectura

**Objetivo:** Servicio reactivo para gestionar tile providers

#### Decisiones de diseño - Fase 2

- ✅ Usar **Signals** (no RxJS) para estado reactivo
- ✅ Pattern: `private _signal + public readonly signal`
  - `_currentProvider` privado (WritableSignal)
  - `currentProvider` público con `.asReadonly()` (inmutable desde afuera)
- ✅ **Effect** en MapViewer para escuchar cambios automáticamente
- ✅ Eliminar `any` types, usar tipos correctos de Leaflet:
  - `L.Map`, `L.TileLayer`
  - Usar `!` (definite assignment) en lugar de `| null` donde garantizamos inicialización

**Resultado:**

- TileService con signal reactivo
- Cambiar mapa base desde consola: `tileService.setProvider("osm")`
- Mapa se actualiza automáticamente sin necesidad de llamadas manuales

**Commits:**

- `refactor: Remove 'any' types and use proper Leaflet types`

---

### FASE 3 COMPLETADA: Sistema de Capas (Modelos)

**Objetivo:** Definir tipos para el sistema de capas (SOLO ABI por ahora)

#### Decisiones de diseño - Fase 3

- ✅ **Scope reducido:** Solo `LayerType.RASTER` y `LayerCategory.SATELLITE_ABI`
- ✅ **Modelos minimalistas:** Solo lo que realmente se usa
  - **layer.models.ts:** `Layer`, `LayerSubgroup`, `LayerGroup`, `LayerType`, `LayerCategory`, `TileProvider`
  - **map-data.models.ts:** `Coordinates`, `BoundingBox` (tipos base para futuro)
  - **index.ts:** Barrel export
- ✅ **TileProvider movido a models** desde config (mejor organización)
- ✅ Eliminar tipos no utilizados (TileLayerData, TileProduct, etc.)
  - Se agregarán cuando sean necesarios para WRF, EMAs, etc.

**Estructura:**

```text
LayerGroup (ej: "Satélite")
  └─ LayerSubgroup (ej: "ABI")
      └─ Layer (ej: "Canal 2")
```

**Archivos:**

- `models/map-data.models.ts` → Datos que vienen del backend (mínimo por ahora)
- `models/layer.models.ts` → Estructura de capas + TileProvider
- `models/index.ts` → Barrel export

**Decisión arquitectónica importante:**

⚠️ **Tiles z/x/y** en lugar de overlays estáticos

- Formato: `http://localhost:5000/tiles/{product}/{z}/{x}/{y}.webp`
- Solo 3 canales ABI: ch2, ch9, ch13
- Los datos vienen del backend como tiles pre-procesados con gdal2tiles

**Commits:**

- `refactor: Simplify models and move TileProvider to layer.models`

---

### FASE 5 COMPLETADA: Integración MapViewer + Sistema de Notificaciones

**Objetivo:** Renderizar capas en el mapa y notificar errores al usuario

#### Decisiones de diseño - Fase 5

- ✅ **Configuración simplificada:**
  - `config/layers/satellite-abi.layers.ts` → UI + estado (opacity: 80 una sola vez con spread)
  - `config/layer-tiles/satellite-abi.tiles.ts` → Función `getAbiTileConfig()` retorna URL + opciones
  - `config/backend.config.ts` → Variables de entorno (baseUrl, useMockTiles)
  - Eliminado `tile-config.types.ts` (opciones directamente en satellite-abi.tiles.ts)
- ✅ **LayerRendererService mejorado:**
  - Switch simple por categoría
  - Métodos privados para crear tiles por tipo (`createAbiTileLayer()`, etc.)
  - **Método `setOpacity()`** para actualizar opacidad de layers existentes
  - Adjunta error handlers solo si NO está en modo mock
- ✅ **Sistema de notificaciones en UI:**
  - `NotificationService` con signals (error, warning, info, success)
  - `NotificationPanelComponent` tipo toast en esquina superior derecha
  - Auto-cierre configurable (errores NO se cierran solos)
  - **Sin fallback automático:** Si backend falla, se muestra mensaje visible al usuario
- ✅ **MapViewer con 2 effects reactivos:**
  - Effect 1: Escucha `tileService.currentProvider()` → Cambia mapa base
  - Effect 2: Escucha `layerService.activeLayers()` → Sincroniza overlays
  - Método `syncLayers()` usa `layerRendererService.setOpacity()` para actualizar
- ✅ **Testing:** 50 tests pasando (LayerService + TileService + NotificationService)

**Variables de entorno:**

```typescript
// src/environments/environment.ts
export const environment = {
  backend: {
    baseUrl: 'http://localhost:5000',
    useMockTiles: true,  // false para usar backend real
  },
  tiles: {
    format: 'webp',
  },
};
```

**Resultado:**

- Capas ABI se renderizan en el mapa con tiles z/x/y
- Opacidad y zIndex dinámicos (gestionados por servicio)
- Si backend falla (5+ tiles), notificación visible: "Capa no disponible temporalmente"
- Mock con CartoDB para desarrollo sin backend
- Arquitectura escalable para agregar WRF, ECMWF

**Commits:**

- `feat: Add MapViewer integration with LayerRendererService (Phase 5)`
- `feat: Add notification system for tile loading errors`
- `refactor: Simplify tile configuration and add setOpacity to service`

---

## ARQUITECTURA ACTUAL (Post-Simplificación)

### Estructura de Carpetas

```text
visualizator/src/app/
├── models/
│   ├── layer.models.ts          # Layer, LayerSubgroup, LayerGroup
│   ├── tile-provider.model.ts   # TileProvider (mapas base)
│   ├── map-data.models.ts       # Coordinates, BoundingBox (mínimo)
│   ├── notification.model.ts    # Notification, NotificationType
│   └── index.ts                 # Barrel exports
├── config/
│   ├── backend.config.ts        # URLs y modo mock
│   ├── map.config.ts            # Centro, zoom, bounds
│   ├── tile-providers.config.ts # Mapas base (ArgenMAP, OSM, etc.)
│   ├── layer-definitions.ts     # Grupos y subgrupos (estructura inicial)
│   ├── layers/
│   │   └── satellite-abi.layers.ts  # Definición de capas ABI
│   └── layer-tiles/
│       └── satellite-abi.tiles.ts   # Config de tiles ABI (URLs, opciones)
├── services/
│   ├── tile.service.ts          # Gestión de mapa base
│   ├── layer.service.ts         # Estado y lógica de capas
│   ├── layer-renderer.service.ts # Factory: Layer → L.TileLayer
│   └── notification.service.ts  # Sistema de notificaciones
└── map-viewer/
    └── map-viewer.ts            # Componente principal del mapa
```

### Flujo de Datos

```text
1. Usuario activa capa en UI (futuro LayerList)
   ↓
2. layerService.toggleLayer(id)
   ↓
3. layerService.activeLayers() (computed signal) → Filtra visibles
   ↓
4. MapViewer effect detecta cambio
   ↓
5. syncLayers() llama a layerRendererService.createTileLayer()
   ↓
6. layerRendererService switch por category → createAbiTileLayer()
   ↓
7. getAbiTileConfig() retorna URL + opciones
   ↓
8. L.tileLayer() se crea y se agrega al mapa
   ↓
9. Si cambia opacidad/zIndex: MapViewer llama directamente a Leaflet
   (existingLayer.setOpacity(), existingLayer.setZIndex())
```   ↓
8. L.tileLayer() se crea y se agrega al mapa
   ↓
9. Si cambia opacidad: layerRendererService.setOpacity(layer, newValue)
```

### Principios de Diseño

- ✅ **Minimalismo:** Solo código que se usa actualmente
- ✅ **Separación de responsabilidades:**
  - **Config:** Valores estáticos (URLs, opciones)
  - **LayerService:** Estado y lógica de negocio de capas
  - **LayerRendererService:** Factory pattern (Layer → L.TileLayer)
  - **MapViewer:** Coordinación entre servicios y Leaflet (llamadas directas)
- ✅ **No over-engineering:** Llamadas directas a Leaflet cuando no hay lógica adicional
- ✅ **Escalabilidad:** Agregar nuevo tipo de capa = nuevo case + método privado
- ✅ **Signals everywhere:** Estado reactivo sin RxJS

### Cómo Agregar Nuevas Capas

**Ejemplo: Agregar WRF:**

1. **Agregar enum:**

   ```typescript
   // models/layer.models.ts
   export enum LayerCategory {
     SATELLITE_ABI = 'satellite_abi',
     WRF = 'wrf',  // ← NUEVO
   }
   ```

2. **Crear config de tiles:**

   ```typescript
   // config/layer-tiles/wrf.tiles.ts
   export function getWrfTileConfig(layerId: string): {
     url: string;
     options: L.TileLayerOptions;
   } {
     // Lógica específica de WRF
   }
   ```

3. **Agregar case en LayerRendererService:**

   ```typescript
   case LayerCategory.WRF:
     tileLayer = this.createWrfTileLayer(layer.id, layer.opacity);
     break;

   private createWrfTileLayer(layerId: string, opacity: number): L.TileLayer {
     const { url, options } = getWrfTileConfig(layerId);
     return L.tileLayer(url, { ...options, opacity: opacity / 100 });
   }
   ```

4. **Definir capas en config:**

   ```typescript
   // config/layers/wrf.layers.ts
   export const WRF_SUBGROUP: LayerSubgroup = { /* ... */ };
   ```

---

## PRÓXIMA FASE

### FASE 6: Componentes de UI

**Objetivo:** Crear controles visuales para el mapa

**Por implementar:**

- MainMenu component con botones principales
- LayerList component para activar/desactivar capas
- Control de opacidad (slider)
- Botones para reordenar capas (flechas arriba/abajo)
- Integrar en app.html

**Testing en consola (mientras tanto):**

```javascript
// Cambiar mapa base
tileService.setProvider("osm")
tileService.setProvider("satellite")

// Gestionar capas
layerService.toggleLayer("abi-ch2")
layerService.setOpacity("abi-ch13", 50)
layerService.moveLayerUp("abi-ch13")

// Probar notificaciones
notificationService.error("Test error", "abi-ch2")
notificationService.dismissAll()
```

---

## PLAN PASO A PASO - RECONSTRUCCIÓN DESDE CERO

### FASE 1: Setup Inicial y Mapa Básico

**Objetivo:** Tener un mapa funcional vacío

#### **Paso 1.1: Crear proyecto Angular nuevo**

```bash
ng new visualizator --standalone --routing=false --ssr=false
cd visualizator
```

#### **Paso 1.2: Instalar dependencias básicas**

```bash
npm install leaflet @types/leaflet
npm install @angular/material @angular/cdk
```

#### **Paso 1.3: Crear componente MapViewer básico**

- Componente standalone
- Inicializar mapa Leaflet en el `ngOnInit`
- Agregar tile layer básico (OSM o ArgenMAP)
- Solo HTML: `<div id="map"></div>`, CSS: `height: 100vh`

**✅ Checkpoint:** Mapa visible y funcionando con zoom/pan

---

### **FASE 2: Servicios Base y Arquitectura**

**Objetivo:** Estructura de servicios reactivos

#### **Paso 2.1: Crear servicio TileService**

- Signal para el tile provider actual
- Lista de providers disponibles (ArgenMAP, OSM, etc.)
- Método `setProvider()`

#### **Paso 2.2: Integrar TileService en MapViewer**

- Effect para escuchar cambios en tile provider
- Cambiar layer cuando cambia el provider

**✅ Checkpoint:** Poder cambiar entre mapas base programáticamente

---

### **FASE 3: Sistema de Capas (Modelos)**

**Objetivo:** Definir tipos y estructura de capas

#### **Paso 3.1: Crear modelos en map-data.models.ts**

- `LayerType` (POINT, RASTER, VECTOR)
- `LayerCategory` (satélite, radar, WRF, EMAs, etc.)
- Interface `Layer` con id, name, visible, opacity, metadata
- `LayerGroup` y `LayerSubgroup`
- `ActiveLayer` (con zIndex)

#### **Paso 3.2: Crear modelos de datos**

- `BoundingBox`, `Coordinates`
- `MapPoint<T>`, `EmaPointData`, `StationPointData`
- `VectorData`, `VectorField`
- `RasterImageData`

**✅ Checkpoint:** Tipado completo de datos

---

### **FASE 4: Servicio de Capas**

**Objetivo:** Gestión centralizada de capas

#### **Paso 4.1: Crear LayerService**

- Signal `layerGroups` con estructura inicial hardcodeada
- Computed `activeLayers` (filtro de visibles + orden)
- Métodos: `toggleLayer()`, `setOpacity()`, `setForecastHour()`

#### **Paso 4.2: Definir estructura inicial de grupos**

- Grupo "Satélite" con subgrupos (ABI, GLM, Tiles)
- Grupo "Modelos Numéricos" (WRF con t2m, pp, psfc, wind)
- Grupo "Observaciones" (EMAs, SYNOP, METAR)
- Grupo "Radar"

**✅ Checkpoint:** Servicio funcional con datos mock

---

### **FASE 5: Panel Lateral y UI**

**Objetivo:** Menu lateral con botones

#### **Paso 5.1: Crear UiService**

- Signal `activePanel` ('layers' | 'polygons' | 'tiles' | null)
- Métodos: `openPanel()`, `closePanel()`, `togglePanel()`

#### **Paso 5.2: Crear componentes del menú**

- `MainMenuButtonBar` (3 botones flotantes: capas, polígonos, tiles)
- `MainMenu` (wrapper con panel deslizable)
- Estilos con animaciones de slide-in/out

**✅ Checkpoint:** Panel que abre/cierra con botones

---

### **FASE 6: Lista de Capas**

**Objetivo:** UI para gestionar capas

#### **Paso 6.1: Crear LayerList component**

- Angular Material Expansion panels
- Mostrar grupos → subgrupos → capas
- Checkbox para visibility
- Slider para opacity

#### **Paso 6.2: Integrar con LayerService**

- Bind signals del servicio
- Llamar métodos del servicio en eventos

**✅ Checkpoint:** Lista de capas funcional (aún sin datos en mapa)

---

### **FASE 7: Renderizar Capas en el Mapa (Básico)**

**Objetivo:** Ver capas en el mapa

#### **Paso 7.1: Effect en MapViewer para escuchar cambios**

- Effect sobre `layerService.activeLayers()`
- Agregar/remover layers de Leaflet según visibilidad

#### **Paso 7.2: Implementar render de RASTER**

- Usar `L.imageOverlay()` con bounds
- Opacidad reactiva

#### **Paso 7.3: Mock inicial de datos WRF**

- Crear servicio `MapDataService` con métodos stub
- Retornar datos estáticos del JSON

**✅ Checkpoint:** Ver una imagen raster en el mapa

---

### **FASE 8: Servicio de Datos (Backend)**

**Objetivo:** Consumir datos reales

#### **Paso 8.1: Crear ApiConfigService**

- URLs de endpoints
- Builder de URLs

#### **Paso 8.2: Implementar MapDataService**

- Métodos HTTP para:
  - `getEmas()`, `getSynop()`, `getMetar()` (puntos)
  - `getWrfRaster()` (imágenes WRF)
  - `getWrfVectors()` (vectores de viento)
- Cache con Map + shareReplay

**✅ Checkpoint:** Datos cargados desde public/ o backend mock

---

### **FASE 9: Renderizar Puntos (EMAs/Estaciones)**

**Objetivo:** Markers en el mapa

#### **Paso 9.1: Render de puntos en MapViewer**

- Crear `L.circleMarker()` para cada punto
- Popups con datos
- Colores según tipo

#### **Paso 9.2: Filtro por bounding box**

- Calcular bounds del mapa actual
- Pasar a `MapDataService` para filtrar

**✅ Checkpoint:** Puntos visibles y con info

---

### **FASE 10: Vectores de Viento**

**Objetivo:** Flechas de viento

#### **Paso 10.1: Crear custom Leaflet layer para vectores**

- Canvas overlay
- Dibujar flechas con dirección y magnitud
- Colores según intensidad

#### **Paso 10.2: Integrar en MapViewer**

- Cargar datos vectoriales
- Actualizar canvas on viewport change

**✅ Checkpoint:** Vectores renderizados

---

### **FASE 11: Control de Tiempo / Animación**

**Objetivo:** Timeline para múltiples frames

#### **Paso 11.1: Agregar signals al LayerService**

- `globalTimeIndex` (frame actual)
- `isPlaying` (animación en curso)
- Métodos: `play()`, `pause()`, `setTimeIndex()`

#### **Paso 11.2: UI en LayerList**

- Controles play/pause
- Slider de tiempo
- Display de fecha/hora

#### **Paso 11.3: Actualizar MapViewer**

- Cargar frame correcto según timeIndex
- Animar con interval

**✅ Checkpoint:** Animación de capas temporales

---

### **FASE 12: Control de Forecast Hours (WRF)**

**Objetivo:** Selector de plazos de pronóstico

#### **Paso 12.1: Agregar metadata a layers**

- `forecastHours: [6, 12, 24, 48, 72]`
- `selectedForecastHour: 6`

#### **Paso 12.2: UI en LayerList**

- Dropdown para seleccionar plazo
- Por cada capa WRF

#### **Paso 12.3: Cargar datos según plazo**

- Pasar forecastHour a MapDataService
- Construir URL con plazo correcto

**✅ Checkpoint:** Cambiar plazos de WRF

---

### **FASE 13: Tiles Satelitales XYZ**

**Objetivo:** Tiles pre-procesados (gdal2tiles)

#### **Paso 13.1: Crear SatelliteTilesService**

- `getAvailableProducts()` → lista de tiles
- `createTileLayer()` → config de L.tileLayer

#### **Paso 13.2: Agregar al LayerService**

- Categoría SATELLITE_TILES
- Capas dinámicas según productos disponibles

#### **Paso 13.3: Renderizar en MapViewer**

- `L.tileLayer()` con URL template
- Min/max zoom

**✅ Checkpoint:** Tiles satelitales funcionando

---

### **FASE 14: Herramienta de Polígonos**

**Objetivo:** Dibujar y gestionar polígonos

#### **Paso 14.1: Instalar leaflet-draw**

```bash
npm install leaflet-draw @types/leaflet-draw
```

#### **Paso 14.2: Crear PolygonService**

- Signal `polygons[]` con lista
- Signal `isDrawing`
- Métodos: `addPolygon()`, `editPolygon()`, `deletePolygon()`
- Subjects para eventos

#### **Paso 14.3: Integrar leaflet-draw en MapViewer**

- Inicializar `L.Draw.Polygon`
- Handlers para eventos created, edited, deleted
- Guardar en PolygonService

**✅ Checkpoint:** Dibujar polígonos en el mapa

---

### **FASE 15: UI de Gestión de Polígonos**

**Objetivo:** Panel para editar polígonos

#### **Paso 15.1: Crear PolygonTool component**

- Lista de polígonos con expansion panels
- Botón "Dibujar nuevo"
- Para cada polígono:
  - Renombrar
  - Cambiar color
  - Ajustar opacidad
  - Editar geometría
  - Eliminar
  - Zoom to

#### **Paso 15.2: Conectar con PolygonService**

- Bind signals
- Llamar métodos del servicio

**✅ Checkpoint:** Gestión completa de polígonos

---

### **FASE 16: Configuración de Tiles Base**

**Objetivo:** Panel para cambiar mapa base

#### **Paso 16.1: Crear TileConfig component**

- Lista de providers disponibles
- Radio buttons o cards
- Vista previa (thumbnails opcionales)

#### **Paso 16.2: Conectar con TileService**

- Llamar `setProvider()` al seleccionar

**✅ Checkpoint:** Cambiar mapas base desde UI

---

### **FASE 17: Organización de Capas Activas**

**Objetivo:** Drag & drop para z-index

#### **Paso 17.1: Tab en LayerList**

- Pestaña "Capas activas"
- Lista solo de capas visibles

#### **Paso 17.2: Drag & drop con CDK**

```bash
npm install @angular/cdk
```

- `cdkDropList` para reordenar
- Actualizar orden en LayerService

#### **Paso 17.3: Aplicar z-index en MapViewer**

- Effect sobre `activeLayers()`
- Llamar `layer.setZIndex()` en Leaflet

**✅ Checkpoint:** Reordenar capas interactivamente

---

### **FASE 18: Búsqueda y Filtros**

**Objetivo:** Buscar capas rápido

#### **Paso 18.1: Input de búsqueda en LayerList**

- Signal `searchQuery`
- Computed que filtra grupos/subgrupos/capas

#### **Paso 18.2: Lógica de filtrado**

- Por nombre de capa
- Por descripción
- Expandir automáticamente grupos con resultados

**✅ Checkpoint:** Búsqueda funcional

---

### **FASE 19: Optimizaciones**

**Objetivo:** Performance

#### **Paso 19.1: Debounce en movimientos de mapa**

- RxJS debounceTime para evitar llamadas excesivas

#### **Paso 19.2: Cache en MapDataService**

- TTL de 1 minuto
- Invalidar cuando cambia parámetro

#### **Paso 19.3: Lazy loading de datos**

- Solo cargar cuando capa está visible
- Cancelar requests al ocultar capa

**✅ Checkpoint:** App fluida

---

### **FASE 20: Estilos y UX**

**Objetivo:** Look & feel profesional

#### **Paso 20.1: Tema SMN**

- Colores corporativos
- Angular Material theming

#### **Paso 20.2: Responsive**

- Panel lateral colapsable en mobile
- Controles adaptados

#### **Paso 20.3: Loading states**

- Spinners mientras carga
- Placeholders

**✅ Checkpoint:** App pulida
