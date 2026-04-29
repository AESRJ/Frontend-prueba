import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile, UpdateProfileRequest } from '../../core/auth/auth.service';
import { DistractorDetectionService, RestrictionLevel } from '../../core/services/distractor-detection.service';
import { Sidebar } from '../../shared/sidebar/sidebar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './profile.html'
})
export class Profile implements OnInit {
  currentName = '';
  fullName = '';
  username = '';
  email = '';
  
  showPasswordPanel = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  
  currentPasswordError = '';
  newPasswordError = '';
  confirmPasswordError = '';
  loadingPassword = false;
  
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  fullNameError = '';
  usernameError = '';
  serverError = '';
  successMessage = '';
  loading = false;

  // H9 Nivel de restricción
  nivelRestriccionPendiente: RestrictionLevel = 'intermedio';
  nivelGuardado = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private distractorDetection: DistractorDetectionService
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();

    // H9 cargar nivel de restricción pendiente (o actual)
    const pending = localStorage.getItem('focus_restriction_level_pending') as RestrictionLevel;
    const current = localStorage.getItem('focus_restriction_level') as RestrictionLevel;
    this.nivelRestriccionPendiente = pending || current || 'intermedio';
  }

  private loadProfile() {
    this.authService.getProfile().subscribe({
      next: (user: UserProfile) => {
        this.fullName = (user as any).full_name || user.name || '';
        this.username = (user as any).username || user.name || '';
        this.email = user.email;
        this.currentName = this.fullName || this.username;
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (err.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        } else {
          this.serverError = 'No se pudo cargar el perfil.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  isSubmitDisabled(): boolean {
    return (!this.fullName && !this.username) || !!this.fullNameError || !!this.usernameError || this.loading;
  }

  validateFullName() {
    if (!this.fullName.trim()) {
      this.fullNameError = 'El nombre completo no puede estar vacio';
    } else if (this.fullName.trim().length < 3) {
      this.fullNameError = 'El nombre debe tener al menos 3 caracteres';
    } else {
      this.fullNameError = '';
    }
  }

  validateUsername() {
    const trimmed = this.username.trim();
    if (!trimmed) {
      this.usernameError = 'El nombre de usuario no puede estar vacío';
    } else if (trimmed.length < 3) {
      this.usernameError = 'El nombre de usuario debe tener al menos 3 caracteres';
    } else if (!/^[a-zA-ZñÑ0-9_]+$/.test(trimmed)) {
      this.usernameError = 'Solo letras (incluida ñ), números y guión bajo. Sin espacios.';
    } else {
      this.usernameError = '';
    }
  }

  onUsernameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\s/g, '');
    if (input.value !== clean) {
      input.value = clean;
    }
    this.username = clean;
    this.clearSuccess();
  }

  togglePasswordPanel() {
    this.showPasswordPanel = !this.showPasswordPanel;
    if (!this.showPasswordPanel) {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.currentPasswordError = '';
      this.newPasswordError = '';
      this.confirmPasswordError = '';
      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showConfirmPassword = false;
    }
  }

  validateNewPassword() {
    if (!this.newPassword) {
      this.newPasswordError = 'Ingresa la nueva contraseña';
    } else if (this.newPassword.length < 8) {
      this.newPasswordError = 'Minimo 8 caracteres';
    } else {
      this.newPasswordError = '';
    }
    this.validateConfirmPassword();
  }

  validateConfirmPassword() {
    if (!this.confirmPassword) {
      this.confirmPasswordError = '';
    } else if (this.newPassword !== this.confirmPassword) {
      this.confirmPasswordError = 'Las contraseñas no coinciden';
    } else {
      this.confirmPasswordError = '';
    }
  }

  onChangePassword() {
    if (!this.currentPassword) {
      this.currentPasswordError = 'Ingresa tu contraseña actual';
      return;
    } else {
      this.currentPasswordError = '';
    }

    this.validateNewPassword();
    this.validateConfirmPassword();

    if (this.currentPasswordError || this.newPasswordError || this.confirmPasswordError) return;

    if (this.newPassword !== this.confirmPassword) {
      this.confirmPasswordError = 'Las contraseñas no coinciden';
      return;
    }

    this.loadingPassword = true;
    const updateData: UpdateProfileRequest = { password: this.newPassword };
    
    this.authService.updateProfile(updateData).subscribe({
      next: () => {
        this.successMessage = 'Contraseña actualizada';
        this.showPasswordPanel = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showCurrentPassword = false;
        this.showNewPassword = false;
        this.showConfirmPassword = false;
        this.loadingPassword = false;
        setTimeout(() => { this.successMessage = ''; }, 3000);
      },
      error: (err) => {
        const detail = (err.error?.detail ?? '').toLowerCase();
        if (detail.includes('password') || detail.includes('incorrect') || detail.includes('invalid')) {
          this.currentPasswordError = 'Contraseña actual incorrecta';
        } else {
          this.serverError = 'Error al cambiar la contraseña';
        }
        this.loadingPassword = false;
      }
    });
  }

  // H9 guardar nivel de restricción (aplica en la siguiente sesión)
  onNivelRestriccionChange(nivel: RestrictionLevel) {
    this.nivelRestriccionPendiente = nivel;
    this.distractorDetection.setNivelRestriccion(nivel);
    this.nivelGuardado = true;
    setTimeout(() => { this.nivelGuardado = false; }, 3000);
  }

  clearSuccess() {
    this.successMessage = '';
    this.serverError = '';
  }

  onSubmit() {
    this.validateFullName();
    this.validateUsername();

    if (this.fullNameError || this.usernameError) return;

    if (!this.fullName.trim() && !this.username.trim()) {
      this.serverError = 'Debes proporcionar al menos nombre completo o nombre de usuario';
      return;
    }

    this.loading = true;
    this.serverError = '';
    this.successMessage = '';

    const updateData: any = {}; // Using any to handle dynamic property assignment
    if (this.fullName.trim()) {
      updateData.full_name = this.fullName.trim();
      updateData.name = this.fullName.trim();
    }
    if (this.username.trim()) {
      updateData.username = this.username.trim();
    }

    this.authService.updateProfile(updateData).subscribe({
      next: (user: UserProfile) => {
        this.fullName = (user as any).full_name || user.name || this.fullName;
        this.username = (user as any).username || this.username;
        this.email = user.email;
        this.currentName = this.fullName || this.username;
        this.successMessage = '✓ Datos guardados con éxito!';
        this.loading = false;
        setTimeout(() => { this.successMessage = ''; }, 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        const raw = err.error?.detail;
        const errorLower = (
          typeof raw === 'string' ? raw : 
          typeof raw === 'object' && raw != null ? (raw.code ?? raw.reason ?? JSON.stringify(raw)) : ''
        ).toLowerCase();

        if (errorLower.includes('username')) {
          this.usernameError = 'Este nombre de usuario ya está en uso';
        } else if (errorLower.includes('email')) {
          this.serverError = 'No se puede cambiar el correo electrónico';
        } else if (err.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
          return;
        } else {
          this.serverError = (typeof raw === 'string' ? raw : '') || 'Error al guardar los cambios';
        }
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}