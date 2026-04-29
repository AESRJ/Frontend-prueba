import { Component, signal, computed, inject, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FocusService } from '../../core/services/focus.service';

@Component({
  selector: 'app-preferencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preferencias.html'
})
export class Preferencias implements OnInit {

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private focusSvc = inject(FocusService);

  preferencias = signal({ modo: '', duracion: 45 });
  mostrarCompletado = signal(false);
  mostrarSesionActiva = signal(false);
  haySesionActiva = signal(false);

  botonBloqueado = computed(() => this.preferencias().modo === '');

  ngOnInit() {
    this.cargarPreferenciasGuardadas();
    this.verificarSesionActiva();
  }

  private cargarPreferenciasGuardadas() {
    const localPrefs = this.focusSvc.getPreferenciasLocal();
    if (localPrefs) {
      this.preferencias.set({ modo: localPrefs.mode, duracion: localPrefs.duration });
    } else {
      this.preferencias.set({ modo: 'tranquilo', duracion: 45 });
    }
  }

  private verificarSesionActiva() {
    this.focusSvc.getActiveSession().subscribe({
      next: (session) => this.haySesionActiva.set(!!session),
      error: () => this.haySesionActiva.set(false)
    });
  }

  seleccionarModo(modo: string) {
    this.preferencias.update(prev => ({ ...prev, modo }));
  }

  actualizarDuracion(valor: number) {
    this.preferencias.update(prev => ({ ...prev, duracion: valor }));
  }

  async guardar() {
    if (this.botonBloqueado()) return;

    const prefs = { mode: this.preferencias().modo, duration: this.preferencias().duracion };

    try {
      this.focusSvc.guardarPreferenciasLocal(prefs);
      await this.focusSvc.savePreferences(prefs.mode, prefs.duration).toPromise();

      if (this.haySesionActiva()) {
        this.mostrarSesionActiva.set(true);
        setTimeout(() => {
          this.mostrarSesionActiva.set(false);
          this.guardado.emit();
          this.cerrar.emit();
        }, 1000);
      } else {
        this.mostrarCompletado.set(true);
        setTimeout(() => {
          this.mostrarCompletado.set(false);
          this.guardado.emit();
          this.cerrar.emit();
        }, 1000);
      }
    } catch {
      this.mostrarCompletado.set(true);
      setTimeout(() => {
        this.mostrarCompletado.set(false);
        this.guardado.emit();
        this.cerrar.emit();
      }, 1000);
    }
  }
}