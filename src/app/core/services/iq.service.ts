import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IqQuestion {
  id: number;
  category: 'visual' | 'series' | 'verbal';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctIndex: number;
}

export interface IqAnswer {
  questionId: number;
  selectedIndex: number;
  isCorrect: boolean;
  timeSpentMs: number;
}

export interface IqSubmitPayload {
  answers: IqAnswer[];
  totalTimeMs: number;
  completedAt: string;
}

export interface IqSubmitResponse {
  score: number;
  total_questions: number;
  percentage: number;
  nivel_interpretacion: string;
  mode_recomendado: string;
  duracion_recomendada: number;
  total_time_ms: number;
  completado_en: string;
}

export const IQ_QUESTIONS: IqQuestion[] = [
  // Matrices visuales
  { id: 1,  category: 'visual',  difficulty: 'easy',   question: 'Las figuras en la cuadrícula aumentan de tamaño de izquierda a derecha y de arriba a abajo. ¿Qué figura completa la posición inferior-derecha?', options: ['Círculo pequeño', 'Círculo mediano', 'Círculo grande', 'Cuadrado grande'], correctIndex: 2 },
  { id: 2,  category: 'visual',  difficulty: 'easy',   question: 'En una cuadrícula 3×3, cada fila y columna contiene triángulo, cuadrado y círculo. La fila inferior ya tiene triángulo y círculo. ¿Qué falta?', options: ['Triángulo', 'Círculo', 'Cuadrado', 'Pentágono'], correctIndex: 2 },
  { id: 3,  category: 'visual',  difficulty: 'medium', question: 'La figura rota 45° en sentido horario al moverse una columna a la derecha. Fila 1: ↑ → ↓. Fila 2: ← ↑ →. ¿Qué flecha inicia la fila 3?', options: ['↑ Arriba', '↓ Abajo', '← Izquierda', '→ Derecha'], correctIndex: 1 },
  { id: 4,  category: 'visual',  difficulty: 'medium', question: 'Cuadrícula de puntos: fila 1 → 1,2,3; fila 2 → 2,4,6; fila 3 → 3,6,?', options: ['7', '8', '9', '12'], correctIndex: 2 },
  { id: 5,  category: 'visual',  difficulty: 'medium', question: 'Figuras con lados crecientes por columna (3,4,5) y relleno alterno por fila. Fila 3, col 3 tiene pentágono sólido. ¿Qué hay en fila 3, col 1?', options: ['Triángulo sólido', 'Triángulo vacío', 'Cuadrado sólido', 'Cuadrado vacío'], correctIndex: 0 },
  { id: 6,  category: 'visual',  difficulty: 'hard',   question: 'Matriz 3×3 con permutaciones de ★ ✦ ✧. Fila 1: ★ ✦ ✧. Fila 2: ✦ ✧ ★. ¿Qué símbolo va en la posición (3,1)?', options: ['★', '✦', '✧', 'Ninguno'], correctIndex: 2 },
  { id: 7,  category: 'visual',  difficulty: 'hard',   question: 'Celdas con fracciones de círculo. Fila 1: ¼, ½, ¾. Fila 2: ½, 1, 1½. Fila 3: ¾, 1½, ?', options: ['1¾', '2', '2¼', '3'], correctIndex: 2 },
  { id: 8,  category: 'visual',  difficulty: 'hard',   question: 'Cuadrícula numérica: fila 1 → 2,6,18; fila 2 → 3,9,27; fila 3 → 4,12,?', options: ['24', '36', '48', '16'], correctIndex: 1 },
  { id: 9,  category: 'visual',  difficulty: 'easy',   question: 'El número de cuadros oscuros aumenta en 1 por fila. Fila 1 tiene uno, fila 2 tiene dos. ¿Cuántos cuadros oscuros tiene la fila 3?', options: ['Uno', 'Dos', 'Cuatro', 'Tres'], correctIndex: 3 },
  { id: 10, category: 'visual',  difficulty: 'medium', question: 'Figuras con lados crecientes por columna (3,4,5) y tamaño decreciente por fila (grande, mediano, pequeño). ¿Qué va en fila 3, col 3?', options: ['Pentágono pequeño', 'Pentágono grande', 'Cuadrado pequeño', 'Hexágono pequeño'], correctIndex: 0 },
  // Series
  { id: 11, category: 'series',  difficulty: 'easy',   question: 'Completa la serie: 2, 4, 6, 8, __', options: ['9', '10', '11', '12'], correctIndex: 1 },
  { id: 12, category: 'series',  difficulty: 'easy',   question: 'Completa la serie: A, C, E, G, __', options: ['H', 'I', 'J', 'K'], correctIndex: 1 },
  { id: 13, category: 'series',  difficulty: 'easy',   question: 'Completa la serie: 1, 1, 2, 3, 5, 8, __', options: ['11', '12', '13', '14'], correctIndex: 2 },
  { id: 14, category: 'series',  difficulty: 'medium', question: 'Completa la serie: 3, 6, 12, 24, __', options: ['36', '42', '48', '56'], correctIndex: 2 },
  { id: 15, category: 'series',  difficulty: 'medium', question: 'Completa la serie: B2, D4, F6, H8, __', options: ['I9', 'J10', 'K10', 'L11'], correctIndex: 1 },
  { id: 16, category: 'series',  difficulty: 'medium', question: 'Completa la serie: 100, 91, 83, 76, 70, __', options: ['62', '64', '65', '66'], correctIndex: 2 },
  { id: 17, category: 'series',  difficulty: 'hard',   question: 'Completa la serie: 2, 5, 11, 23, 47, __', options: ['89', '94', '95', '96'], correctIndex: 2 },
  { id: 18, category: 'series',  difficulty: 'hard',   question: 'Completa la serie: 1, 8, 27, 64, __', options: ['100', '121', '125', '128'], correctIndex: 2 },
  { id: 19, category: 'series',  difficulty: 'hard',   question: 'Completa la serie: 1, 2, 6, 24, 120, __', options: ['240', '360', '720', '840'], correctIndex: 2 },
  { id: 20, category: 'series',  difficulty: 'medium', question: 'Completa la serie: 7, 14, 28, 56, __', options: ['98', '100', '112', '124'], correctIndex: 2 },
  // Razonamiento verbal
  { id: 21, category: 'verbal',  difficulty: 'easy',   question: 'Analogía: LIBRO es a BIBLIOTECA como CUADRO es a ___', options: ['Pintor', 'Galería', 'Marco', 'Paleta'], correctIndex: 1 },
  { id: 22, category: 'verbal',  difficulty: 'easy',   question: 'Analogía: CALOR es a FRÍO como DÍA es a ___', options: ['Mañana', 'Tarde', 'Noche', 'Luz'], correctIndex: 2 },
  { id: 23, category: 'verbal',  difficulty: 'easy',   question: 'Analogía: ZAPATO es a PIE como GUANTE es a ___', options: ['Dedo', 'Mano', 'Brazo', 'Tela'], correctIndex: 1 },
  { id: 24, category: 'verbal',  difficulty: 'medium', question: 'Analogía: MÉDICO es a ESTETOSCOPIO como FOTÓGRAFO es a ___', options: ['Foto', 'Estudio', 'Cámara', 'Flash'], correctIndex: 2 },
  { id: 25, category: 'verbal',  difficulty: 'medium', question: 'Analogía: SEMILLA es a ÁRBOL como HUEVO es a ___', options: ['Nido', 'Gallina', 'Cáscara', 'Pollito'], correctIndex: 3 },
  { id: 26, category: 'verbal',  difficulty: 'medium', question: '¿Qué palabra NO pertenece al grupo? SALMÓN · TRUCHA · DELFÍN · SARDINA · BACALAO', options: ['Salmón', 'Trucha', 'Delfín', 'Sardina'], correctIndex: 2 },
  { id: 27, category: 'verbal',  difficulty: 'hard',   question: 'Analogía: PRÓLOGO es a EPÍLOGO como AMANECER es a ___', options: ['Mediodía', 'Tarde', 'Atardecer', 'Medianoche'], correctIndex: 2 },
  { id: 28, category: 'verbal',  difficulty: 'hard',   question: 'Analogía: PARTITURA es a MÚSICO como PLANO es a ___', options: ['Arquitecto', 'Edificio', 'Ladrillo', 'Constructor'], correctIndex: 0 },
  { id: 29, category: 'verbal',  difficulty: 'hard',   question: '¿Qué par completa la analogía? CAOS : ORDEN :: ANARQUÍA : ___', options: ['Libertad', 'Gobierno', 'Desorden', 'Rebeldía'], correctIndex: 1 },
  { id: 30, category: 'verbal',  difficulty: 'medium', question: 'Analogía: BRÚJULA es a NAVEGANTE como MAPA es a ___', options: ['Ciudad', 'Viajero', 'Escala', 'Ruta'], correctIndex: 1 },
];

@Injectable({ providedIn: 'root' })
export class IqService {
  private BASE_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  submitResults(payload: IqSubmitPayload): Observable<IqSubmitResponse> {
    return this.http.post<IqSubmitResponse>(`${this.BASE_URL}/iq/resultados`, payload);
  }

  getLastResult(): Observable<IqSubmitResponse | null> {
    return this.http.get<IqSubmitResponse | null>(`${this.BASE_URL}/iq/resultados`);
  }
}
