import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CameraTrackingService } from '../../core/services/camera-tracking.service';
import { TimerService } from '../../core/services/timer.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './sidebar.html',
  host: {
    'class': 'h-full'
  }
})
export class Sidebar {
  menuOpen = signal(false);

  constructor(
    private router: Router,
    private cameraTracking: CameraTrackingService,
    private authService: AuthService,
    public timerSvc: TimerService
  ) {}

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  navigate(route: string) {
    this.router.navigate([route]);
    this.closeMenu();
  }

  logout() {
    this.cameraTracking.detener();
    this.timerSvc.limpiarParaLogout();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}