import { Injectable, computed, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { Naipe, UserProfile } from '../models/schedule.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  private readonly authUser = toSignal<User | null | undefined>(authState(this.auth));
  readonly user = computed(() => this.authUser() ?? null);
  readonly isAuthLoading = computed(() => this.authUser() === undefined);
  readonly isLoggedIn = computed(() => this.user() !== null);

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    const firebaseUser = result.user;
    const userRef = doc(this.firestore, `users/${firebaseUser.uid}`);
    const memberRef = doc(this.firestore, `members/${firebaseUser.uid}`);
    const userSnapshot = await getDoc(userRef);
    const memberSnapshot = await getDoc(memberRef);
    const isFirstLogin = !userSnapshot.exists();
    const isMissingMember = !memberSnapshot.exists();
    const existingCreatedAt = userSnapshot.data()?.['createdAt'] as number | undefined;
    const existingNaipe = userSnapshot.data()?.['naipe'] as Naipe | null | undefined;
    const now = Date.now();

    const userProfile: Omit<UserProfile, 'naipe'> = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName ?? 'Sem nome',
      email: firebaseUser.email ?? '',
      updatedAt: now,
      createdAt: existingCreatedAt ?? now
    };

    await setDoc(userRef, userProfile, { merge: true });

    if (isFirstLogin || isMissingMember) {
      // Ensure every authenticated user has a matching member entry.
      await setDoc(memberRef, {
        name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Sem nome',
        naipe: existingNaipe ?? 'Vocalista',
        email: firebaseUser.email ?? '',
        active: true,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    }
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
