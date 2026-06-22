import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteField,
  deleteDoc,
  doc,
  docData,
  getDocs,
  setDoc,
  writeBatch,
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

  async deleteClient(clientId: string): Promise<void> {
    const monthsRef = collection(this.firestore, `clients/${clientId}/months`);
    const monthsSnapshot = await getDocs(monthsRef);

    for (const monthDoc of monthsSnapshot.docs) {
      const monthBasePath = `clients/${clientId}/months/${monthDoc.id}`;
      await this.deleteCollectionDocs(`${monthBasePath}/slots`);
      await this.deleteCollectionDocs(`${monthBasePath}/availabilities`);
      await deleteDoc(monthDoc.ref);
    }

    // Legacy path from earlier model versions where members were nested under each client.
    await this.deleteCollectionDocs(`clients/${clientId}/members`);

    const clientRef = doc(this.firestore, `clients/${clientId}`);
    await deleteDoc(clientRef);
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

  observeAppMembers() {
    const membersRef = collection(this.firestore, 'members');
    return collectionData(membersRef, { idField: 'id' }).pipe(
      map((items) => (items as Member[]).sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  observeClientMemberIds(clientId: string) {
    const membersRef = collection(this.firestore, `clients/${clientId}/members`);
    return collectionData(membersRef, { idField: 'id' }).pipe(
      map((items) => (items as Array<{ id: string }>).map((item) => item.id))
    );
  }

  observeClientMembers(clientId: string) {
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const client$ = docData(clientRef) as unknown as import('rxjs').Observable<Client | undefined>;
    return combineLatest([
      this.observeAppMembers(),
      this.observeClientMemberIds(clientId),
      client$
    ]).pipe(
      map(([allMembers, memberIds, client]) => {
        const membersConfigured = client?.membersConfigured === true;

        // Legacy mode: associations were never explicitly configured, so all global members are available.
        if (!membersConfigured && !memberIds.length) {
          return allMembers;
        }

        const allowed = new Set(memberIds);
        return allMembers.filter((member) => allowed.has(member.id));
      })
    );
  }

  async addMember(member: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const membersRef = collection(this.firestore, 'members');
    const memberRef = await addDoc(membersRef, {
      ...member,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await this.addMemberToConfiguredClients(memberRef.id);

    return memberRef.id;
  }

  async deleteMember(memberId: string): Promise<void> {
    const memberRef = doc(this.firestore, `members/${memberId}`);
    await deleteDoc(memberRef);
  }

  async updateMember(memberId: string, changes: Pick<Member, 'name' | 'naipe'> & { email?: string }) {
    const memberRef = doc(this.firestore, `members/${memberId}`);
    await updateDoc(memberRef, {
      name: changes.name,
      naipe: changes.naipe,
      email: changes.email || deleteField(),
      updatedAt: Date.now()
    });
  }

  async addMemberToClient(clientId: string, memberId: string): Promise<void> {
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const batch = writeBatch(this.firestore);

    // Mark associations as explicitly managed so the legacy "all members" fallback no longer applies.
    batch.set(clientRef, { membersConfigured: true }, { merge: true });

    // Associate only the selected member with the client.
    batch.set(
      doc(this.firestore, `clients/${clientId}/members/${memberId}`),
      { createdAt: Date.now() },
      { merge: true }
    );

    await batch.commit();
  }

  async removeMemberFromClient(clientId: string, memberId: string, allMemberIds: string[]): Promise<void> {
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const clientMembersRef = collection(this.firestore, `clients/${clientId}/members`);
    const clientMembersSnapshot = await getDocs(clientMembersRef);

    const batch = writeBatch(this.firestore);

    // Mark associations as explicitly managed so emptying them no longer falls back to "all members".
    batch.set(clientRef, { membersConfigured: true }, { merge: true });

    if (clientMembersSnapshot.empty) {
      // Legacy mode has empty association collections; materialize explicit links minus removed member.
      const memberIdsToKeep = allMemberIds.filter((id) => id !== memberId);
      for (const id of memberIdsToKeep) {
        batch.set(doc(this.firestore, `clients/${clientId}/members/${id}`), {
          createdAt: Date.now()
        });
      }
    } else {
      batch.delete(doc(this.firestore, `clients/${clientId}/members/${memberId}`));
    }

    await batch.commit();
  }

  private async addMemberToConfiguredClients(memberId: string): Promise<void> {
    const clientsRef = collection(this.firestore, 'clients');
    const clientsSnapshot = await getDocs(clientsRef);

    for (const clientDoc of clientsSnapshot.docs) {
      const clientMembersRef = collection(this.firestore, `clients/${clientDoc.id}/members`);
      const clientMembersSnapshot = await getDocs(clientMembersRef);

      // Only explicit (already configured) client memberships need this link.
      if (!clientMembersSnapshot.empty) {
        await setDoc(
          doc(this.firestore, `clients/${clientDoc.id}/members/${memberId}`),
          { createdAt: Date.now() },
          { merge: true }
        );
      }
    }
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

    // Keep the matching member entry in sync with the chosen naipe.
    const memberRef = doc(this.firestore, `members/${uid}`);
    await setDoc(
      memberRef,
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

  private async deleteCollectionDocs(collectionPath: string): Promise<void> {
    const collectionRef = collection(this.firestore, collectionPath);
    let snapshot = await getDocs(collectionRef);

    while (!snapshot.empty) {
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const docsChunk = snapshot.docs.slice(i, i + 500);
        const batch = writeBatch(this.firestore);
        for (const item of docsChunk) {
          batch.delete(item.ref);
        }
        await batch.commit();
      }

      snapshot = await getDocs(collectionRef);
    }
  }
}
