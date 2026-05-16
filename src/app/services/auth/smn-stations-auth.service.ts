import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../../constants';
import {
  SmnAuthDialogComponent,
  SmnAuthDialogResult,
} from '../../components/floating/smn-auth-dialog/smn-auth-dialog';

interface StoredTokenState {
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class SmnStationsAuthService {
  private readonly dialog = inject(MatDialog);
  private readonly tokenChangeTick = signal(0);

  private authFlowInFlight: Promise<string | null> | null = null;

  readonly tokenChanges = this.tokenChangeTick.asReadonly();

  hasValidToken(): boolean {
    return this.readEffectiveToken() !== null;
  }

  getValidToken(): string | null {
    return this.readEffectiveToken();
  }

  setToken(token: string): void {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      this.clearToken();
      return;
    }

    this.storeToken(normalizedToken);
  }

  clearToken(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(STORAGE_KEYS.SMN_STATIONS_AUTH_TOKEN);
    this.notifyTokenChanged();
  }

  async ensureTokenWithPrompt(): Promise<string | null> {
    const cachedToken = this.readEffectiveToken();
    if (cachedToken) {
      return cachedToken;
    }

    if (!this.isPromptRequired()) {
      return null;
    }

    if (this.authFlowInFlight) {
      return this.authFlowInFlight;
    }

    this.authFlowInFlight = this.runInteractiveAuthFlow();
    try {
      return await this.authFlowInFlight;
    } finally {
      this.authFlowInFlight = null;
    }
  }

  async promptAndStoreToken(): Promise<boolean> {
    const token = await this.runInteractiveAuthFlow();
    return token !== null;
  }

  isPromptConfigurable(): boolean {
    return environment.smnApi.promptForToken;
  }

  isPromptRequired(): boolean {
    return this.isPromptConfigurable();
  }

  private async runInteractiveAuthFlow(): Promise<string | null> {
    const result = await this.promptToken();
    if (!result) {
      return null;
    }

    const token = result.token.trim();
    if (!token) {
      return null;
    }

    this.storeToken(token);
    return token;
  }

  private readEffectiveToken(): string | null {
    return this.readStoredToken();
  }

  private async promptToken(): Promise<SmnAuthDialogResult | null> {
    const dialogRef = this.dialog.open<
      SmnAuthDialogComponent,
      { token?: string; errorMessage?: string },
      SmnAuthDialogResult | null
    >(SmnAuthDialogComponent, {
      width: '420px',
      autoFocus: true,
      restoreFocus: true,
      disableClose: false,
      data: {
        token: '',
      },
    });

    return (await firstValueFrom(dialogRef.afterClosed())) ?? null;
  }

  private readStoredToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SMN_STATIONS_AUTH_TOKEN);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as StoredTokenState;
      if (!parsed.token) {
        return null;
      }

      return parsed.token;
    } catch {
      return null;
    }
  }

  private storeToken(token: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const payload: StoredTokenState = {
        token,
      };
      localStorage.setItem(STORAGE_KEYS.SMN_STATIONS_AUTH_TOKEN, JSON.stringify(payload));
      this.notifyTokenChanged();
    } catch {
      // Ignore storage failures.
    }
  }

  private notifyTokenChanged(): void {
    this.tokenChangeTick.update((value) => value + 1);
  }
}
