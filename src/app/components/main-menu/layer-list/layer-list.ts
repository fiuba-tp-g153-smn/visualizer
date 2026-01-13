import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LayerService } from '../../../services/layer.service';
import { ChannelConfigService } from '../../../services/channel-config.service';
import { Layer, LayerCategory } from '../../../models';
import { MenuPanelComponent } from '../menu-section.model';

/**
 * Lista de capas con controles de visibilidad, opacidad y orden
 */
@Component({
  selector: 'app-layer-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatExpansionModule,
    MatSliderModule,
    MatListModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    DragDropModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent, OnDestroy {
  readonly layerService = inject(LayerService);
  readonly channelConfigService = inject(ChannelConfigService);

  // Estado local
  searchText = signal('');

  // Control de reproducción automática
  private playIntervals = new Map<string, any>();
  playingLayers = new Map<string, boolean>();
  playSpeed = new Map<string, number>(); // segundos por frame

  constructor() {
    // Cargar configuraciones para capas activas al inicializar
    console.log(`🚀 [LayerList] Constructor - inicializando...`);
    // TEMPORALMENTE DESHABILITADO PARA DEBUG
    // setTimeout(() => {
    //   console.log(`🔍 [LayerList] Verificando capas activas en localStorage...`);
    //   this.loadConfigsForActiveLayers();
    // }, 100);
  }

  /**
   * Indica si hay búsqueda activa
   */
  hasSearch = computed(() => this.searchText().trim().length > 0);

  /**
   * Normaliza texto removiendo tildes y convirtiendo a minúsculas
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Grupos filtrados según el texto de búsqueda
   */
  filteredGroups = computed(() => {
    const search = this.normalizeText(this.searchText().trim());
    if (!search) {
      return this.layerService.layerGroups().map((group) => ({
        ...group,
        _shouldExpandGroup: false,
        subgroups: group.subgroups.map((sg) => ({ ...sg, _shouldExpandSubgroup: false })),
      }));
    }

    return this.layerService
      .layerGroups()
      .map((group) => {
        const groupNameMatches = this.normalizeText(group.name).includes(search);

        // Filtrar subgrupos y capas
        const filteredSubgroups = group.subgroups
          .map((subgroup) => {
            const subgroupNameMatches = this.normalizeText(subgroup.name).includes(search);
            const matchingLayers = subgroup.layers.filter((layer) =>
              this.normalizeText(layer.name).includes(search)
            );

            // Incluir todas las capas si coincide el grupo o subgrupo
            const layers =
              matchingLayers.length > 0 || subgroupNameMatches || groupNameMatches
                ? subgroup.layers.filter(
                    (layer) =>
                      this.normalizeText(layer.name).includes(search) ||
                      subgroupNameMatches ||
                      groupNameMatches
                  )
                : [];

            return {
              ...subgroup,
              layers,
              // Expandir subgrupo solo si hay capas específicas que coinciden
              _shouldExpandSubgroup: matchingLayers.length > 0,
            };
          })
          .filter((subgroup) => subgroup.layers.length > 0);

        // Expandir grupo si:
        // - Alguna capa específica coincide (hay subgrupos que deben expandirse)
        // - O si el nombre del subgrupo coincide (pero no el grupo en sí)
        const hasMatchingLayers = filteredSubgroups.some((sg) => sg._shouldExpandSubgroup);
        const hasMatchingSubgroups = filteredSubgroups.some((sg) =>
          this.normalizeText(sg.name).includes(search)
        );

        return {
          ...group,
          subgroups: filteredSubgroups,
          _shouldExpandGroup: hasMatchingLayers || (hasMatchingSubgroups && !groupNameMatches),
        };
      })
      .filter((group) => group.subgroups.length > 0);
  });

  /**
   * Implementación de MenuPanelComponent
   */
  onPanelOpen(): void {
    // Hook cuando el panel se abre
  }

  /**
   * Filtra capas visibles (para tab "Activas")
   */
  getActiveLayers(): Layer[] {
    return this.layerService.activeLayers();
  }

  /**
   * Maneja el drop en la lista de capas activas (drag & drop)
   */
  onLayerDrop(event: CdkDragDrop<Layer[]>): void {
    const activeLayers = [...this.getActiveLayers()];
    moveItemInArray(activeLayers, event.previousIndex, event.currentIndex);

    // Actualizar el orden de los zIndex
    const orderedIds = activeLayers.map((layer) => layer.id);
    this.layerService.setLayerOrder(orderedIds);
  }

  /**
   * Verifica si una capa está activa
   */
  isLayerActive(layerId: string): boolean {
    return this.getActiveLayers().some((layer) => layer.id === layerId);
  }

  /**
   * Activa una capa (agregar a las activas)
   */
  addLayer(layerId: string): void {
    // Si es una capa ABI y no tiene configuración cargada, cargarla PRIMERO
    if (layerId.startsWith('abi-') && !this.channelConfigService.hasConfig(layerId)) {
      console.log(`⏳ [LayerList] Cargando config ANTES de activar ${layerId}...`);
      this.loadInitialChannelConfig(layerId, () => {
        // Una vez cargada la config, activar la capa
        console.log(`✅ [LayerList] Config cargada, activando ${layerId}`);
        this.layerService.activateLayer(layerId);
      });
    } else {
      // Si ya tiene config o no es ABI, activar directamente
      this.layerService.activateLayer(layerId);
    }
  }

  /**
   * Carga la configuración inicial de un canal
   */
  private loadInitialChannelConfig(layerId: string, onSuccess?: () => void): void {
    // Determinar los parámetros del canal desde el layerId
    // Formato: abi-ch13 -> goes-19/abi/ch-13
    const parts = layerId.split('-');
    if (parts.length >= 2) {
      const instrument = parts[0]; // 'abi'
      const channelNumber = parts[1]; // 'ch13'
      const channel = `ch-${channelNumber.replace('ch', '')}`; // 'ch-13'
      const product = 'goes-19'; // Por defecto

      console.log(
        `📡 [LayerList] Solicitando config para ${layerId}: ${product}/${instrument}/${channel}`
      );

      this.channelConfigService.loadChannelConfig(layerId, product, instrument, channel).subscribe({
        next: (config) => {
          console.log(
            `✅ [LayerList] Configuración inicial de ${layerId} cargada exitosamente, tilesets: ${config.tilesets.length}`
          );
          // Ejecutar callback si se proveyó
          if (onSuccess) {
            onSuccess();
          }
        },
        error: (err) => {
          console.error(`❌ [LayerList] Error cargando configuración inicial de ${layerId}:`, err);
        },
      });
    }
  }

  /**
   * Fuerza la actualización de una capa (útil después de cargar configuración)
   */
  private forceLayerUpdate(layerId: string): void {
    const layer = this.getActiveLayers().find((l) => l.id === layerId);
    if (layer) {
      console.log(`🔄 [LayerList] Forzando update de capa ${layerId}, timeIndex: ${layer.timeIndex}`);
      // Trigger re-render cambiando temporalmente el timeIndex para forzar recreación
      const currentTimeIndex = layer.timeIndex ?? 0;
      this.layerService.setTimeIndex(layerId, currentTimeIndex + 1);
      setTimeout(() => {
        this.layerService.setTimeIndex(layerId, currentTimeIndex);
        console.log(`✅ [LayerList] Update completado para ${layerId}`);
      }, 50);
    } else {
      console.warn(`⚠️ [LayerList] No se encontró capa activa con id ${layerId} para actualizar`);
    }
  }

  /**
   * Carga configuraciones para todas las capas activas que las necesiten
   */
  private loadConfigsForActiveLayers(): void {
    const activeLayers = this.getActiveLayers();
    console.log(
      `📋 [LayerList] Capas activas encontradas:`,
      activeLayers.map((l) => l.id)
    );

    activeLayers.forEach((layer) => {
      const needsConfig =
        layer.id.startsWith('abi-') && !this.channelConfigService.hasConfig(layer.id);
      console.log(`🔍 [LayerList] ${layer.id} - needsConfig: ${needsConfig}`);

      if (needsConfig) {
        console.log(`🔄 [LayerList] Cargando configuración para capa restaurada: ${layer.id}`);
        this.loadInitialChannelConfig(layer.id);
      }
    });
  }

  /**
   * Reemplaza todas las capas con una nueva
   */
  replaceAllLayers(layerId: string): void {
    this.layerService.replaceAllWithLayer(layerId);
  }

  /**
   * Remueve una capa activa
   */
  removeLayer(layerId: string): void {
    this.layerService.deactivateLayer(layerId);
  }

  /**
   * Formatea el valor de opacidad para el slider
   */
  formatOpacity(value: number): string {
    return `${value}%`;
  }

  /**
   * Verifica si una capa tiene control de tiempo (tilesets múltiples)
   */
  hasTimeControl(layerId: string): boolean {
    return this.channelConfigService.hasConfig(layerId);
  }

  /**
   * Obtiene el índice máximo de tiempo para una capa
   */
  getMaxTimeIndex(layerId: string): number {
    const tilesets = this.channelConfigService.getTilesets(layerId);
    return Math.max(0, tilesets.length - 1);
  }

  /**
   * Maneja el cambio de índice de tiempo
   */
  onTimeIndexChange(layerId: string, timeIndex: number, fromPlay: boolean = false): void {
    console.log(`🕒 [LayerList] timeIndex cambio para ${layerId}: ${timeIndex}, fromPlay: ${fromPlay}`);
    
    // Si está reproduciendo y NO viene del play, pausar (el usuario está tomando control manual)
    if (!fromPlay && this.isPlaying(layerId)) {
      this.stopPlay(layerId);
    }

    this.layerService.setTimeIndex(layerId, timeIndex);
  }

  /**
   * Convierte año juliano a fecha normal
   */
  private julianToDate(year: string, dayOfYear: string): Date {
    const yearNum = parseInt(year);
    const dayNum = parseInt(dayOfYear);
    const date = new Date(yearNum, 0);
    date.setDate(dayNum);
    return date;
  }

  /**
   * Obtiene la etiqueta del tileset para mostrar (YYYY-MM-DD HH:MM)
   */
  getTimesetLabel(layerId: string, timeIndex: number): string {
    if (!this.channelConfigService.hasConfig(layerId)) {
      return 'Cargando...';
    }

    const tilesets = this.channelConfigService.getTilesets(layerId);
    if (timeIndex >= 0 && timeIndex < tilesets.length) {
      const tileset = tilesets[timeIndex];
      // Extraer información de fecha del ID (formato: OR_ABI-L1b-RadF-M6C13_G19_s20261234567)
      const match = tileset.id.match(/_s(\d{11})/);
      if (match) {
        const dateStr = match[1];
        const year = dateStr.substring(0, 4);
        const dayOfYear = dateStr.substring(4, 7);
        const hour = dateStr.substring(7, 9);
        const minute = dateStr.substring(9, 11);

        // Convertir día juliano a fecha
        const date = this.julianToDate(year, dayOfYear);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day} ${hour}:${minute}`;
      }
      return tileset.id;
    }
    return 'Sin datos';
  }

  /**
   * Obtiene solo la hora de un tileset (HH:MM)
   */
  getTimesetTime(layerId: string, timeIndex: number): string {
    if (!this.channelConfigService.hasConfig(layerId)) {
      return '--:--';
    }

    const tilesets = this.channelConfigService.getTilesets(layerId);
    if (timeIndex >= 0 && timeIndex < tilesets.length) {
      const tileset = tilesets[timeIndex];
      const match = tileset.id.match(/_s(\d{11})/);
      if (match) {
        const dateStr = match[1];
        const hour = dateStr.substring(7, 9);
        const minute = dateStr.substring(9, 11);
        return `${hour}:${minute}`;
      }
    }
    return '--:--';
  }

  /**
   * Inicia/pausa la reproducción automática
   */
  togglePlay(layerId: string): void {
    const isPlaying = this.playingLayers.get(layerId);

    if (isPlaying) {
      this.stopPlay(layerId);
    } else {
      this.startPlay(layerId);
    }
  }

  /**
   * Inicia la reproducción automática
   */
  private startPlay(layerId: string): void {
    this.playingLayers.set(layerId, true);
    const speed = this.playSpeed.get(layerId) || 1; // Default 1 segundo

    const interval = setInterval(() => {
      const layer = this.getActiveLayers().find((l) => l.id === layerId);
      if (!layer) {
        this.stopPlay(layerId);
        return;
      }

      const currentIndex = layer.timeIndex ?? 0;
      const maxIndex = this.getMaxTimeIndex(layerId);

      if (currentIndex >= maxIndex) {
        // Volver al inicio
        this.onTimeIndexChange(layerId, 0, true);
      } else {
        this.onTimeIndexChange(layerId, currentIndex + 1, true);
      }
    }, speed * 1000);

    this.playIntervals.set(layerId, interval);
  }

  /**
   * Detiene la reproducción automática
   */
  private stopPlay(layerId: string): void {
    this.playingLayers.set(layerId, false);
    const interval = this.playIntervals.get(layerId);
    if (interval) {
      clearInterval(interval);
      this.playIntervals.delete(layerId);
    }
  }

  /**
   * Verifica si una capa está reproduciéndose
   */
  isPlaying(layerId: string): boolean {
    return this.playingLayers.get(layerId) || false;
  }

  /**
   * Obtiene la velocidad de reproducción
   */
  getPlaySpeed(layerId: string): number {
    return this.playSpeed.get(layerId) || 1;
  }

  /**
   * Actualiza la velocidad de reproducción
   */
  setPlaySpeed(layerId: string, speed: number): void {
    this.playSpeed.set(layerId, Math.max(0.1, Math.min(10, speed)));

    // Si está reproduciéndose, reiniciar con nueva velocidad
    if (this.isPlaying(layerId)) {
      this.stopPlay(layerId);
      this.startPlay(layerId);
    }
  }

  /**
   * Limpia los intervalos al destruir el componente
   */
  ngOnDestroy(): void {
    this.playIntervals.forEach((interval) => clearInterval(interval));
    this.playIntervals.clear();
  }

  /**
   * Recarga la configuración de un canal (actualiza tilesets)
   */
  reloadChannelConfig(layerId: string): void {
    // Determinar los parámetros del canal desde el layerId
    // Formato: abi-ch13 -> goes-19/abi/ch-13
    const parts = layerId.split('-');
    if (parts.length >= 2) {
      const instrument = parts[0]; // 'abi'
      const channelNumber = parts[1]; // 'ch13'
      const channel = `ch-${channelNumber.replace('ch', '')}`; // 'ch-13'
      const product = 'goes-19'; // Por defecto

      this.channelConfigService
        .reloadChannelConfig(layerId, product, instrument, channel)
        .subscribe({
          next: () => {
            console.log(`✅ Configuración de ${layerId} recargada`);
          },
          error: (err) => {
            console.error(`❌ Error recargando ${layerId}:`, err);
          },
        });
    }
  }
}
