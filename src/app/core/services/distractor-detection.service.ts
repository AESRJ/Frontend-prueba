import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { DistractorService, Distractor as BackendDistractor } from './distractor.service';

export type RestrictionLevel = 'bajo' | 'intermedio' | 'alto';
export type DistractorCategory = 'red_social' | 'videojuego' | 'streaming' | 'otro';
export type DistractorOrigin = 'global' | 'personal';

export interface DistractorEntry {
  nombre: string;
  url?: string;            // para páginas web (coincidencia parcial en hostname)
  proceso?: string;        // para apps de escritorio (no aplica en web, placeholder)
  categoria: DistractorCategory;
  origen: DistractorOrigin;
}

export interface DistractorDetectionEvent {
  timestamp: string;       // formato 2026-04-12|14:35:22
  nombre: string;
  categoria: DistractorCategory;
  nivelRestriccion: RestrictionLevel;
  url?: string;
}

export type DistractorAction = 'silencio' | 'toast' | 'bloqueo';

@Injectable({
  providedIn: 'root'
})
export class DistractorDetectionService implements OnDestroy {

  // ─── Base de datos de distractores ───────────────────────────────────────
  private readonly DB: DistractorEntry[] = [
    // Redes sociales
    { nombre: 'Facebook',   url: 'facebook.com',   categoria: 'red_social',  origen: 'global' },
    { nombre: 'Instagram',  url: 'instagram.com',  categoria: 'red_social',  origen: 'global' },
    { nombre: 'Twitter/X',  url: 'twitter.com',    categoria: 'red_social',  origen: 'global' },
    { nombre: 'Twitter/X',  url: 'x.com',          categoria: 'red_social',  origen: 'global' },
    { nombre: 'TikTok',     url: 'tiktok.com',     categoria: 'red_social',  origen: 'global' },
    { nombre: 'Snapchat',   url: 'snapchat.com',   categoria: 'red_social',  origen: 'global' },
    { nombre: 'Reddit',     url: 'reddit.com',     categoria: 'red_social',  origen: 'global' },
    { nombre: 'Pinterest',  url: 'pinterest.com',  categoria: 'red_social',  origen: 'global' },
    { nombre: 'LinkedIn',   url: 'linkedin.com',   categoria: 'red_social',  origen: 'global' },
    // Streaming
    { nombre: 'YouTube',    url: 'youtube.com',    categoria: 'streaming',   origen: 'global' },
    { nombre: 'Netflix',    url: 'netflix.com',    categoria: 'streaming',   origen: 'global' },
    { nombre: 'Twitch',     url: 'twitch.tv',      categoria: 'streaming',   origen: 'global' },
    { nombre: 'Disney+',    url: 'disneyplus.com', categoria: 'streaming',   origen: 'global' },
    { nombre: 'HBO Max',    url: 'hbomax.com',     categoria: 'streaming',   origen: 'global' },
    { nombre: 'Spotify',    url: 'spotify.com',    categoria: 'streaming',   origen: 'global' },
    { nombre: 'Prime Video',url: 'primevideo.com', categoria: 'streaming',   origen: 'global' },
    // Videojuegos
    { nombre: 'Steam',      url: 'store.steampowered.com', categoria: 'videojuego', origen: 'global' },
    { nombre: 'Epic Games', url: 'epicgames.com',  categoria: 'videojuego',  origen: 'global' },
    { nombre: 'Roblox',     url: 'roblox.com',     categoria: 'videojuego',  origen: 'global' },
    { nombre: 'Miniclip',   url: 'miniclip.com',   categoria: 'videojuego',  origen: 'global' },
    // Otro
    { nombre: 'WhatsApp Web', url: 'web.whatsapp.com', categoria: 'otro',   origen: 'global' },
    { nombre: 'Telegram',   url: 'web.telegram.org', categoria: 'otro',     origen: 'global' },
    { nombre: 'BuzzFeed',   url: 'buzzfeed.com',   categoria: 'otro',       origen: 'global' },
  ];

  readonly deteccion$ = new Subject<{ evento: DistractorDetectionEvent; accion: DistractorAction }>();

  private readonly distractorApi = inject(DistractorService);

  private pollingInterval: any = null;
  private sesionActiva = false;
  private ultimaUrl = '';
  private registros: DistractorDetectionEvent[] = [];
  // Distractores cargados desde backend (globales + personales del usuario).
  // Tienen prioridad sobre el catálogo hardcoded en DB.
  private dbBackend: DistractorEntry[] = [];

  getNivelRestriccion(): RestrictionLevel {
    return (localStorage.getItem('focus_restriction_level') as RestrictionLevel) || 'intermedio';
  }

  setNivelRestriccion(nivel: RestrictionLevel): void {
    localStorage.setItem('focus_restriction_level_pending', nivel);
  }

  aplicarNivelPendiente(): void {
    const pending = localStorage.getItem('focus_restriction_level_pending');
    if (pending) {
      localStorage.setItem('focus_restriction_level', pending);
    } else if (!localStorage.getItem('focus_restriction_level')) {
      localStorage.setItem('focus_restriction_level', 'intermedio');
    }
  }

