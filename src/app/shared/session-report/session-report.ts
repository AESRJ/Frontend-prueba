import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DistractionEvent } from '../../core/services/distracion-log.service';

export interface SessionReportData {
  id: string;
  start_time: string;
  end_time: string;
  modo: string;
  duracion_configurada: number;        // minutos
  tiempo_usado_segundos: number;
  completada: boolean;
  distracciones: DistractionEvent[];
  total_distracciones: number;
}

@Component({
  selector: 'app-session-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-report.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionReportComponent implements OnInit {
  @Input() sesion!: SessionReportData;
  @Output() cerrar = new EventEmitter<void>();
  @Output() nuevaSesion = new EventEmitter<void>();

  // Datos calculados
  duracionTotalTexto = '';
  tiempoEfectivoTexto = '';
  nivelConcentracion = '';
  porcentajeConcentracion = 0;
  totalDesvios = 0;
  totalFueraEncuadre = 0;

  // Para la gráfica circular SVG
  circleRadius = 45;
  circumference = 2 * Math.PI * 45;
  strokeDashoffset = 0;

  ngOnInit(): void {
    this.calcularEstadisticas();
  }

  private calcularEstadisticas(): void {
    const usados = this.sesion.tiempo_usado_segundos;
    const total = this.sesion.duracion_configurada * 60;

    this.duracionTotalTexto = this.segundosATexto(usados);

    // Tiempo efectivo = tiempo usado - suma de duraciones de distracciones
    const segDistracciones = this.sesion.distracciones.reduce(
      (acc, d) => acc + (d.duracion_segundos || 0), 0
    );
    const tiempoEfectivo = Math.max(0, usados - segDistracciones);
    this.tiempoEfectivoTexto = this.segundosATexto(tiempoEfectivo);

    // Porcentaje de concentración
    this.porcentajeConcentracion = usados > 0
      ? Math.round((tiempoEfectivo / usados) * 100)
      : 100;

    // Nivel de concentración
    if (this.porcentajeConcentracion >= 80) {
      this.nivelConcentracion = 'Alto';
    } else if (this.porcentajeConcentracion >= 50) {
      this.nivelConcentracion = 'Medio';
    } else {
      this.nivelConcentracion = 'Bajo';
    }

    // Desglose de distracciones por tipo
    this.totalDesvios = this.sesion.distracciones.filter(d => d.tipo === 'desvio_mirada').length;
    this.totalFueraEncuadre = this.sesion.distracciones.filter(d => d.tipo === 'fuera_de_encuadre').length;

    // Círculo SVG
    this.strokeDashoffset = this.circumference * (1 - this.porcentajeConcentracion / 100);
  }

  get colorNivel(): string {
    if (this.porcentajeConcentracion >= 80) return '#7C5CBF';
    if (this.porcentajeConcentracion >= 50) return '#f59e0b';
    return '#ef4444';
  }

  get bgNivel(): string {
    if (this.porcentajeConcentracion >= 80) return '#ede9fe';
    if (this.porcentajeConcentracion >= 50) return '#fef3c7';
    return '#fee2e2';
  }

  private segundosATexto(seg: number): string {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m} min`;
    return `${m} min ${s}s`;
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onNuevaSesion(): void {
    this.nuevaSesion.emit();
  }
}