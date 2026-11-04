import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as echarts from 'echarts';

import { SyncPlaybackService } from '../../../services/layers/sync-playback.service';
import { LayersService } from '../../../services/layers/layers.service';
import { syncGroupDefinition } from '../../../config/layers/sync-groups.config';
import { SyncFrameSpec, SyncGroupId, SyncLayerStatus } from '../../../models';
import {
  formatDateFull,
  formatDateOnly,
  formatDateTimeOnly,
} from '../../../utils/tileset-timestamp';
import {
  SyncImage,
  SyncPlan,
  backwardsLayer,
  frameSpecs,
  frameWith,
  indexOfSpec,
  planFromSpecs,
  removeFrame,
  samePlan,
  setFrame,
  toggleImage,
} from '../../../utils/sync-alignment';
import {
  SyncChartLane,
  SyncChartTarget,
  SyncChartSpan,
  SYNC_CHART_GRID,
  buildSyncTimelineOption,
  cssVar,
  lanesSpan,
  sameLanes,
} from '../../../utils/sync-timeline-chart';

export interface SyncTimelineDialogData {
  readonly groupId: SyncGroupId;
}

/** Height of the chart, in px, and of each lane once there are enough to need more. */
const MIN_CHART_HEIGHT = 260;
const LANE_HEIGHT = 56;

/** Why a layer of the group sits outside its timeline, under its greyed-out lane. */
const LEFT_OUT_NOTES: Record<SyncLayerStatus, string> = {
  unaligned: 'sin horarios en común',
  excluded: 'no sincronizada',
  waiting: 'sin sincronizar',
  enrolled: '',
};

/** The frame being edited, kept apart from the saved frames until Listo writes it. */
interface Draft {
  /** The saved frame it edits; null for a new one. */
  readonly index: number | null;
  readonly spec: SyncFrameSpec;
}

/**
 * Shows a sync group's frames, one lane per layer and one line per frame, and lets the user
 * draw them by hand.
 *
 * A click on an image opens a draft: the frame that has it, or a new frame with it. Each
 * click on an image then adds it to the draft (replacing its layer's image) or takes it out,
 * in any order and skipping any layer; a click on a line opens that frame. The chart
 * previews the draft. Listo (Enter, a click on the background, or a double click on an
 * image, which also adds it) saves it and Cancelar (Esc) drops it; a new frame saves itself
 * once every layer is in.
 */
@Component({
  selector: 'app-sync-timeline-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  host: {
    '(keydown.delete)': 'deleteFrame()',
    '(keydown.enter)': 'onEnter($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
  templateUrl: './sync-timeline-dialog.html',
  styleUrl: './sync-timeline-dialog.scss',
})
export class SyncTimelineDialogComponent {
  private readonly syncService = inject(SyncPlaybackService);
  private readonly layersService = inject(LayersService);
  private readonly groupId = inject<SyncTimelineDialogData>(MAT_DIALOG_DATA).groupId;

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly actionButton = viewChild('actionButton', { read: ElementRef<HTMLElement> });
  private readonly chartEl = viewChild.required<ElementRef<HTMLDivElement>>('chart');
  private chart: echarts.ECharts | null = null;

  readonly definition = syncGroupDefinition(this.groupId);
  readonly isCustomized = computed(() => this.syncService.isCustomized(this.groupId));
  private readonly saved = computed(() => this.syncService.groupPlan(this.groupId), {
    equal: samePlan,
  });
  readonly frameCount = computed(() => this.saved().frames.length);
  readonly imageCountOptions = this.syncService.frameCountOptions(this.groupId);
  readonly imageCount = computed(() => this.syncService.frameCount(this.groupId));

  private readonly names = computed(
    () =>
      new Map(
        this.syncService
          .groupLayers(this.groupId)
          .map(({ layer }) => [layer.id, this.layersService.getLayerFullName(layer)]),
      ),
  );

  // Layers re-list their images every few seconds; equal lanes keep the chart still.
  /** The lanes of the layers that follow the group's timeline, the ones frames join. */
  readonly lanes = computed(
    (): SyncChartLane[] =>
      this.syncService
        .groupTimelines(this.groupId)
        .filter(({ id }) => this.syncService.enrolledLayerIds(this.groupId).includes(id))
        .map(({ id, timestamps }) => ({
          id,
          name: this.names().get(id) ?? id,
          timestamps,
        })),
    { equal: sameLanes },
  );

