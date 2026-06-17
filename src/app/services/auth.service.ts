import { Injectable, computed, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserProfile } from '../models/schedule.models';

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

    const userProfile: Omit<UserProfile, 'naipe'> = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName ?? 'Sem nome',
      email: firebaseUser.email ?? '',
      updatedAt: Date.now(),
      createdAt: Date.now()
    };

    await setDoc(doc(this.firestore, `users/${firebaseUser.uid}`), userProfile, { merge: true });
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
