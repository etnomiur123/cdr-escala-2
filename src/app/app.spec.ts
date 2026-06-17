import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { ScheduleDataService } from './services/schedule-data.service';

describe('App', () => {
  beforeEach(async () => {
    const user = signal<{ uid: string; displayName: string; email: string } | null>(null);
    const isAuthLoading = signal(false);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user,
            isAuthLoading,
            isLoggedIn: computed(() => user() !== null),
            loginWithGoogle: jasmine.createSpy('loginWithGoogle'),
            logout: jasmine.createSpy('logout')
          }
        },
        {
          provide: ScheduleDataService,
          useValue: {
            observeUserProfile: () => of(null),
            updateUserNaipe: jasmine.createSpy('updateUserNaipe')
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Canto do Rio Planner');
  });
});
