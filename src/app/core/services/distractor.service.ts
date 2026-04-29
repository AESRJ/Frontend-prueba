import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type DistractorTipo = 'url' | 'proceso';
export type DistractorCategoria = 'red_social' | 'videojuego' | 'streaming' | 'otro';
export type DistractorOrigen = 'global' | 'personal';
export type DistractorOrigenFilter = 'all' | 'global' | 'personal';

export interface Distractor {
  id: number;
  nombre: string;
  identificador: string;
  tipo: DistractorTipo;
  categoria: DistractorCategoria;
  origen: DistractorOrigen;
  estudiante_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DistractorCreate {
  nombre: string;
  identificador: string;
  tipo: DistractorTipo;
  categoria: DistractorCategoria;
}

export interface DistractorUpdate {
  nombre?: string;
  identificador?: string;
  tipo?: DistractorTipo;
  categoria?: DistractorCategoria;
}

export interface ListOptions {
  origen?: DistractorOrigenFilter;
  categoria?: DistractorCategoria;
}

/**
 * Normaliza el `identificador` antes de guardarlo:
 * - tipo='url'  → extrae solo el hostname sin protocolo, sin "www.", sin path.
 *                 "https://www.reddit.com/r/python" → "reddit.com"
 *                 Si no es URL parseable, deja la cadena minúscula y sin espacios.
 * - tipo='proceso' → trim + lowercase.
 *                    "  Discord.exe " → "discord.exe"
 */
export function normalizeIdentifier(raw: string, tipo: 'url' | 'proceso'): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (tipo === 'proceso') return v.toLowerCase();

  let candidate = v;
  // Si no trae protocolo, le ponemos http:// para que URL() pueda parsearlo
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = 'http://' + candidate;
  }
  try {
    const u = new URL(candidate);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return v.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
  }
}

@Injectable({ providedIn: 'root' })
export class DistractorService {
  private readonly BASE_URL = `${environment.apiUrl}/distractors`;

  constructor(private http: HttpClient) {}

  list(options: ListOptions = {}): Observable<Distractor[]> {
    let params = new HttpParams();
    if (options.origen) {
      params = params.set('origen', options.origen);
    }
    if (options.categoria) {
      params = params.set('categoria', options.categoria);
    }
    return this.http.get<Distractor[]>(this.BASE_URL, { params });
  }

  get(id: number): Observable<Distractor> {
    return this.http.get<Distractor>(`${this.BASE_URL}/${id}`);
  }

  create(payload: DistractorCreate): Observable<Distractor> {
    return this.http.post<Distractor>(this.BASE_URL, payload);
  }

  update(id: number, payload: DistractorUpdate): Observable<Distractor> {
    return this.http.patch<Distractor>(`${this.BASE_URL}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.BASE_URL}/${id}`);
  }
}
