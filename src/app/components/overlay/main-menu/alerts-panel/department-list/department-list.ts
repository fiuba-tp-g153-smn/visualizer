import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Geometry } from 'geojson';
import { DetailItemComponent } from '../../../../shared/detail-item/detail-item';
import { DetailChipComponent } from '../../../../shared/detail-chip/detail-chip';
import { MapInfoService } from '../../../../../services/layers/map-info.service';

/** Minimal department shape shared by drafts (Department) and alerts (ActiveAlertDepartment). */
export interface DepartmentListItem {
  readonly name: string;
  readonly province?: string;
  readonly geometry?: Geometry;
}

interface ProvinceGroup {
  readonly province: string;
  readonly departments: ReadonlyArray<DepartmentListItem>;
  /** Departments split into two columns, filled alphabetically top-to-bottom. */
  readonly columns: readonly [ReadonlyArray<DepartmentListItem>, ReadonlyArray<DepartmentListItem>];
}

const NO_PROVINCE_LABEL = 'Sin provincia';

/**
 * Departments detail row with an inline expandable list grouped by province;
 * each province group can be collapsed independently.
 */
@Component({
  selector: 'app-department-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, DetailItemComponent, DetailChipComponent],
  templateUrl: './department-list.html',
  styleUrl: './department-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentListComponent {
  private readonly mapInfoService = inject(MapInfoService);

  readonly departments = input.required<ReadonlyArray<DepartmentListItem>>();

  readonly opened = output<void>();
  readonly closed = output<void>();
  readonly departmentHover = output<string>();
  /** Hovering a province emits the names of all its departments. */
  readonly provinceHover = output<ReadonlyArray<string>>();
  readonly departmentLeave = output<void>();

  readonly expanded = signal<boolean>(false);
  readonly expandedProvinces = signal<ReadonlySet<string>>(new Set());

  readonly groups = computed<ReadonlyArray<ProvinceGroup>>(() => {
    const byProvince = new Map<string, DepartmentListItem[]>();
    for (const dept of this.departments()) {
      const province = dept.province?.trim() || NO_PROVINCE_LABEL;
      const group = byProvince.get(province);
      if (group) {
        group.push(dept);
      } else {
        byProvince.set(province, [dept]);
      }
    }
    return [...byProvince.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([province, departments]) => {
        const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name));
        const splitAt = Math.ceil(sorted.length / 2);
        return {
          province,
          departments: sorted,
          columns: [sorted.slice(0, splitAt), sorted.slice(splitAt)],
        };
      });
  });

  toggle(): void {
    const next = !this.expanded();
    this.expanded.set(next);
    if (next) {
      // A single province expands directly; with several, start collapsed.
      const groups = this.groups();
      this.expandedProvinces.set(groups.length === 1 ? new Set([groups[0].province]) : new Set());
      this.opened.emit();
    } else {
      this.departmentLeave.emit();
      this.closed.emit();
    }
  }

  isProvinceExpanded(province: string): boolean {
    return this.expandedProvinces().has(province);
  }

  toggleProvince(province: string): void {
    const next = new Set(this.expandedProvinces());
    if (next.has(province)) {
      next.delete(province);
    } else {
      next.add(province);
    }
    this.expandedProvinces.set(next);
  }

  onHover(name: string): void {
    this.departmentHover.emit(name);
  }

  onClick(dept: DepartmentListItem): void {
    if (dept.geometry) {
      this.mapInfoService.flyToGeometry(dept.geometry);
    }
  }

  onProvinceHover(group: ProvinceGroup): void {
    this.provinceHover.emit(group.departments.map((d) => d.name));
  }

  onLeave(): void {
    this.departmentLeave.emit();
  }
}
