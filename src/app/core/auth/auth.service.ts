import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CameraTrackingService } from '../services/camera-tracking.service';

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
  private cameraTracking = inject(CameraTrackingService);

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
          this.notifyExtensionLogin(res.access_token);
        }
      })
    );
  }

  private notifyExtensionLogin(token: string): void {
    const chromeRuntime = (window as any).chrome?.runtime;
    if (!chromeRuntime?.sendMessage) return;
    chromeRuntime.sendMessage(
      environment.focusExtensionId,
      { type: 'SET_TOKEN', token },
      (resp: any) => {
        const err = chromeRuntime.lastError;
        if (err) console.debug('Focus IA ext no instalada:', err.message);
        else console.debug('Focus IA ext respondió:', resp);
      }
    );
  }

  private notifyExtensionLogout(): void {
    const chromeRuntime = (window as any).chrome?.runtime;
    if (!chromeRuntime?.sendMessage) return;
    chromeRuntime.sendMessage(
      environment.focusExtensionId,
      { type: 'CLEAR_TOKEN' },
      () => { void chromeRuntime.lastError; }
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
    // Antes de limpiar el token, intentar finalizar la sesion activa en el
    // backend (si existe) para que no quede colgada como "activa" en BD.
    this.endActiveSessionBestEffort();
    this.notifyExtensionLogout();

    // Liberar la camara: el ngOnDestroy del Dashboard solo desconecta el preview
    // (para preservar el stream durante navegacion a cuestionarios). En logout
    // si queremos cortar todo y apagar el LED.
    try { this.cameraTracking.detener(); } catch {}

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

  /**
   * Finaliza la sesion activa en el backend (best-effort, sin esperar respuesta).
   * Usa fetch con keepalive para que la peticion sobreviva al cierre de pestana
   * o al unload de la pagina. Ideal para llamarse en logout() y en `pagehide`.
   */
  endActiveSessionBestEffort(): void {
    try {
      const token = localStorage.getItem('access_token');
      const stateRaw = localStorage.getItem('focus_timer_state');
      if (!token || !stateRaw) return;

      let sessionId: number | null = null;
      try {
        sessionId = JSON.parse(stateRaw)?.sessionIdBackend ?? null;
      } catch {
        return;
      }
      if (!sessionId) return;

      fetch(`${this.BASE_URL}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        keepalive: true,
      }).catch(() => { /* best effort, no recuperamos errores */ });
    } catch {
      /* nunca bloquear logout/unload por esto */
    }
  }
 
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
 
  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}