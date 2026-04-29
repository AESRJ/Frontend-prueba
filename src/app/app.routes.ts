import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Profile } from './pages/profile/profile';
import { Dashboard } from './pages/dashboard/dashboard';
import { Distractors } from './pages/distractors/distractors';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Login },
  { path: 'profile', component: Profile },
  { path: 'dashboard', component: Dashboard },
  { path: 'distractors', component: Distractors },
];
