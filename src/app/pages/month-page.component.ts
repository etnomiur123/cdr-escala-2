import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ScheduleDataService } from '../services/schedule-data.service';
import {
  AvailabilityResponse,
  CellFlagColor,
  Naipe,
  ScheduleSlot
} from '../models/schedule.models';

@Component({
  selector: 'app-month-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './month-page.component.html',
  styleUrl: './month-page.component.scss'
})
export class MonthPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(ScheduleDataService);
  readonly auth = inject(AuthService);

  readonly clientId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('clientId') ?? '')),
    { initialValue: '' }
  );

  readonly monthId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('monthId') ?? '')),
    { initialValue: '' }
  );

  readonly month = toSignal(
    combineLatest([toObservable(this.clientId), toObservable(this.monthId)]).pipe(
      switchMap(([clientId, monthId]) => {
        if (!clientId || !monthId) {
          return of(null);
        }

        return this.data.observeMonths(clientId).pipe(
          map((months) => months.find((month) => month.id === monthId) ?? null)
        );
      })
    ),
    { initialValue: null }
  );

  readonly allMonths = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((clientId) => (clientId ? this.data.observeMonths(clientId) : of([])))
    ),
    { initialValue: [] }
  );

  readonly slots = toSignal(
    combineLatest([toObservable(this.clientId), toObservable(this.monthId)]).pipe(
      switchMap(([clientId, monthId]) =>
        clientId && monthId ? this.data.observeSlots(clientId, monthId) : of([])
      )
    ),
    { initialValue: [] }
  );

  readonly members = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((clientId) => (clientId ? this.data.observeMembers(clientId) : of([])))
    ),
    { initialValue: [] }
  );

  readonly profile = toSignal(
    toObservable(computed(() => this.auth.user()?.uid ?? '')).pipe(
      switchMap((uid) => (uid ? this.data.observeUserProfile(uid) : of(null)))
    ),
    { initialValue: null }
  );

  readonly userAvailability = toSignal(
    combineLatest([
      toObservable(this.clientId),
      toObservable(this.monthId),
      toObservable(computed(() => this.auth.user()?.uid ?? ''))
    ]).pipe(
      switchMap(([clientId, monthId, uid]) => {
        if (!clientId || !monthId || !uid) {
          return of({
            uid: '',
            responses: {} as Record<string, AvailabilityResponse>,
            updatedAt: Date.now()
          });
        }
        return this.data.observeUserAvailability(clientId, monthId, uid);
      })
    ),
    {
      initialValue: {
        uid: '',
        responses: {} as Record<string, AvailabilityResponse>,
        updatedAt: Date.now()
      }
    }
  );

  readonly vocalistas = computed(() =>
    this.members().filter((member) => member.naipe === 'Vocalista' && member.active)
  );

  readonly guitarras = computed(() =>
    this.members().filter((member) => member.naipe === 'Guitarra' && member.active)
  );

  readonly violas = computed(() =>
    this.members().filter((member) => member.naipe === 'Viola' && member.active)
  );

  readonly activeTab = signal<'escala' | 'disponibilidade' | 'membros'>('escala');

  newSlotDay = 1;
  newSlotTime = '18:00';

  newMemberName = '';
  newMemberNaipe: Naipe = 'Vocalista';
  newMemberEmail = '';

  async addSlot() {
    const month = this.month();
    const clientId = this.clientId();
    const monthId = this.monthId();
    if (!month || !clientId || !monthId) {
      return;
    }

    const slot = this.data.createEmptySlot(this.newSlotDay, month.month, month.year);
    slot.time = this.newSlotTime;
    await this.data.addSlot(clientId, monthId, slot);
  }

  async saveSlot(slot: ScheduleSlot) {
    const clientId = this.clientId();
    const monthId = this.monthId();
    if (!clientId || !monthId || !slot.id) {
      return;
    }

    await this.data.updateSlot(clientId, monthId, slot.id, slot);
  }

  async deleteSlot(slotId: string) {
    const clientId = this.clientId();
    const monthId = this.monthId();
    if (!clientId || !monthId) {
      return;
    }

    await this.data.deleteSlot(clientId, monthId, slotId);
  }

  async setCellFlag(slot: ScheduleSlot, naipe: Naipe, color: CellFlagColor) {
    slot.flags[naipe] = color;
    await this.saveSlot(slot);
  }

  async setAssignment(slot: ScheduleSlot, naipe: Naipe, memberName: string) {
    slot.assignments[naipe] = memberName || null;
    await this.saveSlot(slot);
  }

  async saveAvailability(slotId: string, response: AvailabilityResponse) {
    const uid = this.auth.user()?.uid;
    const clientId = this.clientId();
    const monthId = this.monthId();

    if (!uid || !clientId || !monthId) {
      return;
    }

    await this.data.setAvailability(clientId, monthId, uid, slotId, response);
  }

  async addMember() {
    const clientId = this.clientId();
    if (!clientId || !this.newMemberName.trim()) {
      return;
    }

    await this.data.addMember(clientId, {
      name: this.newMemberName.trim(),
      naipe: this.newMemberNaipe,
      email: this.newMemberEmail.trim() || undefined,
      active: true
    });

    this.newMemberName = '';
    this.newMemberEmail = '';
  }

  async toggleMemberActive(memberId: string, active: boolean) {
    const clientId = this.clientId();
    if (!clientId) {
      return;
    }

    await this.data.updateMember(clientId, memberId, { active: !active });
  }

  flagClass(color: CellFlagColor): string {
    return color === 'none' ? '' : `flag-${color}`;
  }
}
