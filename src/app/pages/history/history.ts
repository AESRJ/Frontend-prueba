import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Sidebar } from '../../shared/sidebar/sidebar';
import { SessionHistoryReportComponent } from '../../shared/session-history-report/session-history-report';
import { SessionApiService, SessionHistoryItem } from '../../core/services/session-api.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, Sidebar, SessionHistoryReportComponent],
  templateUrl: './history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History implements OnInit {
  private readonly api = inject(SessionApiService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly sesiones = signal<SessionHistoryItem[]>([]);
  readonly seleccionada = signal<SessionHistoryItem | null>(null);

  // Estadísticas resumidas
  readonly totalSesiones = computed(() => this.sesiones().length);
  readonly totalCompletadas = computed(
    () => this.sesiones().filter(s => s.estado === 'finalizada').length,
  );
  readonly totalDetecciones = computed(
    () => this.sesiones().reduce((acc, s) => acc + s.detecciones, 0),
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.getHistory({ limit: 50 }).subscribe({
      next: (lista) => {
        this.sesiones.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set('No se pudo cargar el histórico. Verificá tu conexión.');
        this.cargando.set(false);
        console.error('[History]', err);
      },
    });
  }

  abrirReporte(s: SessionHistoryItem): void {
    this.seleccionada.set(s);
  }

  cerrarReporte(): void {
    this.seleccionada.set(null);
  }

  irAlDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  formatearFecha(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (
      d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }

  formatearDuracion(seg: number | null): string {
    if (seg == null) return '—';
    if (seg < 60) return `${seg}s`;
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    if (m < 60) return s === 0 ? `${m} min` : `${m} min ${s}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm === 0 ? `${h}h` : `${h}h ${mm}min`;
  }

  /** Score simple de concentración basado en detecciones por minuto. */
  nivelConcentracion(s: SessionHistoryItem): { nivel: string; color: string; bg: string } {
    const seg = s.duracion_segundos ?? 0;
    if (seg < 30) return { nivel: 'Alto', color: '#7C5CBF', bg: '#ede9fe' };
    const min = Math.max(1, Math.round(seg / 60));
    const dpm = s.detecciones / min;
    const score = Math.max(0, Math.min(100, (1 - dpm) * 100));
    if (score >= 80) return { nivel: 'Alto', color: '#7C5CBF', bg: '#ede9fe' };
    if (score >= 50) return { nivel: 'Medio', color: '#d97706', bg: '#fef3c7' };
    return { nivel: 'Bajo', color: '#dc2626', bg: '#fee2e2' };
  }

  colorNivel(nivel: 'bajo' | 'intermedio' | 'alto'): string {
    if (nivel === 'alto') return '#dc2626';
    if (nivel === 'intermedio') return '#d97706';
    return '#059669';
  }

  bgNivel(nivel: 'bajo' | 'intermedio' | 'alto'): string {
    if (nivel === 'alto') return '#fee2e2';
    if (nivel === 'intermedio') return '#fef3c7';
    return '#ecfdf5';
  }
}
