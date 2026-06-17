import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { of, switchMap } from 'rxjs';
import { Member, Naipe } from '../models/schedule.models';
import { AuthService } from '../services/auth.service';
import { ScheduleDataService } from '../services/schedule-data.service';

interface ClientSummary {
  id: string;
  name: string;
  activeMusicians: number;
  activeByNaipe: Record<Naipe, number>;
  members: Array<{
    id: string;
    name: string;
    naipe: Naipe;
    active: boolean;
  }>;
}

@Component({
  selector: 'app-admin-page',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss'
})
export class AdminPageComponent {
  private readonly data = inject(ScheduleDataService);
  private readonly auth = inject(AuthService);
  private readonly emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  readonly clients = toSignal(
    toObservable(this.auth.isLoggedIn).pipe(
      switchMap((isLoggedIn) => (isLoggedIn ? this.data.observeClients() : of([])))
    ),
    { initialValue: [] }
  );

  readonly appMembers = toSignal(
    toObservable(this.auth.isLoggedIn).pipe(
      switchMap((isLoggedIn) => (isLoggedIn ? this.data.observeAppMembers() : of([])))
    ),
    { initialValue: [] }
  );

  readonly clientSummaries = computed(() => {
    const members = this.appMembers();
    return this.clients().map((client) => this.toClientSummary(client.id, client.name, members));
  });

  readonly totalActiveMusicians = computed(
    () => this.appMembers().filter((member) => member.active).length
  );

  newClientName = '';
  clientErrorMessage = '';
  memberErrorMessage = '';

  newMemberName = '';
  newMemberNaipe: Naipe = 'Vocalista';
  newMemberEmail = '';

  constructor() {
    effect(() => {
      this.clients();
    });
  }

  async createClient() {
    this.clientErrorMessage = '';

    const name = this.newClientName.trim();
    if (!name) {
      return;
    }

    try {
      await this.data.createClient(name);
      this.newClientName = '';
    } catch {
      this.clientErrorMessage =
        'Sem permissão para criar cliente. Verifica regras Firestore e autenticação.';
    }
  }

  async addMember() {
    this.memberErrorMessage = '';

    const name = this.newMemberName.trim();
    if (!name) {
      return;
    }

    const email = this.maskEmail(this.newMemberEmail);
    if (email && !this.emailRegex.test(email)) {
      this.memberErrorMessage = 'Email inválido. Usa o formato nome@dominio.pt.';
      return;
    }

    try {
      await this.data.addMember({
        name,
        naipe: this.newMemberNaipe,
        email: email || undefined,
        active: true
      });

      this.newMemberName = '';
      this.newMemberEmail = '';
    } catch {
      this.memberErrorMessage =
        'Sem permissão para adicionar membro. Verifica regras Firestore e autenticação.';
    }
  }

  async deleteClient(clientId: string) {
    try {
      await this.data.deleteClient(clientId);
    } catch {
      this.clientErrorMessage =
        'Sem permissão para remover cliente. Verifica regras Firestore e autenticação.';
    }
  }

  async deleteMember(memberId: string) {
    try {
      await this.data.deleteMember(memberId);
    } catch {
      this.memberErrorMessage =
        'Sem permissão para remover membro. Verifica regras Firestore e autenticação.';
    }
  }

  updateEmailMask(value: string) {
    this.newMemberEmail = this.maskEmail(value);
  }

  private maskEmail(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
  }

  private toClientSummary(id: string, name: string, members: Member[]): ClientSummary {
    const activeByNaipe: Record<Naipe, number> = {
      Vocalista: 0,
      Guitarra: 0,
      Viola: 0
    };

    let activeMusicians = 0;

    for (const member of members) {
      if (!member.active) {
        continue;
      }

      activeMusicians += 1;
      activeByNaipe[member.naipe] += 1;
    }

    return {
      id,
      name,
      activeMusicians,
      activeByNaipe,
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        naipe: member.naipe,
        active: member.active
      }))
    };
  }
}
