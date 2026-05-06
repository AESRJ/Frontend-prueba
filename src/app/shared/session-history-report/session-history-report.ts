import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DetectionOut,
  SessionApiService,
  SessionHistoryItem,
} from '../../core/services/session-api.service';

/**
 * Modal de detalle para una sesión del histórico.
 *
 * A diferencia de `SessionReportComponent` (que se muestra al terminar una
 * sesión y consume datos de visión por computadora locales), este componente
 * trabaja sobre `SessionHistoryItem` del backend y carga las detecciones
 * via `GET /sessions/{id}/detections`.
 */
@Component({
  selector: 'app-session-history-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-history-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionHistoryReportComponent implements OnChanges {
  @Input() sesion: SessionHistoryItem | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() nuevaSesion = new EventEmitter<void>();

  private readonly api = inject(SessionApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  cargandoDetalles = false;
  detecciones: DetectionOut[] = [];

  // ── Para el anillo SVG ────────────────────────────────────────────
  readonly circleRadius = 45;
  readonly circumference = 2 * Math.PI * 45;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sesion'] && this.sesion) {
      this.cargarDetecciones(this.sesion.id);
    }
  }

  private cargarDetecciones(sesionId: number): void {
    this.cargandoDetalles = true;
    this.detecciones = [];
    this.cdr.markForCheck();
    this.api.listDetections(sesionId).subscribe({
      next: (lista) => {
        this.detecciones = lista;
        this.cargandoDetalles = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoDetalles = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Estadísticas calculadas ───────────────────────────────────────
  get duracionSegundos(): number {
    return this.sesion?.duracion_segundos ?? 0;
  }

  get duracionMinutos(): number {
    return Math.max(1, Math.round(this.duracionSegundos / 60));
  }

  /** Detecciones por minuto: métrica simple de "ruido" durante la sesión. */
  get deteccionesPorMinuto(): number {
    if (!this.sesion || this.duracionSegundos < 30) return 0;
    return +(this.sesion.detecciones / this.duracionMinutos).toFixed(2);
  }

  /** Score de concentración inverso a las detecciones por minuto.
   * 0 detecciones/min → 100 %. ≥1 deteccion/min → 0 %. */
  get porcentajeConcentracion(): number {
    if (!this.sesion) return 0;
    if (this.duracionSegundos < 30) return 100;
    const dpm = this.deteccionesPorMinuto;
    const score = Math.max(0, Math.min(100, Math.round((1 - dpm) * 100)));
    return score;
  }

  get nivelConcentracion(): string {
    const p = this.porcentajeConcentracion;
    if (p >= 80) return 'Alto';
    if (p >= 50) return 'Medio';
    return 'Bajo';
  }

  get colorNivel(): string {
    const p = this.porcentajeConcentracion;
    if (p >= 80) return '#7C5CBF';
    if (p >= 50) return '#f59e0b';
    return '#ef4444';
  }

  get bgNivel(): string {
    const p = this.porcentajeConcentracion;
    if (p >= 80) return '#ede9fe';
    if (p >= 50) return '#fef3c7';
    return '#fee2e2';
  }

  get strokeDashoffset(): number {
    return this.circumference * (1 - this.porcentajeConcentracion / 100);
  }

  // ── Desglose por categoría ────────────────────────────────────────
  get porCategoria(): Array<{ categoria: string; total: number }> {
    const map = new Map<string, number>();
    for (const d of this.detecciones) {
      map.set(d.categoria, (map.get(d.categoria) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([categoria, total]) => ({ categoria, total }));
  }

  etiquetaCategoria(cat: string): string {
    const m: Record<string, string> = {
      red_social: 'Redes sociales',
      videojuego: 'Videojuegos',
      streaming: 'Streaming',
      otro: 'Otros',
    };
    return m[cat] ?? cat;
  }

  // ── Helpers de formato ────────────────────────────────────────────
  duracionTexto(segundos: number): string {
    if (segundos < 60) return `${segundos}s`;
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    if (m < 60) return s === 0 ? `${m} min` : `${m} min ${s}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm === 0 ? `${h}h` : `${h}h ${mm}min`;
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

  formatearHora(timestamp: string): string {
    // El backend usa formato YYYY-MM-DD|HH:MM:SS
    const partes = timestamp.split('|');
    if (partes.length === 2) return partes[1].slice(0, 5);
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return timestamp;
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onNuevaSesion(): void {
    this.nuevaSesion.emit();
  }
}
