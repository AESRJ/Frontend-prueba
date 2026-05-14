import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { CameraToastComponent } from './shared/camera-toast/camera-toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CameraToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('focus-ai');
  private authService = inject(AuthService);

  // Bound para poder removerlo en ngOnDestroy.
  private readonly handleUnload = () => this.authService.endActiveSessionBestEffort();

  ngOnInit() {
    // pagehide cubre tanto cierre de pestana/ventana como navegacion fuera del SPA.
    // Mas confiable que beforeunload en mobile (Safari iOS).
    window.addEventListener('pagehide', this.handleUnload);
    // Fallback adicional para navegadores que no disparen pagehide consistentemente.
    window.addEventListener('beforeunload', this.handleUnload);
  }

  ngOnDestroy() {
    window.removeEventListener('pagehide', this.handleUnload);
    window.removeEventListener('beforeunload', this.handleUnload);
  }
}
