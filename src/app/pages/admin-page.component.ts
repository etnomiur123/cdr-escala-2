import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { MemberFormRowComponent, MemberFormValue } from '../components/member-form-row.component';
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
    MatSelectModule,
    MemberFormRowComponent
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss'
})
export class AdminPageComponent {
  private readonly data = inject(ScheduleDataService);
  private readonly auth = inject(AuthService);
  private readonly emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  readonly editingMemberId = signal<string | null>(null);
  readonly memberToAddByClient = signal<Record<string, string>>({});

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

  readonly clientSummaries = toSignal(
    toObservable(this.clients).pipe(
      switchMap((clients) => {
        if (!clients.length) {
          return of([] as ClientSummary[]);
        }

        const summaryStreams = clients.map((client) =>
          this.data.observeClientMembers(client.id).pipe(
            map((members) => this.toClientSummary(client.id, client.name, members))
          )
        );

        return combineLatest(summaryStreams);
      })
    ),
    { initialValue: [] }
  );

  readonly totalActiveMusicians = computed(
    () => this.appMembers().filter((member) => member.active).length
  );

  newClientName = '';
  clientErrorMessage = '';
  memberErrorMessage = '';

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

  async addMember(value: MemberFormValue) {
    this.memberErrorMessage = '';

    const name = value.name.trim();
    if (!name) {
      return;
    }

    const email = this.maskEmail(value.email);
    if (email && !this.emailRegex.test(email)) {
      this.memberErrorMessage = 'Email inválido. Usa o formato nome@dominio.pt.';
      return;
    }

    try {
      await this.data.addMember({
        name,
        naipe: value.naipe,
        email: email || undefined,
        active: true
      });
    } catch {
      this.memberErrorMessage =
        'Sem permissão para adicionar membro. Verifica regras Firestore e autenticação.';
    }
  }

  startEditMember(member: Member) {
    this.memberErrorMessage = '';
    this.editingMemberId.set(member.id);
  }

  cancelEditMember() {
    this.editingMemberId.set(null);
    this.memberErrorMessage = '';
  }

  async saveMemberEdit(memberId: string, value: MemberFormValue) {
    this.memberErrorMessage = '';

    const name = value.name.trim();
    if (!name) {
      this.memberErrorMessage = 'Nome é obrigatório.';
      return;
    }

    const email = this.maskEmail(value.email);
    if (email && !this.emailRegex.test(email)) {
      this.memberErrorMessage = 'Email inválido. Usa o formato nome@dominio.pt.';
      return;
    }

    try {
      await this.data.updateMember(memberId, {
        name,
        naipe: value.naipe,
        email: email || undefined
      });
      this.editingMemberId.set(null);
    } catch {
      this.memberErrorMessage =
        'Sem permissão para editar membro. Verifica regras Firestore e autenticação.';
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

  async removeMemberFromClient(clientId: string, memberId: string) {
    try {
      const allMemberIds = this.appMembers().map((member) => member.id);
      await this.data.removeMemberFromClient(clientId, memberId, allMemberIds);
    } catch {
      this.memberErrorMessage =
        'Sem permissão para remover membro do cliente. Verifica regras Firestore e autenticação.';
    }
  }

  availableMembersForClient(summary: ClientSummary): Member[] {
    const existing = new Set(summary.members.map((member) => member.id));
    return this.appMembers().filter((member) => !existing.has(member.id));
  }

  setMemberToAdd(clientId: string, memberId: string) {
    this.memberToAddByClient.update((selection) => ({ ...selection, [clientId]: memberId }));
  }

  async addMemberToClient(clientId: string) {
    const memberId = this.memberToAddByClient()[clientId];
    if (!memberId) {
      return;
    }

    try {
      await this.data.addMemberToClient(clientId, memberId);
      this.memberToAddByClient.update((selection) => {
        const next = { ...selection };
        delete next[clientId];
        return next;
      });
    } catch {
      this.memberErrorMessage =
        'Sem permissão para adicionar membro ao cliente. Verifica regras Firestore e autenticação.';
    }
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
