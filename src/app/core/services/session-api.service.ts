import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Tipos compartidos con el backend ───────────────────────────────────────
export type SessionState = 'activa' | 'finalizada';
export type RestrictionLevel = 'bajo' | 'intermedio' | 'alto';
export type DistractorCategory = 'red_social' | 'videojuego' | 'streaming' | 'otro';

// ─── Sesiones ──────────────────────────────────────────────────────────────
/** Respuesta de POST /sessions, GET /sessions/active y PATCH /sessions/{id}. */
export interface SessionOut {
  id: number;
  start_time: string;          // ISO 8601
  end_time: string | null;
}

/** Item de GET /sessions/history. Incluye duración y conteo precalculados. */
export interface SessionHistoryItem {
  id: number;
  start_time: string;
  end_time: string | null;
  estado: SessionState;
  nivel_restriccion_sesion: RestrictionLevel;
  detecciones: number;
  duracion_segundos: number | null;
}

/** Body opcional de POST /sessions. Hoy `duration` aún no se persiste en sesion. */
export interface SessionStartIn {
  duration?: number;
}

export interface HistoryOptions {
  limit?: number;              // 1-200, default 50
  offset?: number;             // ≥ 0, default 0
}

// ─── Detecciones ───────────────────────────────────────────────────────────
/** Respuesta de POST/GET /sessions/{id}/detections. */
export interface DetectionOut {
  id: number;
  sesion_id: number;
  distractor_id: number;
  nombre_detectado: string;
  categoria: DistractorCategory;
  nivel_restriccion_activo: RestrictionLevel;
  timestamp_deteccion: string;       // YYYY-MM-DD|HH:MM:SS
  timestamp_nativo: string;          // ISO 8601
}

/**
 * Body de POST /sessions/{id}/detections.
 *
 * El backend acepta `distractor_id` (preferido si el frontend ya lo conoce)
 * o `identificador` (hostname/proceso) para que él resuelva el distractor.
 * `timestamp_deteccion` es opcional — si se omite, lo genera el servidor.
 */
export interface DetectionCreate {
  distractor_id?: number;
  identificador?: string;
  nombre_detectado: string;
  categoria: DistractorCategory;
  timestamp_deteccion?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionApiService {
  private readonly SESSIONS_URL = `${environment.apiUrl}/sessions`;

  constructor(private http: HttpClient) {}

  // ─── Sesiones ────────────────────────────────────────────────────────────
  /**
   * Inicia una sesión. Si ya existe una activa para el usuario, el backend
   * devuelve esa misma en lugar de crear una nueva.
   */
  startSession(payload: SessionStartIn = {}): Observable<SessionOut> {
    return this.http.post<SessionOut>(this.SESSIONS_URL, payload);
  }

  /** Devuelve la sesión activa o `null` si no hay ninguna abierta. */
  getActiveSession(): Observable<SessionOut | null> {
    return this.http.get<SessionOut | null>(`${this.SESSIONS_URL}/active`);
  }

  /** Marca la sesión como finalizada. Idempotente: si ya estaba cerrada, devuelve la misma. */
  endSession(sessionId: number): Observable<SessionOut> {
    return this.http.patch<SessionOut>(`${this.SESSIONS_URL}/${sessionId}`, {});
  }

  /** Histórico paginado, más recientes primero. */
  getHistory(options: HistoryOptions = {}): Observable<SessionHistoryItem[]> {
    let params = new HttpParams();
    if (options.limit != null) params = params.set('limit', options.limit);
    if (options.offset != null) params = params.set('offset', options.offset);
    return this.http.get<SessionHistoryItem[]>(`${this.SESSIONS_URL}/history`, { params });
  }

  // ─── Detecciones ─────────────────────────────────────────────────────────
  /**
   * Registra un evento de detección dentro de una sesión activa. Si la sesión
   * ya está finalizada el backend devuelve 409.
   */
  createDetection(sessionId: number, payload: DetectionCreate): Observable<DetectionOut> {
    return this.http.post<DetectionOut>(
      `${this.SESSIONS_URL}/${sessionId}/detections`,
      payload,
    );
  }

  /** Lista las detecciones de la sesión, ordenadas por timestamp ascendente. */
  listDetections(sessionId: number): Observable<DetectionOut[]> {
    return this.http.get<DetectionOut[]>(`${this.SESSIONS_URL}/${sessionId}/detections`);
  }
}
