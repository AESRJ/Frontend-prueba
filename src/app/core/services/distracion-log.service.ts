import { Injectable } from '@angular/core';

export type DistractionType = 'desvio_mirada' | 'fuera_de_encuadre';

export interface DistractionEvent {
  timestamp: string;       // formato 2026-04-12|14:35:22
  duracion_segundos: number;
  tipo: DistractionType;
}

@Injectable({
  providedIn: 'root'
})
export class DistractionLogService {
  private eventos: DistractionEvent[] = [];

  registrarEvento(tipo: DistractionType, duracionSegundos: number): DistractionEvent {
    const now = new Date();
    const ts = this.formatTimestamp(now);
    const evento: DistractionEvent = {
      timestamp: ts,
      duracion_segundos: Math.round(duracionSegundos),
      tipo
    };
    this.eventos.push(evento);
    return evento;
  }

  getEventos(): DistractionEvent[] {
    return [...this.eventos];
  }

  getEventosPorTipo(tipo: DistractionType): DistractionEvent[] {
    return this.eventos.filter(e => e.tipo === tipo);
  }

  limpiar(): void {
    this.eventos = [];
  }

  sincronizarAlFinalizar(): { eventos: DistractionEvent[]; total: number } {
    const resultado = {
      eventos: [...this.eventos],
      total: this.eventos.length
    };
    return resultado;
  }

  guardarEnLocalStorage(sessionId: string): void {
    const key = `focus_distractions_${sessionId}`;
    localStorage.setItem(key, JSON.stringify(this.eventos));
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
}
