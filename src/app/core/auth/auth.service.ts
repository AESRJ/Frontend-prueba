import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
}
 
export interface RegisterResponse {
  id: number;
  email: string;
  name: string;
  username?: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}
 
export interface LoginResponse {
  access_token: string;
  token_type: string;
}
 
export interface UserProfile {
  id: number;
  email: string;
  name: string;
  username?: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}
 
export interface UpdateProfileRequest {
  name?: string;
  username?: string;
  full_name?: string;
  email?: string;
  password?: string;
}
 
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private BASE_URL = environment.apiUrl;
 
  constructor(private http: HttpClient) {}
 
  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.BASE_URL}/auth/register`, data);
  }
 
  login(email: string, password: string): Observable<LoginResponse> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);
 
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });
 
    return this.http.post<LoginResponse>(
      `${this.BASE_URL}/auth/jwt/login`,
      body.toString(),
      { headers }
    ).pipe(
      tap(res => {
        if (res.access_token) {
          localStorage.setItem('access_token', res.access_token);
        }
      })
    );
  }
 
  // Obtener perfil del usuario autenticado
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.BASE_URL}/users/me`);
  }
 
  // Actualizar perfil del usuario autenticado (usando PATCH para actualización parcial)
  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.BASE_URL}/users/me`, data);
  }

  // Frases motivacionales personalizadas (se muestran en blocked.html de la extension)
  getMotivationPhrases(): Observable<{ phrases: string[] }> {
    return this.http.get<{ phrases: string[] }>(`${this.BASE_URL}/profile/motivation-phrases`);
  }

  saveMotivationPhrases(phrases: string[]): Observable<{ phrases: string[] }> {
    return this.http.put<{ phrases: string[] }>(`${this.BASE_URL}/profile/motivation-phrases`, { phrases });
  }
 
  logout(): void {
    // Limpia el token y toda la data per-user que vive en localStorage
    // (preferencias, estado del timer, historial de sesiones, etc.) para
    // evitar que un usuario distinto que se loguee despues vea datos del anterior.
    localStorage.removeItem('access_token');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('focus_')) {
        localStorage.removeItem(key);
      }
    }
  }
 
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
 
  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}