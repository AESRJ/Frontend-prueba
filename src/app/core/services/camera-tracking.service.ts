import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { DistractionLogService, DistractionType } from './distracion-log.service';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

export interface ToastEvent {
  tipo: DistractionType;
  mensaje: string;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CameraTrackingService {
  private stream: MediaStream | null = null;

  // Video interno persistente: vive todo el ciclo del SPA, oculto fuera de pantalla.
  // face-api ejecuta deteccion sobre este elemento — asi la captura NO se interrumpe
  // cuando el usuario navega del dashboard al cuestionario TDAH/IQ y de vuelta.
  private internalVideo: HTMLVideoElement;

  // Video visible (del dashboard). Solo lo conectamos para que el usuario vea
  // el preview; las detecciones siguen corriendo sobre internalVideo aunque
  // este sea null (al navegar a otra ruta).
  private previewVideo: HTMLVideoElement | null = null;

  private detectionInterval: any = null;
  private running = false;

  private faceapi: any = null;
  private modelsLoaded = false;

  // Timers de distracción
  private fueraDeEncuadreStart: number | null = null;
  private desvioMiradaStart: number | null = null;

  private alertaFueraEncuadreEmitida = false;
  private alertaDesvioMiradaEmitida = false;

  // Umbral en ms (1 segundo)
  private readonly UMBRAL_MS = 1000;

  toast$ = new Subject<ToastEvent>();
  cameraStatus$ = new Subject<CameraStatus>();

  constructor(
    private ngZone: NgZone,
    private distractionLog: DistractionLogService
  ) {
    // Crear el video interno una sola vez. Esta fuera del flujo del router-outlet,
    // por lo que sobrevive a navegacion entre componentes.
    this.internalVideo = document.createElement('video');
    this.internalVideo.muted = true;
    this.internalVideo.autoplay = true;
    this.internalVideo.playsInline = true;
    this.internalVideo.setAttribute('aria-hidden', 'true');
    // Fuera de pantalla pero presente en el DOM (face-api requiere que el video
    // este conectado y reproduciendose para leer frames).
    Object.assign(this.internalVideo.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.internalVideo);
  }

  /** ¿Hay un stream activo (independiente de si el preview esta montado)? */
  isActive(): boolean {
    return this.stream !== null;
  }

  /**
   * Conecta o desconecta el <video> visible del dashboard. No afecta al stream
   * ni a la deteccion — solo "espejea" el stream a ese elemento para que el
   * usuario vea su camara. Pasar null al destruirse el dashboard.
   */
  async attachPreviewVideo(videoEl: HTMLVideoElement | null): Promise<void> {
    // Desconectar el anterior si lo hubiera
    if (this.previewVideo && this.previewVideo !== videoEl) {
      try { this.previewVideo.pause(); } catch {}
      this.previewVideo.srcObject = null;
    }

    this.previewVideo = videoEl;

    if (videoEl && this.stream) {
      videoEl.srcObject = this.stream;
      try { await videoEl.play(); } catch { /* autoplay puede fallar, no es bloqueante */ }
    }
  }

  async iniciar(): Promise<boolean> {
    // Si ya hay stream vivo, no pedir uno nuevo. Solo asegurar deteccion corriendo.
    if (this.stream) {
      this.cameraStatus$.next('active');
      if (!this.running && this.modelsLoaded) {
        this.iniciarDeteccion();
      }
      return true;
    }

    this.cameraStatus$.next('requesting');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      this.internalVideo.srcObject = this.stream;
      await this.internalVideo.play();

      // Si el dashboard ya monto un preview antes de iniciar(), espejearlo.
      if (this.previewVideo) {
        this.previewVideo.srcObject = this.stream;
        try { await this.previewVideo.play(); } catch {}
      }

      this.cameraStatus$.next('active');
      await this.cargarFaceApi();
      this.iniciarDeteccion();
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.cameraStatus$.next('denied');
      } else {
        this.cameraStatus$.next('error');
      }
      return false;
    }
  }

  detener(): void {
    this.running = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    // Actualizar duraciones finales de distracciones pendientes
    this.actualizarDuracionFinalSiCorresponde('fuera_de_encuadre', this.fueraDeEncuadreStart, this.alertaFueraEncuadreEmitida);
    this.actualizarDuracionFinalSiCorresponde('desvio_mirada', this.desvioMiradaStart, this.alertaDesvioMiradaEmitida);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Limpiar referencias en ambos videos (interno y preview) para que el LED
    // del dispositivo se apague de inmediato.
    try { this.internalVideo.pause(); } catch {}
    this.internalVideo.srcObject = null;
    if (this.previewVideo) {
      try { this.previewVideo.pause(); } catch {}
      this.previewVideo.srcObject = null;
    }

    this.fueraDeEncuadreStart = null;
    this.desvioMiradaStart = null;
    this.alertaFueraEncuadreEmitida = false;
    this.alertaDesvioMiradaEmitida = false;

    this.cameraStatus$.next('idle');
  }

  pausar(): void {
    this.running = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  reanudar(): void {
    if (this.stream && this.modelsLoaded) {
      this.iniciarDeteccion();
    }
  }

  // ── FIX: CDN UNIFICADO con @vladmandic/face-api ──
  private async cargarFaceApi(): Promise<void> {
    if (this.modelsLoaded) return;

    // Usar @vladmandic/face-api para TODO (librería + modelos)
    await this.cargarScript(
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js'
    );

    this.faceapi = (window as any).faceapi;

    if (!this.faceapi) {
      console.error('face-api.js no se pudo cargar');
      return;
    }

    // Modelos del MISMO repositorio que la librería
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

    try {
      // Cargar tinyFaceDetector + faceLandmark68TinyNet (compatibles)
      await this.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await this.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      this.modelsLoaded = true;
      console.log('Modelos de face-api cargados correctamente');
    } catch (err) {
      console.error('Error cargando modelos face-api:', err);
      // Fallback: solo detector de rostro sin landmarks
      try {
        await this.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        this.modelsLoaded = true;
        console.log('Modelo tinyFaceDetector cargado (fallback sin landmarks)');
      } catch (err2) {
        console.error('No se pudieron cargar los modelos:', err2);
      }
    }
  }

  private cargarScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Evitar cargar el mismo script dos veces
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }

  private iniciarDeteccion(): void {
    if (this.running) return;
    this.running = true;

    this.detectionInterval = setInterval(async () => {
      if (!this.running || !this.faceapi || !this.modelsLoaded) return;
      // Siempre detectamos sobre el video interno (persistente, oculto), no sobre
      // el preview que puede estar desmontado al navegar a otra ruta.
      const sourceVideo = this.internalVideo;
      if (!sourceVideo || sourceVideo.readyState < 2) return;

      try {
        const options = new this.faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5
        });

        let detections: any[] = [];

        // Verificar si tenemos landmarks disponibles
        const hasLandmarks = this.faceapi.nets.faceLandmark68TinyNet?.isLoaded;

        if (hasLandmarks) {
          try {
            detections = await this.faceapi
              .detectAllFaces(sourceVideo, options)
              .withFaceLandmarks(true);
          } catch (e) {
            // Fallback: solo detección de rostro
            const rawDetections = await this.faceapi.detectAllFaces(sourceVideo, options);
            detections = rawDetections.map((d: any) => ({ detection: d, landmarks: null }));
          }
        } else {
          // Solo detección de rostro sin landmarks
          const rawDetections = await this.faceapi.detectAllFaces(sourceVideo, options);
          detections = rawDetections.map((d: any) => ({ detection: d, landmarks: null }));
        }

        this.ngZone.run(() => {
          this.procesarDetecciones(detections);
        });
      } catch (e) {
        // Silenciar errores intermitentes
      }
    }, 500);
  }

  private procesarDetecciones(detections: any[]): void {
    const ahora = Date.now();

    if (!detections || detections.length === 0) {
      // Criterio ⑥: no se detecta rostro → fuera de encuadre
      this.procesarFueraDeEncuadre(ahora);
      this.resetDesvioMirada();
    } else {
      // Rostro detectado → resetear fuera de encuadre
      this.resetFueraDeEncuadre();

      // Criterio ④ y ⑤: analizar dirección de mirada
      const landmarks = detections[0]?.landmarks ?? null;

      if (landmarks && landmarks.getNose && landmarks.getJawOutline) {
        const mirandoPantalla = this.analizarMirada(landmarks);
        if (!mirandoPantalla) {
          this.procesarDesvioMirada(ahora);
        } else {
          this.resetDesvioMirada();
        }
      } else {
        // Sin landmarks disponibles: solo detectamos presencia, no mirada
        this.resetDesvioMirada();
      }
    }
  }

  private analizarMirada(landmarks: any): boolean {
    if (!landmarks) return true;

    try {
      const nose = landmarks.getNose();
      const jaw = landmarks.getJawOutline();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      if (!nose || !jaw || !leftEye || !rightEye) return true;

      const noseTip = nose[3] || nose[nose.length - 1];
      const jawLeft = jaw[0];
      const jawRight = jaw[jaw.length - 1];
      const faceCenterX = (jawLeft.x + jawRight.x) / 2;
      const faceWidth = Math.abs(jawRight.x - jawLeft.x);

      const desvioHorizontal = Math.abs(noseTip.x - faceCenterX) / (faceWidth || 1);

      const eyeCenterY = (leftEye[0].y + rightEye[0].y) / 2;
      const faceHeight = Math.abs(noseTip.y - eyeCenterY);
      const desvioVertical = (noseTip.y - eyeCenterY) / (faceHeight || 1);

      const mirandoHorizontal = desvioHorizontal < 0.38;
      const mirandoVertical = desvioVertical > 0 && desvioVertical < 2.5;

      return mirandoHorizontal && mirandoVertical;
    } catch (e) {
      console.warn('Error analizando mirada:', e);
      return true;
    }
  }

  // ── Fuera de encuadre (Criterio ⑥) ──
  private procesarFueraDeEncuadre(ahora: number): void {
    if (this.fueraDeEncuadreStart === null) {
      this.fueraDeEncuadreStart = ahora;
      this.alertaFueraEncuadreEmitida = false;
    }

    const duracion = ahora - this.fueraDeEncuadreStart;

    // Criterio ⑥: Solo registrar si supera los 5 segundos
    if (duracion >= this.UMBRAL_MS && !this.alertaFueraEncuadreEmitida) {
      this.alertaFueraEncuadreEmitida = true;
      
      // Registrar evento con duración actual (5 segundos o más)
      this.distractionLog.registrarEvento('fuera_de_encuadre', duracion / 1000);

      // Criterio ⑪: mensaje exacto
      this.toast$.next({
        tipo: 'fuera_de_encuadre',
        mensaje: 'No se detecta tu rostro',
        visible: true
      });
    }
  }

  private resetFueraDeEncuadre(): void {
    if (this.fueraDeEncuadreStart !== null) {
      // Solo actualizar si la duración superó los 5s Y se emitió alerta
      const duracionTotal = (Date.now() - this.fueraDeEncuadreStart) / 1000;
      if (this.alertaFueraEncuadreEmitida && duracionTotal >= 1) {
        const eventos = this.distractionLog.getEventosPorTipo('fuera_de_encuadre');
        if (eventos.length > 0) {
          eventos[eventos.length - 1].duracion_segundos = Math.round(duracionTotal);
        }
      }
      this.fueraDeEncuadreStart = null;
      this.alertaFueraEncuadreEmitida = false;

      // Criterio ⑫: descartar toast cuando usuario retoma encuadre
      this.toast$.next({
        tipo: 'fuera_de_encuadre',
        mensaje: '',
        visible: false
      });
    }
  }

  // ── Desvío de mirada (Criterio ⑤) ──
  private procesarDesvioMirada(ahora: number): void {
    if (this.desvioMiradaStart === null) {
      this.desvioMiradaStart = ahora;
      this.alertaDesvioMiradaEmitida = false;
    }

    const duracion = ahora - this.desvioMiradaStart;

    // Criterio ⑤: Solo registrar si supera los 5 segundos
    if (duracion >= this.UMBRAL_MS && !this.alertaDesvioMiradaEmitida) {
      this.alertaDesvioMiradaEmitida = true;
      
      // Registrar evento con duración actual (5 segundos o más)
      this.distractionLog.registrarEvento('desvio_mirada', duracion / 1000);

      // Criterio ⑪: mensaje exacto
      this.toast$.next({
        tipo: 'desvio_mirada',
        mensaje: 'Desvío de mirada detectado',
        visible: true
      });
    }
  }

  private resetDesvioMirada(): void {
    if (this.desvioMiradaStart !== null) {
      // Solo actualizar si la duración superó los 5s Y se emitió alerta
      const duracionTotal = (Date.now() - this.desvioMiradaStart) / 1000;
      if (this.alertaDesvioMiradaEmitida && duracionTotal >= 1) {
        const eventos = this.distractionLog.getEventosPorTipo('desvio_mirada');
        if (eventos.length > 0) {
          eventos[eventos.length - 1].duracion_segundos = Math.round(duracionTotal);
        }
      }
      this.desvioMiradaStart = null;
      this.alertaDesvioMiradaEmitida = false;

      // Criterio ⑫: descartar toast cuando usuario retoma la mirada
      this.toast$.next({
        tipo: 'desvio_mirada',
        mensaje: '',
        visible: false
      });
    }
  }

  private actualizarDuracionFinalSiCorresponde(tipo: DistractionType, startTime: number | null, alertaEmitida: boolean): void {
    if (startTime !== null && alertaEmitida) {
      const duracionFinal = (Date.now() - startTime) / 1000;
      if (duracionFinal >= 1) {
        const eventos = this.distractionLog.getEventosPorTipo(tipo);
        if (eventos.length > 0) {
          eventos[eventos.length - 1].duracion_segundos = Math.round(duracionFinal);
        }
      }
    }
  }
}