import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page.component';
import { MonthPageComponent } from './pages/month-page.component';

export const routes: Routes = [
	{
		path: '',
		component: HomePageComponent
	},
	{
		path: 'cliente/:clientId/mes/:monthId',
		component: MonthPageComponent
	}
];