  /**
   * Every layer of the group with images, in the group's order so syncing one or not never
   * moves the lanes: those lanes, and the others greyed out with why they are left out.
   */
  private readonly chartLanes = computed(
    (): SyncChartLane[] => {
      const synced = new Map(this.lanes().map((lane) => [lane.id, lane]));
      const others = new Map(
        this.syncService
          .groupOtherTimelines(this.groupId)
          .map(({ timeline, status }) => [timeline.id, { timeline, status }]),
      );
      return this.syncService.groupLayers(this.groupId).flatMap(({ layer }): SyncChartLane[] => {
        const lane = synced.get(layer.id);
        if (lane) return [lane];
        const other = others.get(layer.id);
        if (!other) return [];
        return [
          {
            id: layer.id,
            name: this.names().get(layer.id) ?? layer.id,
            timestamps: other.timeline.timestamps,
            note: LEFT_OUT_NOTES[other.status],
          },
        ];
      });
    },
    { equal: sameLanes },
  );

  /** The lane names, beside the chart, each with the checkbox that syncs its layer or not. */
  readonly laneRows = computed(() => {
    const statuses = new Map(
      this.syncService.groupLayers(this.groupId).map(({ layer, status }) => [layer.id, status]),
    );
    return this.chartLanes().map((lane) => ({
      ...lane,
      included: statuses.get(lane.id) !== 'excluded',
    }));
  });
  readonly grid = SYNC_CHART_GRID;
  /** Tall enough for every lane to keep room for its dots and two-line name. */
  readonly chartHeight = computed(() =>
    Math.max(
      MIN_CHART_HEIGHT,
      this.laneRows().length * LANE_HEIGHT + this.grid.top + this.grid.bottom,
    ),
  );

  readonly draft = signal<Draft | null>(null);
  /** The frame line under the pointer. */
  private readonly hovered = signal<number | null>(null);
  /** The frame the group is showing, while it plays its saved frames. */
  private readonly current = computed(() =>
    this.draft() || !this.syncService.canPlay(this.groupId)
      ? null
      : this.syncService.groupState(this.groupId).frameIndex,
  );

  /** What the chart draws: the saved frames, with the draft in place while there is one. */
  private readonly plan = computed((): SyncPlan => {
    const draft = this.draft();
    if (!draft) return this.saved();
    return planFromSpecs(this.lanes(), setFrame(this.savedSpecs(), draft.index, draft.spec));
  });

  /** Where the draft sits in that plan (frames sort by time), its line drawn thicker. */
  private readonly draftLine = computed(() => {
    const draft = this.draft();
    return draft ? indexOfSpec(frameSpecs(this.plan(), this.lanes()), draft.spec) : null;
  });

  /** What to do with no draft open, or why the group can't sync yet. */
  readonly hint = computed(() =>
    this.lanes().length > 0
      ? 'Clic en puntos de distintas capas para unirlos en un cuadro'
      : (this.syncService.groupHint(this.groupId) ?? ''),
  );

  /** The layer the draft would send back in time, crossing another frame's line. */
  readonly crossing = computed(() => {
    const back = this.draft() ? backwardsLayer(this.plan()) : null;
    return back ? (this.names().get(back.layerId) ?? back.layerId) : null;
  });

  readonly status = computed(() => {
    const crossing = this.crossing();
    if (crossing) return `Cruza otro cuadro en ${crossing}: ninguna capa puede volver atrás`;
    const line = this.draftLine();
    const frame = line === null ? undefined : this.plan().frames[line];
    return this.draft()?.index === null || !frame
      ? 'Clic en puntos de otras capas para sumarlos'
      : `Cuadro ${line! + 1} · ${formatDateFull(new Date(frame.time))}`;
  });

  /**
   * The time axis only grows while the dialog is open: an image dropping off a layer's
   * list must not shift every dot under the pointer.
   */
  private span: SyncChartSpan | null = null;

