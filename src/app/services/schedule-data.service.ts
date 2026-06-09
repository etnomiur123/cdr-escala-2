import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { combineLatest, map, of, switchMap } from 'rxjs';
import {
  AvailabilityByUser,
  AvailabilityResponse,
  Client,
  Member,
  MonthPlan,
  MonthSummary,
  Naipe,
  ScheduleSlot,
  UserProfile
} from '../models/schedule.models';

@Injectable({ providedIn: 'root' })
export class ScheduleDataService {
  private readonly firestore = inject(Firestore);

  observeClients() {
    const clientsRef = collection(this.firestore, 'clients');
    return collectionData(clientsRef, { idField: 'id' }) as unknown as ReturnType<
      () => import('rxjs').Observable<Client[]>
    >;
  }

  async createClient(name: string): Promise<void> {
    const clientsRef = collection(this.firestore, 'clients');
    await addDoc(clientsRef, {
      name,
      createdAt: Date.now()
    });
  }

  observeMonths(clientId: string) {
    const monthsRef = collection(this.firestore, `clients/${clientId}/months`);
    return collectionData(monthsRef, { idField: 'id' }).pipe(
      map((items) =>
        (items as MonthPlan[]).sort((a, b) => {
          if (a.year === b.year) {
            return a.month - b.month;
          }
          return a.year - b.year;
        })
      )
    );
  }

  observeMonthSummaries(clientId: string) {
    return this.observeMonths(clientId).pipe(
      switchMap((months) => {
        if (!months.length) {
          return of([] as MonthSummary[]);
        }

        const summaryStreams = months.map((month) =>
          combineLatest([
            this.observeSlots(clientId, month.id),
            this.observeAvailabilityDocs(clientId, month.id)
          ]).pipe(
            map(([slots, availabilityDocs]) => {
              const respondedSlotIds = new Set<string>();
              for (const availabilityDoc of availabilityDocs) {
                Object.entries(availabilityDoc.responses).forEach(([slotId, response]) => {
                  if (response) {
                    respondedSlotIds.add(slotId);
                  }
                });
              }

              const slotsCount = slots.length;
              const respondedSlotsCount = respondedSlotIds.size;
              let status: MonthSummary['status'];

              if (!month.availabilityRequested) {
                status = 'Por requisitar';
              } else if (respondedSlotsCount === 0) {
                status = 'Vazio';
              } else if (slotsCount > 0 && respondedSlotsCount >= slotsCount) {
                status = 'Totalmente preenchidas';
              } else {
                status = 'Parcialmente preenchidas';
              }

              return {
                month,
                status,
                slotsCount,
                respondedSlotsCount
              } satisfies MonthSummary;
            })
          )
        );

        return combineLatest(summaryStreams);
      })
    );
  }

  async createMonth(clientId: string, year: number, month: number): Promise<void> {
    const monthId = this.toMonthId(year, month);
    const monthRef = doc(this.firestore, `clients/${clientId}/months/${monthId}`);

    await setDoc(monthRef, {
      id: monthId,
      clientId,
      year,
      month,
      label: this.formatMonthLabel(year, month),
      availabilityRequested: true,
      createdAt: Date.now()
    });
  }

  async updateMonthRequestState(
    clientId: string,
    monthId: string,
    availabilityRequested: boolean
  ): Promise<void> {
    const monthRef = doc(this.firestore, `clients/${clientId}/months/${monthId}`);
    await updateDoc(monthRef, { availabilityRequested });
  }

  observeSlots(clientId: string, monthId: string) {
    const slotsRef = collection(this.firestore, `clients/${clientId}/months/${monthId}/slots`);
    return collectionData(slotsRef, { idField: 'id' }).pipe(
      map((items) =>
        (items as ScheduleSlot[]).sort((a, b) => {
          if (a.date === b.date) {
            return a.time.localeCompare(b.time);
          }
          return a.date.localeCompare(b.date);
        })
      )
    );
  }

