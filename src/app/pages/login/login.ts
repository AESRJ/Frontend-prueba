import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FocusService } from '../../core/services/focus.service';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './login.html'
})
export class Login {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  mode = signal<'login' | 'register'>('login');

  email = signal('');
  password = signal('');
  emailError = signal('');
  passwordError = signal('');
  serverError = signal('');
  successMessage = signal('');
  loading = signal(false);
  showPassword = signal(false);

  name = signal('');
  username = signal('');
  nameError = signal('');
  usernameError = signal('');
  showModal = signal(false);

  private failedAttempts = 0;
  private lockUntil: Date | null = null;
  isLocked = signal(false);
  lockRemainingSeconds = signal(0);
  private lockInterval: any = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private focusSvc: FocusService,
  ) {}

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  switchMode(m: 'login' | 'register') {
    this.mode.set(m);
    this.clearErrors();
  }

  private clearErrors() {
    this.emailError.set('');
    this.passwordError.set('');
    this.nameError.set('');
    this.usernameError.set('');
    this.serverError.set('');
    this.successMessage.set('');
  }

  isLoginDisabled = computed(() =>
    !this.email() || !this.password() ||
    !!this.emailError() || !!this.passwordError() ||
    this.loading() || this.isLocked()
  );

  isRegisterDisabled = computed(() =>
    !this.name() || !this.username() || !this.email() || !this.password() ||
    !!this.nameError() || !!this.usernameError() || !!this.emailError() || !!this.passwordError() ||
    this.loading()
  );

  validateName() {
    this.nameError.set(!this.name() ? 'El nombre es obligatorio' : '');
  }

  validateUsername() {
    const usernameRegex = /^[a-zA-ZñÑ0-9_]{3,20}$/;
    if (!this.username()) {
      this.usernameError.set('El nombre de usuario es obligatorio');
    } else if (!usernameRegex.test(this.username())) {
      this.usernameError.set('3–20 caracteres, solo letras, números y _');
    } else {
      this.usernameError.set('');
    }
  }

  validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email()) {
      this.emailError.set('El correo electrónico es obligatorio');
    } else if (!emailRegex.test(this.email())) {
      this.emailError.set('Formato de correo inválido');
    } else {
      this.emailError.set('');
    }
  }

  validatePassword() {
    if (!this.password()) {
      this.passwordError.set('La contraseña es obligatoria');
    } else if (this.mode() === 'register' && this.password().length < 8) {
      this.passwordError.set('Mínimo 8 caracteres');
    } else {
      this.passwordError.set('');
    }
  }

  checkLockStatus(): boolean {
    if (this.lockUntil && new Date() < this.lockUntil) {
      this.isLocked.set(true);
      this.updateLockRemainingTime();
      return true;
    } else if (this.lockUntil && new Date() >= this.lockUntil) {
      this.clearLock();
    }
    return false;
  }

  private updateLockRemainingTime() {
    if (this.lockInterval) clearInterval(this.lockInterval);
    this.lockInterval = setInterval(() => {
      if (this.lockUntil) {
        const remaining = Math.max(0, Math.ceil((this.lockUntil.getTime() - new Date().getTime()) / 1000));
        if (remaining <= 0) {
          this.clearLock();
        } else {
          this.lockRemainingSeconds.set(remaining);
        }
      }
    }, 1000);
  }

  private clearLock() {
    this.isLocked.set(false);
    this.lockUntil = null;
    this.failedAttempts = 0;
    this.lockRemainingSeconds.set(0);
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
    }
  }

  private registerFailedAttempt() {
    this.failedAttempts++;
    if (this.failedAttempts >= 3) {
      this.lockUntil = new Date(Date.now() + 60 * 1000);
      this.isLocked.set(true);
      this.updateLockRemainingTime();
      this.serverError.set('Demasiados intentos fallidos. Cuenta bloqueada por 1 minuto.');
      this.password.set('');
    } else {
      const attemptsLeft = 3 - this.failedAttempts;
      this.serverError.set(`Correo o contraseña incorrectos. Te quedan ${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''}.`);
    }
  }

  private resetFailedAttempts() {
    this.failedAttempts = 0;
    this.lockUntil = null;
    this.isLocked.set(false);
    this.lockRemainingSeconds.set(0);
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
    }
  }

  onSubmit() {
    if (this.mode() === 'login') {
      this.onLogin();
    } else {
      this.onRegister();
    }
  }

  private onLogin() {
    if (this.checkLockStatus()) return;
    this.validateEmail();
    this.validatePassword();
    if (this.emailError() || this.passwordError()) return;

    this.loading.set(true);
    this.serverError.set('');
    this.successMessage.set('');

    this.authService.login(this.email(), this.password()).subscribe({
      next: () => {
        this.resetFailedAttempts();
        this.successMessage.set('Inicio de sesión exitoso');
        // Restaurar preferencias guardadas en backend al localStorage para que
        // las paginas (preferencias, dashboard, timer) las usen sin tener que
        // ir a /preferences. Si falla, las paginas caen a sus defaults.
        this.focusSvc.getPreferences().subscribe({
          next: (prefs) => {
            if (prefs) this.focusSvc.guardarPreferenciasLocal(prefs);
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.router.navigate(['/dashboard']);
          },
        });
      },
      error: (err) => {
        const errorMsg = err.error?.detail || 'Correo o contraseña incorrectos';
        if (errorMsg.toLowerCase().includes('credentials') ||
            errorMsg.toLowerCase().includes('incorrect') ||
            err.status === 401) {
          this.registerFailedAttempt();
        } else {
          this.serverError.set(errorMsg);
        }
        this.loading.set(false);
        this.password.set('');
      },
      complete: () => { this.loading.set(false); }
    });
  }

  private onRegister() {
    this.validateName();
    this.validateUsername();
    this.validateEmail();
    this.validatePassword();
    if (this.nameError() || this.usernameError() || this.emailError() || this.passwordError()) return;

    this.loading.set(true);
    this.serverError.set('');

    this.authService.register({
      name: this.name(),
      username: this.username(),
      email: this.email(),
      password: this.password()
    }).subscribe({
      next: () => { this.showModal.set(true); },
      error: (err) => {
        const raw = err.error?.detail;
        const detail = (
          typeof raw === 'string' ? raw
          : Array.isArray(raw) ? JSON.stringify(raw)
          : typeof raw === 'object' && raw !== null
            ? (raw.code ?? raw.reason ?? JSON.stringify(raw))
            : ''
        ).toLowerCase();

        if (detail.includes('username')) {
          this.usernameError.set('Este nombre de usuario ya está en uso');
        } else if (detail.includes('email')) {
          this.emailError.set('Este correo ya está registrado');
        } else if (detail.includes('password')) {
          this.passwordError.set('Mínimo 8 caracteres');
        } else {
          this.serverError.set('Error al registrar. Intenta de nuevo.');
        }
        this.loading.set(false);
      },
      complete: () => { this.loading.set(false); }
    });
  }

  goToLogin() {
    this.showModal.set(false);
    this.switchMode('login');
  }

  ngOnDestroy() {
    if (this.lockInterval) clearInterval(this.lockInterval);
  }
}