  constructor() {
    afterNextRender(() => {
      const host = this.chartEl().nativeElement;
      this.chart = echarts.init(host);
      const targetOf = (params: { data?: unknown }) =>
        (params.data as { target?: SyncChartTarget } | undefined)?.target;
      this.chart.on('click', (params) => {
        const target = targetOf(params);
        if (target?.kind === 'frame') this.onLine(target.index);
        if (target?.kind === 'image') this.onImage(target);
      });
      // Both clicks of a double click land first, taking the image in and out again.
      this.chart.on('dblclick', (params) => {
        const target = targetOf(params);
        if (target?.kind === 'image') this.doneWith(target);
      });
      this.chart.on('mouseover', (params) => {
        const target = targetOf(params);
        if (target?.kind === 'frame') this.hovered.set(target.index);
      });
      this.chart.on('mouseout', () => this.hovered.set(null));
      // A redraw replaces the line under the pointer without a mouseout: clear it off any line.
      this.chart.getZr().on('mousemove', (event) => {
        if (!event.target) this.hovered.set(null);
      });
      this.chart.getZr().on('globalout', () => this.hovered.set(null));
      this.chart.getZr().on('click', (event) => {
        if (!event.target) this.done();
      });
      const resizeObserver = new ResizeObserver(() => this.chart?.resize());
      resizeObserver.observe(host);
      this.destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        this.chart?.dispose();
      });
      this.render();
    });

    effect(() => this.render());
  }

  /** Saves the draft. */
  /** Saves the draft, unless it crosses another frame. */
  done(): void {
    const draft = this.draft();
    if (!draft || this.crossing()) return;
    this.draft.set(null);
    this.save(setFrame(this.savedSpecs(), draft.index, draft.spec));
  }

  cancel(): void {
    this.draft.set(null);
  }

  /** Deletes the saved frame being edited (also on the Supr key). */
  deleteFrame(): void {
    const index = this.draft()?.index ?? null;
    if (index === null) return;
    this.draft.set(null);
    this.save(removeFrame(this.savedSpecs(), index));
  }

  clearFrames(): void {
    this.draft.set(null);
    this.save([]);
  }

  /** Syncs a layer or not, as its checkbox in the tab does. */
  setIncluded(layerId: string, included: boolean): void {
    this.draft.set(null);
    this.syncService.setLayerIncluded(layerId, included);
  }

  /** Images of the automatic frames; choosing again goes back to them, like in the tab. */
  setImageCount(count: number): void {
    this.draft.set(null);
    this.syncService.setFrameCount(this.groupId, count);
  }

  reset(): void {
    this.draft.set(null);
    this.syncService.resetCustomization(this.groupId);
  }

  /** Enter is Listo, unless it presses a button of its own. */
  onEnter(event: Event): void {
    if (!(event.target instanceof HTMLButtonElement)) this.done();
  }

  /** Esc drops the draft; without one, it closes the dialog as usual. */
  onEscape(event: Event): void {
    if (!this.draft()) return;
    event.stopPropagation();
    this.cancel();
  }

  private savedSpecs(): SyncFrameSpec[] {
    return frameSpecs(this.saved(), this.lanes());
  }

  private save(specs: readonly SyncFrameSpec[]): void {
    this.syncService.setFrames(this.groupId, specs);
  }

  /** The draft an image opens: the saved frame that has it, or a new frame with it alone. */
  private draftFor(image: SyncImage): Draft {
    const specs = this.savedSpecs();
    const index = frameWith(specs, image);
    return index >= 0
      ? { index, spec: specs[index] }
      : { index: null, spec: { [image.layerId]: image.time } };
  }

  /** A click on a line opens that frame, or saves it when it is the open one. */
  private onLine(line: number): void {
    const isOpen = this.draftLine() === line;
    this.done();
    if (!isOpen) this.draft.set({ index: line, spec: this.savedSpecs()[line] });
    this.focusAction();
  }

  private onImage(image: SyncImage): void {
    const draft = this.draft();
    if (!draft) {
      this.draft.set(this.draftFor(image));
    } else {
      const spec = toggleImage(draft.spec, image);
      const size = Object.keys(spec).length;
      // An emptied saved frame stays open, so Listo deletes it; an emptied new one is dropped.
      this.draft.set(size > 0 || draft.index !== null ? { ...draft, spec } : null);
      const complete = draft.index === null && size === this.lanes().length;
      if (complete) this.done();
    }
    this.focusAction();
  }

  /** Saves the draft with the image in it, opening one for the image if there is none. */
  private doneWith(image: SyncImage): void {
    const draft = this.draft() ?? this.draftFor(image);
    this.draft.set({ ...draft, spec: { ...draft.spec, [image.layerId]: image.time } });
    this.done();
  }

  /** Clicks on the canvas leave focus nowhere; move it to the draft's Listo. */
  private focusAction(): void {
    afterNextRender(() => this.actionButton()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  private render(): void {
    const lanes = this.chartLanes();
    const plan = this.plan();
    const selection = {
      active: this.draft()?.spec ?? null,
      selected: this.draftLine(),
      invalid: this.crossing() !== null,
      hovered: this.hovered(),
      current: this.current(),
    };
    if (!this.chart) return;
    const span = lanesSpan(lanes);
    if (span) {
      this.span = this.span
        ? { min: Math.min(this.span.min, span.min), max: Math.max(this.span.max, span.max) }
        : span;
    }
    const option = buildSyncTimelineOption(
      lanes,
      plan,
      {
        primary: cssVar('--mat-sys-primary', '#0090d0'),
        error: cssVar('--mat-sys-error', '#ba1a1a'),
        muted: cssVar('--mat-sys-outline', '#73777c'),
        grid: cssVar('--mat-sys-outline-variant', '#c3c7cc'),
        text: cssVar('--mat-sys-on-surface-variant', '#43474c'),
        surface: cssVar('--mat-sys-surface-container-high', '#ffffff'),
      },
      {
        time: (time) => formatDateTimeOnly(new Date(time)),
        day: (time) => formatDateOnly(new Date(time)).slice(5).split('-').reverse().join('/'),
        full: (time) => formatDateFull(new Date(time)),
      },
      selection,
      this.span,
    );
    this.chart.setOption(option as Parameters<echarts.ECharts['setOption']>[0], true);
  }
}
