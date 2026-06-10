import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ScheduleDataService } from '../services/schedule-data.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  private readonly data = inject(ScheduleDataService);
  readonly auth = inject(AuthService);

  readonly clients = toSignal(this.data.observeClients(), { initialValue: [] });
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

  newClientName = '';

  newMonthYear = new Date().getFullYear();
  newMonthMonth = new Date().getMonth() + 1;
  errorMessage = '';

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

  async createClient() {
    this.errorMessage = '';
    if (!this.auth.isLoggedIn()) {
      this.errorMessage = 'Precisas de iniciar sessao com Google para criares clientes.';
      return;
    }

    const name = this.newClientName.trim();
    if (!name) {
      return;
    }

    try {
      await this.data.createClient(name);
      this.newClientName = '';
    } catch {
      this.errorMessage = 'Sem permissao para criar cliente. Verifica regras Firestore e autenticacao.';
    }
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
