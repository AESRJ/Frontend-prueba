import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Profile } from './pages/profile/profile';
import { Dashboard } from './pages/dashboard/dashboard';
import { Distractors } from './pages/distractors/distractors';
import { History } from './pages/history/history';
import { AdhdQuestions } from './pages/adhd-questions/adhd-questions';
import { IqComponent } from './pages/iq/iq';

// La raiz decide segun token: si hay sesion -> dashboard, si no -> login.
// Esto soluciona el caso en que la extension (blocked.html) abre la URL raiz
// y el usuario ya esta autenticado: antes siempre lo mandaba a /login.
function rootRedirect(): string {
  try {
    return localStorage.getItem('access_token') ? '/dashboard' : '/login';
  } catch {
    return '/login';
  }
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: rootRedirect() },
  { path: 'login', component: Login },
  { path: 'register', component: Login },
  { path: 'profile', component: Profile },
  { path: 'dashboard', component: Dashboard },
  { path: 'distractors', component: Distractors },
  { path: 'history', component: History },
  { path: 'adhd-questions', component: AdhdQuestions },
  { path: 'iq', component: IqComponent },
];
