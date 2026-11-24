import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import {
  EXPERIMENTAL_DISCLAIMER_REMIND_AFTER_MS,
  ExperimentalDisclaimerService,
} from './experimental-disclaimer.service';
import { STORAGE_KEYS } from '../../constants/storage-keys.constants';

describe('ExperimentalDisclaimerService', () => {
  let closed: Subject<void>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let service: ExperimentalDisclaimerService;

  beforeEach(() => {
    localStorage.clear();
    closed = new Subject();
    dialog = { open: vi.fn(() => ({ afterClosed: () => closed })) };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: dialog }] });
    service = TestBed.inject(ExperimentalDisclaimerService);
  });

  it('shows a notice that can only be closed by accepting it', () => {
    service.showIfNeeded();

    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ disableClose: true }),
    );
  });

  it('remembers the acceptance', () => {
    service.showIfNeeded();
    closed.next();

    service.showIfNeeded();

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('shows the notice again once the acceptance is old', () => {
    const acceptedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.EXPERIMENTAL_DISCLAIMER, JSON.stringify(acceptedAt));

    service.showIfNeeded(acceptedAt + EXPERIMENTAL_DISCLAIMER_REMIND_AFTER_MS + 1);

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('does not stack notices', () => {
    service.open();
    service.open();

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });
});
