import { Component, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { IqService, IqAnswer, IQ_QUESTIONS, IqQuestion, IqSubmitResponse } from '../../core/services/iq.service';
import { FocusService } from '../../core/services/focus.service';

type QuizState = 'intro' | 'quiz' | 'submitting' | 'done';

const VISUAL_SVGS: Record<number, string> = {
  // #1 Círculos crecen de izq→der y arriba→abajo
  1: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32"  cy="32"  r="8"  fill="white" opacity="0.85"/>
    <circle cx="96"  cy="32"  r="14" fill="white" opacity="0.85"/>
    <circle cx="160" cy="32"  r="20" fill="white" opacity="0.85"/>
    <circle cx="32"  cy="96"  r="14" fill="white" opacity="0.85"/>
    <circle cx="96"  cy="96"  r="20" fill="white" opacity="0.85"/>
    <circle cx="160" cy="96"  r="26" fill="white" opacity="0.85"/>
    <circle cx="32"  cy="160" r="20" fill="white" opacity="0.85"/>
    <circle cx="96"  cy="160" r="26" fill="white" opacity="0.85"/>
    <rect x="148" y="148" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="165" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,

  // #2 Cuadrícula 3×3: cada fila tiene triángulo, cuadrado, círculo
  2: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <polygon points="32,52 18,52 25,36"      fill="white" opacity="0.85"/>
    <rect    x="84"  y="16" width="24" height="24" fill="white" opacity="0.85"/>
    <circle  cx="160" cy="28" r="12"          fill="white" opacity="0.85"/>
    <rect    x="20"  y="76" width="24" height="24" fill="white" opacity="0.85"/>
    <circle  cx="96"  cy="88" r="12"          fill="white" opacity="0.85"/>
    <polygon points="160,112 146,112 153,96"  fill="white" opacity="0.85"/>
    <circle  cx="32"  cy="152" r="12"         fill="white" opacity="0.85"/>
    <polygon points="96,172 82,172 89,156"    fill="white" opacity="0.85"/>
    <rect x="148" y="140" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="157" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,

  // #3 Flechas rotan 45° horario por columna
  3: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <text x="32"  y="48"  text-anchor="middle" fill="white" font-size="28">↑</text>
    <text x="96"  y="48"  text-anchor="middle" fill="white" font-size="28">→</text>
    <text x="160" y="48"  text-anchor="middle" fill="white" font-size="28">↓</text>
    <text x="32"  y="112" text-anchor="middle" fill="white" font-size="28">←</text>
    <text x="96"  y="112" text-anchor="middle" fill="white" font-size="28">↑</text>
    <text x="160" y="112" text-anchor="middle" fill="white" font-size="28">→</text>
    <rect x="20" y="132" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="32"  y="149" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
    <text x="96"  y="176" text-anchor="middle" fill="white" font-size="28">←</text>
    <text x="160" y="176" text-anchor="middle" fill="white" font-size="28">↑</text>
  </svg>`,

  // #4 Puntos: valor = fila × columna
  4: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <text x="32"  y="48"  text-anchor="middle" fill="white" font-size="26" font-weight="bold">1</text>
    <text x="96"  y="48"  text-anchor="middle" fill="white" font-size="26" font-weight="bold">2</text>
    <text x="160" y="48"  text-anchor="middle" fill="white" font-size="26" font-weight="bold">3</text>
    <text x="32"  y="112" text-anchor="middle" fill="white" font-size="26" font-weight="bold">2</text>
    <text x="96"  y="112" text-anchor="middle" fill="white" font-size="26" font-weight="bold">4</text>
    <text x="160" y="112" text-anchor="middle" fill="white" font-size="26" font-weight="bold">6</text>
    <text x="32"  y="176" text-anchor="middle" fill="white" font-size="26" font-weight="bold">3</text>
    <text x="96"  y="176" text-anchor="middle" fill="white" font-size="26" font-weight="bold">6</text>
    <rect x="148" y="155" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="172" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,

  // #5 lados crecientes x columna, relleno alterno x fila
  5: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <polygon points="32,52 18,52 25,36"          fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <rect    x="84"  y="16" width="24" height="24" fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <polygon points="160,16 172,26 168,42 152,42 148,26" fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <polygon points="32,116 18,116 25,100"        fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <rect    x="84"  y="80" width="24" height="24" fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <polygon points="160,80 172,90 168,106 152,106 148,90" fill="none" stroke="white" stroke-width="2" opacity="0.85"/>
    <rect x="20" y="140" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="32"  y="157" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
    <rect    x="84"  y="144" width="24" height="24" fill="white" opacity="0.85"/>
    <polygon points="160,144 172,154 168,170 152,170 148,154" fill="white" opacity="0.85"/>
  </svg>`,

  // #6 Permutaciones ★ ✦ ✧
  6: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <text x="32"  y="52"  text-anchor="middle" fill="white" font-size="32">★</text>
    <text x="96"  y="52"  text-anchor="middle" fill="white" font-size="32">✦</text>
    <text x="160" y="52"  text-anchor="middle" fill="white" font-size="32">✧</text>
    <text x="32"  y="116" text-anchor="middle" fill="white" font-size="32">✦</text>
    <text x="96"  y="116" text-anchor="middle" fill="white" font-size="32">✧</text>
    <text x="160" y="116" text-anchor="middle" fill="white" font-size="32">★</text>
    <rect x="20" y="136" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="32"  y="153" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
    <text x="96"  y="180" text-anchor="middle" fill="white" font-size="32">★</text>
    <text x="160" y="180" text-anchor="middle" fill="white" font-size="32">✦</text>
  </svg>`,

  // #7 Fracciones de círculo — fila n = fila1 × n
  7: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <path d="M32,16 L32,36 A20,20 0 0,1 32,16" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>
    <path d="M32,16 L32,36 A20,20 0 0,1 12,16 Z" fill="white" opacity="0.85"/>
    <circle cx="32" cy="26" r="20" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <text x="32" y="60" text-anchor="middle" fill="white" font-size="11" opacity="0.9">1/4</text>

    <path d="M96,16 L96,36 A20,20 0 0,1 76,16 Z" fill="white" opacity="0.85"/>
    <path d="M96,16 L96,36 A20,20 0 0,0 116,16 Z" fill="white" opacity="0.85"/>
    <circle cx="96" cy="26" r="20" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <text x="96" y="60" text-anchor="middle" fill="white" font-size="11" opacity="0.9">1/2</text>

    <path d="M160,6 A20,20 0 1,1 140,26 L160,26 Z" fill="white" opacity="0.85"/>
    <circle cx="160" cy="26" r="20" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <text x="160" y="60" text-anchor="middle" fill="white" font-size="11" opacity="0.9">3/4</text>

    <path d="M32,80 L32,100 A20,20 0 0,1 12,80 Z" fill="white" opacity="0.85"/>
    <path d="M32,80 L32,100 A20,20 0 0,0 52,80 Z" fill="white" opacity="0.85"/>
    <circle cx="32" cy="90" r="20" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <text x="32" y="124" text-anchor="middle" fill="white" font-size="11" opacity="0.9">1/2</text>

    <circle cx="96" cy="90" r="20" fill="white" opacity="0.85"/>
    <text x="96" y="124" text-anchor="middle" fill="white" font-size="11" opacity="0.9">1</text>

    <circle cx="160" cy="90" r="20" fill="white" opacity="0.85"/>
    <circle cx="160" cy="90" r="10" fill="#6d28d9"/>
    <text x="160" y="124" text-anchor="middle" fill="white" font-size="11" opacity="0.9">3/2</text>

    <path d="M32,144 A20,20 0 1,1 12,164 L32,164 Z" fill="white" opacity="0.85"/>
    <circle cx="32" cy="154" r="20" fill="none" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <text x="32" y="186" text-anchor="middle" fill="white" font-size="11" opacity="0.9">3/4</text>

    <circle cx="96" cy="154" r="20" fill="white" opacity="0.85"/>
    <circle cx="96" cy="154" r="10" fill="#6d28d9"/>
    <text x="96" y="186" text-anchor="middle" fill="white" font-size="11" opacity="0.9">3/2</text>

    <rect x="148" y="142" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="159" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,

  // #8 Progresión geométrica ×3 por fila
  8: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <text x="32"  y="48"  text-anchor="middle" fill="white" font-size="24" font-weight="bold">2</text>
    <text x="96"  y="48"  text-anchor="middle" fill="white" font-size="24" font-weight="bold">6</text>
    <text x="160" y="48"  text-anchor="middle" fill="white" font-size="24" font-weight="bold">18</text>
    <text x="32"  y="112" text-anchor="middle" fill="white" font-size="24" font-weight="bold">3</text>
    <text x="96"  y="112" text-anchor="middle" fill="white" font-size="24" font-weight="bold">9</text>
    <text x="160" y="112" text-anchor="middle" fill="white" font-size="24" font-weight="bold">27</text>
    <text x="32"  y="176" text-anchor="middle" fill="white" font-size="24" font-weight="bold">4</text>
    <text x="96"  y="176" text-anchor="middle" fill="white" font-size="24" font-weight="bold">12</text>
    <rect x="148" y="155" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="172" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,

  // #9 Cuadros oscuros aumentan +1 por fila
  9: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <rect x="16"  y="16" width="32" height="32" fill="white" opacity="0.85" rx="4"/>
    <rect x="80"  y="16" width="32" height="32" fill="white" opacity="0.2"  rx="4" stroke="white" stroke-width="1.5"/>
    <rect x="144" y="16" width="32" height="32" fill="white" opacity="0.2"  rx="4" stroke="white" stroke-width="1.5"/>
    <rect x="16"  y="80" width="32" height="32" fill="white" opacity="0.85" rx="4"/>
    <rect x="80"  y="80" width="32" height="32" fill="white" opacity="0.85" rx="4"/>
    <rect x="144" y="80" width="32" height="32" fill="white" opacity="0.2"  rx="4" stroke="white" stroke-width="1.5"/>
    <rect x="148" y="148" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="165" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
    <text x="32"  y="166" text-anchor="middle" fill="white" font-size="11" opacity="0.6">fila 3</text>
  </svg>`,

  // #10 lados crecientes x col, tamaño decreciente x fila
  10: `<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <polygon points="32,56 10,56 21,34"              fill="white" opacity="0.85"/>
    <rect    x="82"  y="14" width="28" height="28"   fill="white" opacity="0.85"/>
    <polygon points="160,14 176,26 170,46 150,46 144,26" fill="white" opacity="0.85"/>
    <polygon points="32,112 16,112 24,96"             fill="white" opacity="0.85"/>
    <rect    x="86"  y="76" width="20" height="20"   fill="white" opacity="0.85"/>
    <polygon points="160,76 170,84 167,96 153,96 150,84" fill="white" opacity="0.85"/>
    <polygon points="32,168 22,168 27,158"            fill="white" opacity="0.85"/>
    <rect    x="90"  y="148" width="12" height="12"  fill="white" opacity="0.85"/>
    <rect x="148" y="148" width="24" height="24" rx="4" fill="white" opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="4"/>
    <text x="160" y="165" text-anchor="middle" fill="white" font-size="22" font-weight="bold">?</text>
  </svg>`,
};

@Component({
  selector: 'app-iq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './iq.html'
})
export class IqComponent implements OnDestroy {

  state = signal<QuizState>('intro');
  currentIndex = signal(0);
  selectedOption = signal<number | null>(null);
  answers = signal<IqAnswer[]>([]);
  result = signal<IqSubmitResponse | null>(null);

  private questionStartTime = 0;
  private quizStartTime = 0;

  questions = IQ_QUESTIONS;

  currentQuestion = computed<IqQuestion>(() => this.questions[this.currentIndex()]);

  progress = computed(() =>
    Math.round((this.currentIndex() / this.questions.length) * 100)
  );

  categoryLabel = computed(() => ({
    visual:  'Matrices Visuales',
    series:  'Series',
    verbal:  'Razonamiento Verbal'
  }[this.currentQuestion().category]));

  difficultyLabel = computed(() => ({
    easy:   'Fácil',
    medium: 'Medio',
    hard:   'Difícil'
  }[this.currentQuestion().difficulty]));

  constructor(
    private iqService: IqService,
    private focusService: FocusService,
    private router: Router,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnDestroy(): void {}

  getVisualSvg(): SafeHtml | null {
    const q = this.currentQuestion();
    if (q.category !== 'visual') return null;
    const svg = VISUAL_SVGS[q.id];
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }

  goBack(): void {
    if (this.state() === 'quiz') {
      this.state.set('intro');
      this.currentIndex.set(0);
      this.selectedOption.set(null);
      this.answers.set([]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  startQuiz(): void {
    this.quizStartTime = Date.now();
    this.questionStartTime = Date.now();
    this.state.set('quiz');
  }

  selectOption(index: number): void {
    if (this.selectedOption() !== null) return;
    this.selectedOption.set(index);
  }

  next(): void {
    const selected = this.selectedOption();
    if (selected === null) return;

    const q = this.currentQuestion();
    this.answers.update(prev => [...prev, {
      questionId: q.id,
      selectedIndex: selected,
      isCorrect: selected === q.correctIndex,
      timeSpentMs: Date.now() - this.questionStartTime
    }]);

    this.selectedOption.set(null);
    this.questionStartTime = Date.now();

    const next = this.currentIndex() + 1;
    if (next >= this.questions.length) {
      this.submit();
    } else {
      this.currentIndex.set(next);
    }
  }

  private submit(): void {
    this.state.set('submitting');
    this.iqService.submitResults({
      answers: this.answers(),
      totalTimeMs: Date.now() - this.quizStartTime,
      completedAt: new Date().toISOString()
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        // El backend ya ajusto las preferencias en BD; persistimos en local
        // para que el dashboard las lea sin esperar otro fetch.
        this.focusService.guardarPreferenciasLocal({
          mode: res.mode_recomendado,
          duration: res.duracion_recomendada,
        });
        this.state.set('done');
      },
      error: () => this.state.set('done')
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  getOptionClass(index: number): string {
    const selected = this.selectedOption();
    if (selected === null) return '';
    const correct = this.currentQuestion().correctIndex;
    if (index === correct) return 'correct';
    if (index === selected && selected !== correct) return 'incorrect';
    return 'dimmed';
  }

  isOptionDisabled(): boolean {
    return this.selectedOption() !== null;
  }
}