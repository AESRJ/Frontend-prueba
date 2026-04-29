import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../shared/sidebar/sidebar';
import { SessionApiService, SessionHistoryItem } from '../../core/services/session-api.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History implements OnInit {
  private readonly api = inject(SessionApiService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly sesiones = signal<SessionHistoryItem[]>([]);

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

  formatearFecha(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
