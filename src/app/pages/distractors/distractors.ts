import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../shared/sidebar/sidebar';
import {
  Distractor,
  DistractorCategoria,
  DistractorService,
  DistractorTipo,
  normalizeIdentifier
} from '../../core/services/distractor.service';
import { DistractorDetectionService } from '../../core/services/distractor-detection.service';

interface ResultadoPrueba {
  hostnameProbado: string;
  match: { nombre: string; categoria: string; origen: string } | null;
  accionProyectada: string | null;
}

interface FormState {
  nombre: string;
  identificador: string;
  tipo: DistractorTipo;
  categoria: DistractorCategoria;
}

const EMPTY_FORM: FormState = {
  nombre: '',
  identificador: '',
  tipo: 'url',
  categoria: 'red_social'
};

@Component({
  selector: 'app-distractors',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './distractors.html'
})
export class Distractors implements OnInit {
  private readonly api = inject(DistractorService);
  private readonly deteccion = inject(DistractorDetectionService);

  // Listas separadas para mostrar globales y personales por separado
  readonly globales = signal<Distractor[]>([]);
  readonly personales = signal<Distractor[]>([]);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeOk = signal<string | null>(null);

  // Estado del formulario (crear o editar)
  readonly form = signal<FormState>({ ...EMPTY_FORM });
  readonly editandoId = signal<number | null>(null);

  readonly categorias: { value: DistractorCategoria; label: string }[] = [
    { value: 'red_social', label: 'Red social' },
    { value: 'videojuego', label: 'Videojuego' },
    { value: 'streaming',  label: 'Streaming'  },
    { value: 'otro',       label: 'Otro'       }
  ];

  readonly tipos: { value: DistractorTipo; label: string }[] = [
    { value: 'url',     label: 'URL (sitio web)'     },
    { value: 'proceso', label: 'Proceso (escritorio)' }
  ];

  readonly modoEdicion = computed(() => this.editandoId() !== null);
  readonly formularioValido = computed(() =>
    this.form().nombre.trim().length > 0 &&
    this.form().identificador.trim().length > 0
  );

  // Vista previa de cómo quedará guardado el identificador
  readonly identificadorNormalizado = computed(() =>
    normalizeIdentifier(this.form().identificador, this.form().tipo)
  );

  // Estado del panel de prueba
  readonly urlPrueba = signal('');
  readonly resultadoPrueba = signal<ResultadoPrueba | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.list({ origen: 'all' }).subscribe({
      next: (lista) => {
        this.globales.set(lista.filter(d => d.origen === 'global'));
        this.personales.set(lista.filter(d => d.origen === 'personal'));
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(this.mensajeError(e, 'No se pudieron cargar los distractores'));
        this.cargando.set(false);
      }
    });
  }

  setCampo<K extends keyof FormState>(campo: K, valor: FormState[K]): void {
    this.form.update(f => ({ ...f, [campo]: valor }));
  }

  iniciarEdicion(d: Distractor): void {
    this.editandoId.set(d.id);
    this.form.set({
      nombre: d.nombre,
      identificador: d.identificador,
      tipo: d.tipo,
      categoria: d.categoria
    });
    this.error.set(null);
    this.mensajeOk.set(null);
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.form.set({ ...EMPTY_FORM });
  }

  guardar(): void {
    if (!this.formularioValido() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.mensajeOk.set(null);

    const identificadorLimpio = normalizeIdentifier(this.form().identificador, this.form().tipo);
    if (!identificadorLimpio) {
      this.guardando.set(false);
      this.error.set('El identificador no es válido');
      return;
    }

    const payload = {
      nombre: this.form().nombre.trim(),
      identificador: identificadorLimpio,
      tipo: this.form().tipo,
      categoria: this.form().categoria
    };

    const id = this.editandoId();
    const op$ = id === null
      ? this.api.create(payload)
      : this.api.update(id, payload);

    op$.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mensajeOk.set(id === null ? 'Distractor creado' : 'Distractor actualizado');
        this.cancelarEdicion();
        this.cargar();
        this.deteccion.cargarDistractoresBackend();
        setTimeout(() => this.mensajeOk.set(null), 2000);
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(this.mensajeError(e, 'No se pudo guardar'));
      }
    });
  }

  eliminar(d: Distractor): void {
    if (!confirm(`¿Eliminar el distractor "${d.nombre}"?`)) return;
    this.error.set(null);
    this.api.delete(d.id).subscribe({
      next: () => {
        this.mensajeOk.set('Distractor eliminado');
        this.personales.update(lista => lista.filter(x => x.id !== d.id));
        if (this.editandoId() === d.id) this.cancelarEdicion();
        this.deteccion.cargarDistractoresBackend();
        setTimeout(() => this.mensajeOk.set(null), 2000);
      },
      error: (e) => this.error.set(this.mensajeError(e, 'No se pudo eliminar'))
    });
  }

  setUrlPrueba(valor: string): void {
    this.urlPrueba.set(valor);
  }

  probarDeteccion(): void {
    const url = this.urlPrueba().trim();
    if (!url) {
      this.resultadoPrueba.set(null);
      return;
    }
    const r = this.deteccion.probarUrl(url);
    let hostname = url;
    try {
      hostname = new URL(/^[a-z]+:\/\//i.test(url) ? url : 'http://' + url).hostname.replace(/^www\./, '');
    } catch { /* deja el input como está */ }
    this.resultadoPrueba.set({
      hostnameProbado: hostname,
      match: r.match ? { nombre: r.match.nombre, categoria: r.match.categoria, origen: r.match.origen } : null,
      accionProyectada: r.accionProyectada
    });
  }

  private mensajeError(e: any, fallback: string): string {
    if (e?.status === 401) return 'Sesión expirada. Vuelve a iniciar sesión.';
    if (e?.error?.detail) return String(e.error.detail);
    return fallback;
  }
}
