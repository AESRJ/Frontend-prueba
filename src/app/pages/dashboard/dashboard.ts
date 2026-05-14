import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CameraTrackingService, CameraStatus, ToastEvent } from '../../core/services/camera-tracking.service';
import { DistractionLogService } from '../../core/services/distracion-log.service';
import { FocusService } from '../../core/services/focus.service';
import { TimerService } from '../../core/services/timer.service';
import { DistractorDetectionService, DistractorAction, DistractorDetectionEvent } from '../../core/services/distractor-detection.service';
import { SessionApiService, DetectionOut } from '../../core/services/session-api.service';
import { Sidebar } from '../../shared/sidebar/sidebar';
import { Preferencias } from '../../features/preferencias/preferencias';
import { SessionReportComponent, SessionReportData } from '../../shared/session-report/session-report';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [Sidebar, Preferencias, SessionReportComponent],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  loading = false;
  error = '';
  cameraStatus: CameraStatus = 'idle';
  cameraPermisoDenegado = false;
  toasts: { tipo: string; mensaje: string; visible: boolean; autoCloseTimer?: any }[] = [];
  ultimoEventoTimestamp = '';
  ultimoEventoTipo = '';
  totalDistracciones = 0;
  confettiPieces: { left: string; delay: string; duration: string; color: string }[] = [];
  mostrarPreferencias = signal(false);
  _mostrarModal = false;

  // H9 — bloqueo de distractores
  distractorBloqueado: { nombre: string; visible: boolean } = { nombre: '', visible: false };

  // H10 — reporte de sesión
  reporteSesion: SessionReportData | null = null;
  mostrarReporte = false;

  private toastSub!: Subscription;
  private statusSub!: Subscription;
  private distractorSub!: Subscription;

  // AudioContext perezoso para emitir beep cuando se detecta una distraccion
  // visual (camara) en modos Alerta o Concentracion absoluta.
  private audioCtx: AudioContext | null = null;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private cameraTracking: CameraTrackingService,
    private distractionLog: DistractionLogService,
    private focusService: FocusService,
    public timerSvc: TimerService,
    private distractorDetection: DistractorDetectionService,
    private sessionApi: SessionApiService
  ) {}

  get timerDisplay()     { return this.timerSvc.timerDisplay; }
  get sesionActiva()     { return this.timerSvc.state.sesionActiva; }
  get pausado()          { return this.timerSvc.state.pausado; }
  get sesionTerminada()  { return this.timerSvc.state.sesionTerminada; }
  get mostrarModal()     { return this.timerSvc.state.sesionTerminada && this.timerSvc.state.tiempoRestante <= 0; }
  get tiempoRestante()   { return this.timerSvc.state.tiempoRestante; }
  get duracionMinutos()  { return this.timerSvc.state.duracionMinutos; }
  get modoTexto()        { return this.timerSvc.state.modoTexto; }
  get horaInicio()       { return this.timerSvc.state.horaInicio; }
  get horaFin()          { return this.timerSvc.state.horaFin; }

  get barraProgreso(): number {
    const total = this.timerSvc.state.tiempoTotal;
    if (!total) return 100;
    return (this.timerSvc.state.tiempoRestante / total) * 100;
  }

  get estaEnAdvertencia(): boolean {
    return this.timerSvc.state.sesionActiva && this.timerSvc.state.tiempoRestante <= 120;
  }

  get tooltipTiempo(): string {
    const seg = this.timerSvc.state.tiempoRestante;
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  ngOnInit() {
    this.cargarPreferencias();

    if (this.timerSvc.state.sesionActiva && !this.timerSvc.state.pausado) {
      this.timerSvc.iniciarTimer(
        () => this.cdr.detectChanges(),
        () => this.endSession()
      );

      setTimeout(async () => {
        const videoEl = this.videoRef?.nativeElement;
        if (videoEl) {
          // Si ya hay stream vivo (vuelta desde /iq o /adhd-questions), solo
          // espejeamos. Si no, lo arrancamos y espejeamos.
          if (!this.cameraTracking.isActive()) {
            await this.cameraTracking.iniciar();
          }
          await this.cameraTracking.attachPreviewVideo(videoEl);
          this.cdr.detectChanges();
        }
      }, 200);
    }

    this.toastSub = this.cameraTracking.toast$.subscribe((event: ToastEvent) => {
      this.manejarToast(event);

      // Reproducir alerta sonora SOLO cuando aparece la distraccion (event.visible)
      // y el modo del usuario es Alerta o Concentracion absoluta. El modo
      // Tranquilo recibe solo el toast visual, sin sonido.
      if (event.visible && this.modoRequiereSonido()) {
        this.playAlertBeep();
      }

      this.totalDistracciones = this.distractionLog.getEventos().length;
      const eventos = this.distractionLog.getEventos();
      if (eventos.length > 0) {
        const ultimo = eventos[eventos.length - 1];
        this.ultimoEventoTimestamp = ultimo.timestamp;
        this.ultimoEventoTipo = ultimo.tipo === 'desvio_mirada' ? 'Desvío de mirada' : 'Fuera de encuadre';
      }
      this.cdr.detectChanges();
    });

    this.statusSub = this.cameraTracking.cameraStatus$.subscribe((status: CameraStatus) => {
      this.cameraStatus = status;
      this.cameraPermisoDenegado = status === 'denied';
      this.cdr.detectChanges();
    });

    // H9 — suscripción a detección de distractores
    this.distractorSub = this.distractorDetection.deteccion$.subscribe(({ evento, accion }) => {
      this.manejarDistractor(evento, accion);
    });
  }

  ngOnDestroy() {
    this.toastSub?.unsubscribe();
    this.statusSub?.unsubscribe();
    this.distractorSub?.unsubscribe();

    // NO detenemos la camara aqui: queremos que siga capturando distracciones
    // mientras el usuario hace el cuestionario TDAH/IQ. Solo desconectamos el
    // preview visible para que el <video> destruido no quede agarrando el stream.
    // La camara se libera en endSession()/nuevaSesion(), o en pagehide (App).
    this.cameraTracking.attachPreviewVideo(null);

    // Cerrar AudioContext si quedo abierto
    this.cerrarAudioCtx();
  }

  /** ¿El modo activo requiere alerta sonora cuando hay distraccion visual? */
  private modoRequiereSonido(): boolean {
    const modo = (this.modoTexto || '').toLowerCase();
    return modo.includes('alerta') || modo.includes('absoluta');
  }

  /** Reproduce un beep corto via Web Audio (sin archivos binarios). */
  private playAlertBeep(): void {
    try {
      if (!this.audioCtx) {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        this.audioCtx = new Ctor();
      }
      const ctx = this.audioCtx!;
      // Si el contexto quedo suspendido por politicas de autoplay, intentar reanudarlo.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;

      const now = ctx.currentTime;
      const dur = 0.25;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    } catch (err) {
      // No bloquear el flujo de UI si el audio falla
      console.warn('playAlertBeep error:', err);
    }
  }

  private cerrarAudioCtx(): void {
    try {
      this.audioCtx?.close();
    } catch {}
    this.audioCtx = null;
  }

  cargarPreferencias() {
    if (this.timerSvc.state.sesionActiva) return;
    const prefs = this.focusService.getPreferenciasLocal();
    const duracion = prefs ? Number(prefs.duration) || 45 : 45;
    const modosMap: Record<string, string> = {
      'tranquilo': 'Tranquilo',
      'alerta': 'Alerta',
      'absoluta': 'Concentración absoluta'
    };
    const modo = prefs ? (modosMap[prefs.mode] || 'No configurado') : 'Tranquilo';
    this.timerSvc.setEstadoSesion({
      duracionMinutos: duracion,
      modoTexto: modo,
      tiempoTotal: duracion * 60,
      tiempoRestante: duracion * 60
    });
  }

  async startSession() {
    if (this.loading || this.timerSvc.state.sesionActiva) {
      this.error = 'Ya hay una sesión activa. Finalízala primero.';
      return;
    }

    try {
      const activeSession = await this.focusService.getActiveSession().toPromise();
      if (activeSession && activeSession.id) {
        this.error = 'Ya hay una sesión activa en el servidor.';
        this.timerSvc.setEstadoSesion({ sesionActiva: true, sessionIdBackend: activeSession.id });
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
    } catch (err) {}

    this.loading = true;
    this.error = '';
    this.cameraPermisoDenegado = false;
    this.distractionLog.limpiar();
    this.totalDistracciones = 0;
    this.ultimoEventoTimestamp = '';
    this.ultimoEventoTipo = '';
    this.timerSvc.setEstadoSesion({ sesionActiva: true });
    this.cdr.detectChanges();

    await new Promise(resolve => setTimeout(resolve, 100));

    const videoEl = this.videoRef?.nativeElement;

    if (!videoEl) {
      this.error = 'No se encontró el elemento de video.';
      this.timerSvc.setEstadoSesion({ sesionActiva: false });
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    const cameraOk = await this.cameraTracking.iniciar();
    if (cameraOk) {
      // Espejear el stream al <video> visible del dashboard.
      await this.cameraTracking.attachPreviewVideo(videoEl);
    }

    if (!cameraOk) {
      this.cameraPermisoDenegado = true;
      this.error = 'No se puede iniciar la sesión sin acceso a la cámara.';
      this.timerSvc.setEstadoSesion({ sesionActiva: false });
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const newSession = await this.focusService.startSessionWithDuration(this.duracionMinutos).toPromise();
      if (newSession && newSession.id) {
        this.timerSvc.setEstadoSesion({ sessionIdBackend: newSession.id });
      }
    } catch (err) {}

    const horaInicio = this.formatearFecha(new Date());
    this.timerSvc.setEstadoSesion({
      pausado: false,
      sesionTerminada: false,
      tiempoRestante: this.timerSvc.state.tiempoTotal,
      horaInicio,
      horaFin: ''
    });

    // H9 — iniciar monitoreo de distractores
    this.distractorDetection.iniciarMonitoreo();

    this.timerSvc.iniciarTimer(
      () => this.cdr.detectChanges(),
      () => this.endSession()
    );

    this.loading = false;
    this._mostrarModal = false;
    this.cdr.detectChanges();
  }

  togglePausa() {
    if (!this.timerSvc.state.sesionActiva || this.timerSvc.state.sesionTerminada) return;
    if (!this.timerSvc.state.pausado) {
      this.timerSvc.pausarTimer();
      this.cameraTracking.pausar();
    } else {
      this.timerSvc.reanudarTimer(
        () => this.cdr.detectChanges(),
        () => this.endSession()
      );
      this.cameraTracking.reanudar();
    }
    this.cdr.detectChanges();
  }

  async endSession() {
    if (!this.timerSvc.state.sesionActiva || this.loading) return;
    this.loading = true;
    this.timerSvc.limpiarInterval();
    this.cameraTracking.detener();

    // H9 — detener monitoreo de distractores
    this.distractorDetection.detenerMonitoreo();
    this.distractorBloqueado = { nombre: '', visible: false };

    const horaFin = this.formatearFecha(new Date());
    const completada = this.timerSvc.state.tiempoRestante <= 0;

    // Capturar el ID antes de cerrar/limpiar la sesión, para poder traer las
    // detecciones de URL desde el backend después.
    const backendSessionId = this.timerSvc.state.sessionIdBackend;

    if (backendSessionId) {
      try { await this.focusService.endSession(backendSessionId).toPromise(); } catch (err) {}
    }

    // Traer las detecciones de URL registradas durante la sesión. Best-effort:
    // si falla la red, el reporte sigue mostrando lo de cámara.
    let deteccionesUrl: DetectionOut[] = [];
    if (backendSessionId) {
      try {
        deteccionesUrl = await this.sessionApi.listDetections(backendSessionId).toPromise() ?? [];
      } catch (err) {
        deteccionesUrl = [];
      }
    }

    const distraccionesData = this.distractionLog.sincronizarAlFinalizar();

    const sesion: SessionReportData = {
      id: 'session_' + Date.now(),
      start_time: this.horaInicio,
      end_time: horaFin,
      modo: this.modoTexto,
      duracion_configurada: this.duracionMinutos,
      tiempo_usado_segundos: this.timerSvc.state.tiempoTotal - this.timerSvc.state.tiempoRestante,
      completada,
      distracciones: distraccionesData.eventos,
      total_distracciones: distraccionesData.total,
      detecciones_url: deteccionesUrl
    };

    const historial = JSON.parse(localStorage.getItem('focus_session_history') || '[]');
    historial.push(sesion);
    localStorage.setItem('focus_session_history', JSON.stringify(historial));
    this.distractionLog.guardarEnLocalStorage(sesion.id);

    this.timerSvc.setEstadoSesion({
      sesionActiva: false,
      pausado: false,
      sesionTerminada: true,
      horaFin,
      sessionIdBackend: null
    });

    this.loading = false;
    this.toasts = [];

    // H10 — mostrar reporte automáticamente al finalizar sesión
    this.reporteSesion = sesion;
    this.mostrarReporte = true;

    if (completada) {
      this.generarConfetti();
    }

    this.cdr.detectChanges();
  }

  nuevaSesion() {
    this.cameraTracking.detener();
    this.distractorDetection.detenerMonitoreo();
    this.timerSvc.resetear();
    this.cameraStatus = 'idle';
    this.cameraPermisoDenegado = false;
    this.toasts = [];
    this.totalDistracciones = 0;
    this.ultimoEventoTimestamp = '';
    this.ultimoEventoTipo = '';
    this.error = '';
    this._mostrarModal = false;
    this.mostrarReporte = false;
    this.reporteSesion = null;
    this.distractorBloqueado = { nombre: '', visible: false };
    this.cargarPreferencias();
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this._mostrarModal = false;
    this.nuevaSesion();
  }

  // H10 — cerrar reporte sin iniciar nueva sesión
  cerrarReporte() {
    this.mostrarReporte = false;
    this.reporteSesion = null;
    this.cdr.detectChanges();
  }

  // H10 — cerrar reporte e iniciar nueva sesión
  onNuevaSesionDesdeReporte() {
    this.nuevaSesion();
  }

  // H9 — desbloquear manualmente
  desbloquearDistractor() {
    this.distractorBloqueado = { nombre: '', visible: false };
    this.cdr.detectChanges();
  }

  cerrarToast(index: number) {
    if (this.toasts[index]) {
      if (this.toasts[index].autoCloseTimer) clearTimeout(this.toasts[index].autoCloseTimer);
      this.toasts.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  abrirPreferencias() {
    this.mostrarPreferencias.set(true);
  }

  cerrarPreferencias() {
    this.mostrarPreferencias.set(false);
  }

  onPreferenciasGuardadas() {
    this.cargarPreferencias();
    this.cerrarPreferencias();
  }

  private manejarDistractor(evento: DistractorDetectionEvent, accion: DistractorAction): void {
    if (accion === 'silencio') {
      // Nivel bajo: solo registrar, sin notificar
      return;
    }
    if (accion === 'toast') {
      // Nivel intermedio: toast en esquina inferior derecha
      const tipo = 'distractor_' + evento.nombre;
      const existente = this.toasts.findIndex(t => t.tipo === tipo);
      if (existente >= 0) return;
      const toast = {
        tipo,
        mensaje: `⚠️ ${evento.nombre} detectado`,
        visible: true,
        autoCloseTimer: null as any
      };
      toast.autoCloseTimer = setTimeout(() => {
        const idx = this.toasts.indexOf(toast);
        if (idx >= 0) { this.toasts.splice(idx, 1); this.cdr.detectChanges(); }
      }, 6000);
      this.toasts.push(toast);
    }
    if (accion === 'bloqueo') {
      // Nivel alto: pantalla de bloqueo
      this.distractorBloqueado = { nombre: evento.nombre, visible: true };
    }
    this.cdr.detectChanges();
  }

  private manejarToast(event: ToastEvent): void {
    if (event.visible) {
      const existente = this.toasts.findIndex(t => t.tipo === event.tipo);
      if (existente >= 0) return;
      const toast = { tipo: event.tipo, mensaje: event.mensaje, visible: true, autoCloseTimer: null as any };
      toast.autoCloseTimer = setTimeout(() => {
        const idx = this.toasts.indexOf(toast);
        if (idx >= 0) { this.toasts.splice(idx, 1); this.cdr.detectChanges(); }
      }, 6000);
      this.toasts.push(toast);
    } else {
      const idx = this.toasts.findIndex(t => t.tipo === event.tipo);
      if (idx >= 0) {
        if (this.toasts[idx].autoCloseTimer) clearTimeout(this.toasts[idx].autoCloseTimer);
        this.toasts.splice(idx, 1);
      }
    }
  }

  private formatearFecha(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private generarConfetti() {
    const colores = ['#7c3aed','#a78bfa','#c4b5fd','#10b981','#f59e0b','#ec4899','#312e81'];
    this.confettiPieces = Array.from({ length: 50 }, () => ({
      left: Math.random() * 100 + '%',
      delay: Math.random() * 2 + 's',
      duration: (Math.random() * 2 + 2) + 's',
      color: colores[Math.floor(Math.random() * colores.length)]
    }));
  }
}