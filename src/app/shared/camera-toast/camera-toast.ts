import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CameraTrackingService, ToastEvent } from '../../core/services/camera-tracking.service';

interface CameraToast {
  tipo: string;
  mensaje: string;
  autoCloseTimer: any;
}

/**
 * Toast global de distracciones de camara. Vive en el root de la app (app.html)
 * para que las alertas visuales sigan apareciendo cuando el usuario navega del
 * dashboard al test IQ, cuestionario TDAH u otra ruta. La deteccion y el sonido
 * ya ocurren en el service singleton; aca solo se renderiza el feedback visual.
 */
@Component({
  selector: 'app-camera-toast',
  standalone: true,
  template: `
    <div class="fixed bottom-6 right-6 flex flex-col-reverse gap-3 z-[9999] pointer-events-none">
      @for (toast of toasts; track toast.tipo; let i = $index) {
        <div
          class="flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white min-w-[280px] max-w-[400px] shadow-[0_8px_24px_rgba(0,0,0,0.15)] pointer-events-auto relative animate-[toastSlideIn_0.3s_ease-out]"
          [class.bg-[#ef4444]]="toast.tipo === 'fuera_de_encuadre'"
          [class.bg-[#f59e0b]]="toast.tipo === 'desvio_mirada'"
          [class.text-[#78350f]]="toast.tipo === 'desvio_mirada'">
          <div class="shrink-0 flex items-center">
            @if (toast.tipo === 'fuera_de_encuadre') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            }
            @if (toast.tipo === 'desvio_mirada') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            }
          </div>
          <span class="flex-1">{{ toast.mensaje }}</span>
          <button
            class="absolute top-1.5 right-2.5 bg-transparent border-none text-inherit text-sm opacity-70 hover:opacity-100 cursor-pointer p-1 leading-none font-sans"
            (click)="cerrar(i)">✕</button>
        </div>
      }
    </div>
  `
})
export class CameraToastComponent implements OnInit, OnDestroy {
  toasts: CameraToast[] = [];
  private sub?: Subscription;

  constructor(
    private cameraTracking: CameraTrackingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.cameraTracking.toast$.subscribe((event: ToastEvent) => this.manejar(event));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    for (const t of this.toasts) {
      if (t.autoCloseTimer) clearTimeout(t.autoCloseTimer);
    }
    this.toasts = [];
  }

  cerrar(index: number): void {
    const toast = this.toasts[index];
    if (!toast) return;
    if (toast.autoCloseTimer) clearTimeout(toast.autoCloseTimer);
    this.toasts.splice(index, 1);
    this.cdr.detectChanges();
  }

  private manejar(event: ToastEvent): void {
    if (event.visible) {
      // No duplicar toasts del mismo tipo
      if (this.toasts.some(t => t.tipo === event.tipo)) return;
      const toast: CameraToast = { tipo: event.tipo, mensaje: event.mensaje, autoCloseTimer: null };
      toast.autoCloseTimer = setTimeout(() => {
        const idx = this.toasts.indexOf(toast);
        if (idx >= 0) {
          this.toasts.splice(idx, 1);
          this.cdr.detectChanges();
        }
      }, 6000);
      this.toasts.push(toast);
    } else {
      const idx = this.toasts.findIndex(t => t.tipo === event.tipo);
      if (idx >= 0) {
        if (this.toasts[idx].autoCloseTimer) clearTimeout(this.toasts[idx].autoCloseTimer);
        this.toasts.splice(idx, 1);
      }
    }
    this.cdr.detectChanges();
  }
}
