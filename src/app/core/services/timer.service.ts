import { Injectable } from '@angular/core';

export interface TimerState {
  sesionActiva: boolean;
  pausado: boolean;
  sesionTerminada: boolean;
  tiempoRestante: number;
  tiempoTotal: number;
  duracionMinutos: number;
  modoTexto: string;
  horaInicio: string;
  horaFin: string;
  sessionIdBackend: number | null;
}

@Injectable({ providedIn: 'root' })
export class TimerService {
  private interval: any = null;

  state: TimerState = this.getEstadoInicial();

  private getEstadoInicial(): TimerState {
    const saved = localStorage.getItem('focus_timer_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Si había sesión activa, recalcular tiempo restante
      if (parsed.sesionActiva && !parsed.pausado && parsed.horaInicio) {
        const ahora = Date.now();
        const inicio = new Date(parsed.horaInicio).getTime();
        const transcurrido = Math.floor((ahora - inicio) / 1000);
        parsed.tiempoRestante = Math.max(0, parsed.tiempoTotal - transcurrido);
        if (parsed.tiempoRestante <= 0) {
          parsed.sesionActiva = false;
          parsed.sesionTerminada = true;
        }
      }
      return parsed;
    }
    return {
      sesionActiva: false,
      pausado: false,
      sesionTerminada: false,
      tiempoRestante: 45 * 60,
      tiempoTotal: 45 * 60,
      duracionMinutos: 45,
      modoTexto: 'Tranquilo',
      horaInicio: '',
      horaFin: '',
      sessionIdBackend: null
    };
  }

  private persistir() {
    localStorage.setItem('focus_timer_state', JSON.stringify(this.state));
  }

  iniciarTimer(onTick: () => void, onFin: () => void) {
    this.limpiarInterval();
    this.interval = setInterval(() => {
      if (this.state.tiempoRestante > 0) {
        this.state.tiempoRestante--;
        this.persistir();
        onTick();
      }
      if (this.state.tiempoRestante <= 0) {
        this.limpiarInterval();
        onFin();
      }
    }, 1000);
  }

  pausarTimer() {
    this.limpiarInterval();
    this.state.pausado = true;
    this.persistir();
  }

  reanudarTimer(onTick: () => void, onFin: () => void) {
    this.state.pausado = false;
    this.persistir();
    this.iniciarTimer(onTick, onFin);
  }

  limpiarInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  setEstadoSesion(patch: Partial<TimerState>) {
    this.state = { ...this.state, ...patch };
    this.persistir();
  }

  resetear() {
    this.limpiarInterval();
    localStorage.removeItem('focus_timer_state');
    this.state = {
      sesionActiva: false,
      pausado: false,
      sesionTerminada: false,
      tiempoRestante: this.state.tiempoTotal,
      tiempoTotal: this.state.tiempoTotal,
      duracionMinutos: this.state.duracionMinutos,
      modoTexto: this.state.modoTexto,
      horaInicio: '',
      horaFin: '',
      sessionIdBackend: null
    };
  }

  // En logout no queremos preservar la duracion/modo del usuario anterior,
  // sino volver al estado por defecto absoluto.
  limpiarParaLogout() {
    this.limpiarInterval();
    localStorage.removeItem('focus_timer_state');
    this.state = this.getEstadoInicial();
  }

  get timerDisplay(): string {
    const h = Math.floor(this.state.tiempoRestante / 3600);
    const m = Math.floor((this.state.tiempoRestante % 3600) / 60);
    const s = this.state.tiempoRestante % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}