  async addSlot(clientId: string, monthId: string, slot: Omit<ScheduleSlot, 'id'>): Promise<void> {
    const slotsRef = collection(this.firestore, `clients/${clientId}/months/${monthId}/slots`);
    await addDoc(slotsRef, slot);
  }

  async updateSlot(clientId: string, monthId: string, slotId: string, changes: Partial<ScheduleSlot>) {
    const slotRef = doc(this.firestore, `clients/${clientId}/months/${monthId}/slots/${slotId}`);
    await updateDoc(slotRef, {
      ...changes,
      updatedAt: Date.now()
    });
  }

  async deleteSlot(clientId: string, monthId: string, slotId: string) {
    const slotRef = doc(this.firestore, `clients/${clientId}/months/${monthId}/slots/${slotId}`);
    await deleteDoc(slotRef);
  }

  observeMembers(clientId: string) {
    const membersRef = collection(this.firestore, `clients/${clientId}/members`);
    return collectionData(membersRef, { idField: 'id' }).pipe(
      map((items) => (items as Member[]).sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  async addMember(clientId: string, member: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) {
    const membersRef = collection(this.firestore, `clients/${clientId}/members`);
    await addDoc(membersRef, {
      ...member,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  async updateMember(clientId: string, memberId: string, changes: Partial<Member>) {
    const memberRef = doc(this.firestore, `clients/${clientId}/members/${memberId}`);
    await updateDoc(memberRef, {
      ...changes,
      updatedAt: Date.now()
    });
  }

  observeUserProfile(uid: string) {
    const userRef = doc(this.firestore, `users/${uid}`);
    return docData(userRef, { idField: 'uid' }) as unknown as ReturnType<
      () => import('rxjs').Observable<UserProfile>
    >;
  }

  async updateUserNaipe(uid: string, naipe: Naipe) {
    const userRef = doc(this.firestore, `users/${uid}`);
    await setDoc(
      userRef,
      {
        naipe,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  }

  observeAvailabilityDocs(clientId: string, monthId: string) {
    const availabilityRef = collection(
      this.firestore,
      `clients/${clientId}/months/${monthId}/availabilities`
    );
    return collectionData(availabilityRef, { idField: 'uid' }) as unknown as ReturnType<
      () => import('rxjs').Observable<AvailabilityByUser[]>
    >;
  }

  observeUserAvailability(clientId: string, monthId: string, uid: string) {
    const availabilityRef = doc(
      this.firestore,
      `clients/${clientId}/months/${monthId}/availabilities/${uid}`
    );

    return docData(availabilityRef, { idField: 'uid' }).pipe(
      map((item) => {
        if (!item) {
          return {
            uid,
            responses: {},
            updatedAt: Date.now()
          } satisfies AvailabilityByUser;
        }
        return item as AvailabilityByUser;
      })
    );
  }

  async setAvailability(
    clientId: string,
    monthId: string,
    uid: string,
    slotId: string,
    response: AvailabilityResponse
  ) {
    const availabilityRef = doc(
      this.firestore,
      `clients/${clientId}/months/${monthId}/availabilities/${uid}`
    );

    await setDoc(
      availabilityRef,
      {
        uid,
        [`responses.${slotId}`]: response,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  }

  createEmptySlot(day: number, month: number, year: number): Omit<ScheduleSlot, 'id'> {
    const date = new Date(year, month - 1, day);
    return {
      date: this.toIsoDate(date),
      dayOfWeek: this.formatDayOfWeek(date),
      time: '18:00',
      assignments: {
        Vocalista: null,
        Guitarra: null,
        Viola: null
      },
      flags: {
        Vocalista: 'none',
        Guitarra: 'none',
        Viola: 'none'
      },
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  formatMonthLabel(year: number, month: number): string {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  }

  toMonthId(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDayOfWeek(date: Date): string {
    return date.toLocaleDateString('pt-PT', { weekday: 'long' });
  }
}
