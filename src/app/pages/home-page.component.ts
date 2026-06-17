import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ScheduleDataService } from '../services/schedule-data.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  private readonly data = inject(ScheduleDataService);
  private readonly auth = inject(AuthService);

  readonly clients = toSignal(
    toObservable(this.auth.isLoggedIn).pipe(
      switchMap((isLoggedIn) => (isLoggedIn ? this.data.observeClients() : of([])))
    ),
    { initialValue: [] }
  );
  readonly selectedClientId = signal('');

  readonly monthSummaries = toSignal(
    toObservable(this.selectedClientId).pipe(
      switchMap((clientId) => (clientId ? this.data.observeMonthSummaries(clientId) : of([])))
    ),
    { initialValue: [] }
  );

  readonly selectedClient = computed(() =>
    this.clients().find((client) => client.id === this.selectedClientId())
  );

  newMonthYear = new Date().getFullYear();
  newMonthMonth = new Date().getMonth() + 1;

  constructor() {
    effect(() => {
      const clients = this.clients();
      if (!clients.length) {
        this.selectedClientId.set('');
        return;
      }

      if (!this.selectedClientId()) {
        this.selectedClientId.set(clients[0].id);
      }
    });
  }

  async createMonth() {
    const clientId = this.selectedClientId();
    if (!clientId) {
      return;
    }

    await this.data.createMonth(clientId, this.newMonthYear, this.newMonthMonth);
  }

  async toggleRequested(monthId: string, currentState: boolean) {
    const clientId = this.selectedClientId();
    if (!clientId) {
      return;
    }

    await this.data.updateMonthRequestState(clientId, monthId, !currentState);
  }
}
