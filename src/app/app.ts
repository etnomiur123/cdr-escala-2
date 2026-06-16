import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { Naipe } from './models/schedule.models';
import { AppIconService } from './services/app-icon.service';
import { AuthService } from './services/auth.service';
import { ScheduleDataService } from './services/schedule-data.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly auth = inject(AuthService);
  private readonly data = inject(ScheduleDataService);
  private readonly appIcons = inject(AppIconService);

  readonly profile = toSignal(
    toObservable(computed(() => this.auth.user()?.uid ?? '')).pipe(
      switchMap((uid) => (uid ? this.data.observeUserProfile(uid) : of(null)))
    ),
    { initialValue: null }
  );

  async setNaipe(naipe: Naipe) {
    const user = this.auth.user();
    if (!user) {
      return;
    }
    await this.data.updateUserNaipe(user.uid, naipe);
  }
}