  iniciarMonitoreo(): void {
    if (this.sesionActiva) return;
    this.aplicarNivelPendiente();
    this.sesionActiva = true;
    this.registros = [];
    this.ultimaUrl = '';
    // Refresca el catálogo desde backend al iniciar (no bloquea el monitoreo)
    this.cargarDistractoresBackend();
    this.pollingInterval = setInterval(() => this.verificarUrl(), 2000);
  }

  /**
   * Carga distractores (globales + personales) desde el backend y los guarda
   * en `dbBackend`. Si la petición falla, mantiene lo último cargado y se
   * sigue usando el catálogo hardcoded como fallback.
   */
  cargarDistractoresBackend(): void {
    this.distractorApi.list({ origen: 'all' }).subscribe({
      next: (lista) => {
        this.dbBackend = lista
          .filter(d => d.tipo === 'url')   // en web solo url tiene sentido
          .map(d => this.mapBackendEntry(d));
      },
      error: () => { /* sin red → conservar dbBackend previo */ }
    });
  }

  detenerMonitoreo(): void {
    this.sesionActiva = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  getRegistros(): DistractorDetectionEvent[] {
    return [...this.registros];
  }

  limpiarRegistros(): void {
    this.registros = [];
  }

  // ─── Detección manual (para llamar desde extensión de Chrome o desde la app) ──
  /**
   * Verifica si una URL dada es un distractor y ejecuta la acción según
   * el nivel de restricción. Retorna la acción ejecutada o null si no hay coincidencia.
   */
  verificarUrlExterna(url: string): DistractorAction | null {
    if (!this.sesionActiva) return null;
    return this.procesarUrl(url);
  }

  /**
   * Modo prueba: corre el matching contra el catálogo (backend + hardcoded)
   * sin requerir sesión activa y sin disparar eventos ni persistir registros.
   * Útil para validar desde la UI que un distractor está bien configurado.
   */
  probarUrl(url: string): { match: DistractorEntry | null; accionProyectada: DistractorAction | null } {
    let hostname = '';
    try {
      hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : 'http://' + url)
        .hostname
        .replace(/^www\./, '')
        .toLowerCase();
    } catch {
      return { match: null, accionProyectada: null };
    }

    const buscar = (lista: DistractorEntry[]) =>
      lista.find(d => d.url && this.hostnameMatches(hostname, d.url)) ?? null;
    const match = buscar(this.dbBackend) ?? buscar(this.DB);
    if (!match) return { match: null, accionProyectada: null };

    const nivel = this.getNivelRestriccion();
    const accion: DistractorAction = nivel === 'bajo' ? 'silencio' : nivel === 'intermedio' ? 'toast' : 'bloqueo';
    return { match, accionProyectada: accion };
  }

  /**
   * Match estricto: hostname debe ser igual al target o un subdominio
   * directo. Evita falsos positivos como "notreddit.com" matcheando "reddit.com".
   */
  private hostnameMatches(hostname: string, target: string): boolean {
    const t = target.replace(/^www\./, '').toLowerCase();
    const h = hostname.toLowerCase();
    return h === t || h.endsWith('.' + t);
  }

  // ─── Privado ──────────────────────────────────────────────────────────────
  private verificarUrl(): void {
    try {
      const currentUrl = window.location.href;
      if (currentUrl === this.ultimaUrl) return;
      this.ultimaUrl = currentUrl;
      this.procesarUrl(currentUrl);
    } catch { /* cross-origin */ }
  }

  private procesarUrl(rawUrl: string): DistractorAction | null {
    let hostname = '';
    try {
      hostname = new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }

    // Backend tiene prioridad: si el usuario marcó algo como personal, debe
    // primar sobre el catálogo hardcoded.
    const buscar = (lista: DistractorEntry[]) =>
      lista.find(d => d.url && this.hostnameMatches(hostname, d.url));
    const match = buscar(this.dbBackend) ?? buscar(this.DB);
    if (!match) return null;

    const nivel = this.getNivelRestriccion();
    const evento: DistractorDetectionEvent = {
      timestamp: this.formatTimestamp(new Date()),
      nombre: match.nombre,
      categoria: match.categoria,
      nivelRestriccion: nivel,
      url: rawUrl
    };

    // Registrar siempre
    this.registros.push(evento);
    this.persistirRegistro(evento);

    // Determinar acción
    let accion: DistractorAction;
    if (nivel === 'bajo') {
      accion = 'silencio';
    } else if (nivel === 'intermedio') {
      accion = 'toast';
    } else {
      accion = 'bloqueo';
    }

    this.deteccion$.next({ evento, accion });
    return accion;
  }

  private persistirRegistro(evento: DistractorDetectionEvent): void {
    try {
      const key = 'focus_distractor_log';
      const existing: DistractorDetectionEvent[] = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(evento);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { /* storage full */ }
  }

  private mapBackendEntry(d: BackendDistractor): DistractorEntry {
    return {
      nombre: d.nombre,
      url: d.tipo === 'url' ? d.identificador : undefined,
      proceso: d.tipo === 'proceso' ? d.identificador : undefined,
      categoria: d.categoria,
      origen: d.origen
    };
  }

  private formatTimestamp(date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d}|${h}:${mi}:${s}`;
  }

  ngOnDestroy(): void {
    this.detenerMonitoreo();
    this.deteccion$.complete();
  }
}
