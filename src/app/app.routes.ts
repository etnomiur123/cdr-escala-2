import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AdminPageComponent } from './pages/admin-page.component';
import { AuthService } from './services/auth.service';

const adminGuard: CanActivateFn = () => {
	const auth = inject(AuthService);
	return auth.isLoggedIn() || inject(Router).createUrlTree(['/']);
};

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'escalas',
		pathMatch: 'full'
	},
	{
		path: 'escalas',
		loadComponent: () =>
			import('./pages/home-page.component').then((module) => module.HomePageComponent),
		children: [
			{
				path: 'cliente/:clientId/mes/:monthId',
				loadComponent: () =>
					import('./pages/month-page.component').then((module) => module.MonthPageComponent)
			}
		]
	},
	{
		path: 'administracao',
		canActivate: [adminGuard],
		component: AdminPageComponent
	}
];
