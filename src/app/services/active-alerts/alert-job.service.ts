import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AlertJobStatus,
  DepartmentIntersectionService,
} from '../polygons/department-intersection.service';

/** How often the job status is polled while generation is in progress. */
const POLL_INTERVAL_MS = 2_000;
/**
 * Upper bound on how long we wait before giving up on a job. Kept above the
 * backend per-job timeout (150 s) so we reliably receive its definitive
 * `failed` (e.g. error_code "timeout") rather than guessing client-side.
 */
const POLL_TIMEOUT_MS = 180_000;
const HTTP_STATUS_NOT_FOUND = 404;

/** Terminal statuses returned by the backend. */
export const JOB_DONE = 'done';
export const JOB_FAILED = 'failed';

/** Client-only terminal statuses layered on top of the backend ones. */
export const JOB_TIMEOUT = 'timeout';
export const JOB_UNKNOWN = 'unknown';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `GET /alerts/jobs/{id}` until a background alert generation job reaches
 * a terminal state (`done`/`failed`), the server forgets it (`404`), or a
 * timeout elapses. Transient network errors are retried until the deadline.
 */
@Injectable({ providedIn: 'root' })
export class AlertJobService {
  private readonly departmentIntersectionService = inject(DepartmentIntersectionService);

  async poll(jobId: string): Promise<AlertJobStatus> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const status = await firstValueFrom(
          this.departmentIntersectionService.getAlertJob(jobId),
        );
        if (status.status === JOB_DONE || status.status === JOB_FAILED) {
          return status;
        }
      } catch (error: unknown) {
        if (error instanceof HttpErrorResponse && error.status === HTTP_STATUS_NOT_FOUND) {
          return this.synthetic(jobId, JOB_UNKNOWN);
        }
        // Transient error (network/5xx): keep polling until the deadline.
      }
      await delay(POLL_INTERVAL_MS);
    }
    return this.synthetic(jobId, JOB_TIMEOUT);
  }

  private synthetic(jobId: string, status: string): AlertJobStatus {
    return { job_id: jobId, status, alert_id: null, error_code: null, error: null };
  }
}
