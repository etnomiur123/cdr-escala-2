import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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

interface MemberOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-month-page',
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
    combineLatest([
      toObservable(this.clientId),
      toObservable(this.monthId),
      toObservable(this.auth.isLoggedIn)
    ]).pipe(
      switchMap(([clientId, monthId, isLoggedIn]) => {
        if (!clientId || !monthId || !isLoggedIn) {
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
    combineLatest([
      toObservable(this.clientId),
      toObservable(this.auth.isLoggedIn)
    ]).pipe(
      switchMap(([clientId, isLoggedIn]) =>
        clientId && isLoggedIn ? this.data.observeMonths(clientId) : of([])
      )
    ),
    { initialValue: [] }
  );

  readonly slots = toSignal(
    combineLatest([
      toObservable(this.clientId),
      toObservable(this.monthId),
      toObservable(this.auth.isLoggedIn)
    ]).pipe(
      switchMap(([clientId, monthId, isLoggedIn]) =>
        clientId && monthId && isLoggedIn ? this.data.observeSlots(clientId, monthId) : of([])
      )
    ),
    { initialValue: [] }
  );

  readonly members = toSignal(
    combineLatest([
      toObservable(this.clientId),
      toObservable(this.auth.isLoggedIn)
    ]).pipe(
      switchMap(([clientId, isLoggedIn]) =>
        clientId && isLoggedIn ? this.data.observeClientMembers(clientId) : of([])
      )
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

  readonly vocalistas = computed(() => this.memberOptionsForNaipe('Vocalista'));

  readonly guitarras = computed(() => this.memberOptionsForNaipe('Guitarra'));

  readonly violas = computed(() => this.memberOptionsForNaipe('Viola'));

  readonly activeTab = signal<'escala' | 'disponibilidade' | 'membros'>('escala');

  newSlotDay = 1;
  newSlotTime = '18:00';

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

  flagClass(color: CellFlagColor): string {
    return color === 'none' ? '' : `flag-${color}`;
  }

  private memberOptionsForNaipe(naipe: Naipe): MemberOption[] {
    const options: MemberOption[] = this.members()
      .filter((member) => member.naipe === naipe && member.active)
      .map((member) => ({
        id: member.id,
        name: member.name
      }));

    const profile = this.profile();
    const authUser = this.auth.user();
    const userName = authUser?.displayName?.trim() || authUser?.email?.trim() || '';

    if (profile?.naipe === naipe && authUser?.uid && userName) {
      const alreadyInList = options.some((item) => item.name.toLowerCase() === userName.toLowerCase());
      if (!alreadyInList) {
        options.unshift({
          id: `user-${authUser.uid}`,
          name: userName
        });
      }
    }

    return options;
  }
}
