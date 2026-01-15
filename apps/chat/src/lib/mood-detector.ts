/**
 * Rilevamento passivo dell'umore dalle conversazioni
 * Approccio: keyword matching + pattern analysis (no LLM per costi)
 */

export type MoodLevel = 'molto_negativo' | 'negativo' | 'neutro' | 'positivo' | 'molto_positivo'

export interface MoodAnalysis {
  mood: MoodLevel
  intensity: number // 0.0 - 1.0
  keywords: string[]
  confidence: number // 0.0 - 1.0, quanto siamo sicuri
}

// Pattern per rilevamento umore (italiano)
const MOOD_PATTERNS: Record<MoodLevel, { words: string[], weight: number }[]> = {
  molto_positivo: [
    { words: ['felicissimo', 'fantastico', 'meraviglioso', 'stupendo', 'incredibile'], weight: 1.0 },
    { words: ['entusiasta', 'esaltato', 'euforico', 'al settimo cielo'], weight: 0.9 },
    { words: ['super', 'wow', 'grandioso', 'perfetto', 'eccezionale'], weight: 0.8 },
  ],
  positivo: [
    { words: ['felice', 'contento', 'soddisfatto', 'sereno', 'tranquillo'], weight: 1.0 },
    { words: ['bene', 'benissimo', 'ottimo', 'ok', 'va bene'], weight: 0.7 },
    { words: ['grazie', 'interessante', 'bello', 'carino', 'piacevole'], weight: 0.5 },
    { words: ['speranza', 'fiducia', 'ottimista', 'positivo'], weight: 0.8 },
  ],
  neutro: [
    { words: ['normale', 'solito', 'così così', 'insomma', 'mah'], weight: 1.0 },
    { words: ['non so', 'forse', 'vedremo', 'dipende'], weight: 0.6 },
  ],
  negativo: [
    { words: ['triste', 'giù', 'abbattuto', 'demotivato', 'sconfortato'], weight: 1.0 },
    { words: ['stanco', 'esausto', 'stressato', 'nervoso', 'irritato'], weight: 0.8 },
    { words: ['preoccupato', 'ansioso', 'agitato', 'teso'], weight: 0.9 },
    { words: ['male', 'non bene', 'difficile', 'dura', 'faticoso'], weight: 0.7 },
    { words: ['deluso', 'frustrato', 'scocciato', 'stufo'], weight: 0.8 },
  ],
  molto_negativo: [
    { words: ['disperato', 'devastato', 'distrutto', 'a pezzi'], weight: 1.0 },
    { words: ['depresso', 'angosciato', 'terrorizzato', 'panico'], weight: 0.9 },
    { words: ['odio', 'non ce la faccio', 'voglio morire', 'basta'], weight: 1.0 },
    { words: ['incubo', 'orribile', 'terribile', 'pessimo'], weight: 0.8 },
  ],
}

// Negazioni che invertono il senso
const NEGATIONS = ['non', 'niente', 'mai', 'neanche', 'nemmeno', 'mica']

// Intensificatori
const INTENSIFIERS = ['molto', 'tanto', 'troppo', 'davvero', 'veramente', 'proprio', 'così']

/**
 * Analizza il testo e rileva l'umore
 */
export function detectMood(text: string): MoodAnalysis | null {
  const lowerText = text.toLowerCase()
  const words = lowerText.split(/\s+/)
  
  // Se il messaggio è troppo corto, non analizzare
  if (words.length < 3) {
    return null
  }
  
  const scores: Record<MoodLevel, { score: number, keywords: string[] }> = {
    molto_positivo: { score: 0, keywords: [] },
    positivo: { score: 0, keywords: [] },
    neutro: { score: 0, keywords: [] },
    negativo: { score: 0, keywords: [] },
    molto_negativo: { score: 0, keywords: [] },
  }
  
  // Check per negazioni (potrebbero invertire il mood)
  const hasNegation = NEGATIONS.some(n => lowerText.includes(n))
  
  // Check per intensificatori
  const hasIntensifier = INTENSIFIERS.some(i => lowerText.includes(i))
  const intensityBoost = hasIntensifier ? 0.2 : 0
  
  // Analizza ogni categoria di mood
  for (const [mood, patterns] of Object.entries(MOOD_PATTERNS) as [MoodLevel, typeof MOOD_PATTERNS[MoodLevel]][]) {
    for (const pattern of patterns) {
      for (const word of pattern.words) {
        if (lowerText.includes(word)) {
          // Verifica se è negato
          const wordIndex = lowerText.indexOf(word)
          const contextBefore = lowerText.slice(Math.max(0, wordIndex - 15), wordIndex)
          const isNegated = NEGATIONS.some(n => contextBefore.includes(n))
          
          if (isNegated) {
            // Inverti il mood
            const invertedMood = invertMood(mood)
            scores[invertedMood].score += pattern.weight * 0.7 // Peso ridotto per negazione
            scores[invertedMood].keywords.push(`non ${word}`)
          } else {
            scores[mood].score += pattern.weight
            scores[mood].keywords.push(word)
          }
        }
      }
    }
  }
  
  // Trova il mood dominante
  let maxScore = 0
  let dominantMood: MoodLevel = 'neutro'
  let allKeywords: string[] = []
  
  for (const [mood, data] of Object.entries(scores) as [MoodLevel, typeof scores[MoodLevel]][]) {
    if (data.score > maxScore) {
      maxScore = data.score
      dominantMood = mood
      allKeywords = data.keywords
    }
  }
  
  // Se nessun pattern trovato, ritorna null
  if (maxScore === 0) {
    return null
  }
  
  // Calcola confidence basata su quanti pattern matchati
  const confidence = Math.min(maxScore / 2, 1.0)
  
  // Calcola intensity
  const baseIntensity = moodToIntensity(dominantMood)
  const intensity = Math.min(baseIntensity + intensityBoost, 1.0)
  
  return {
    mood: dominantMood,
    intensity,
    keywords: [...new Set(allKeywords)].slice(0, 5), // Max 5 keywords uniche
    confidence,
  }
}

/**
 * Inverte il mood (per gestire negazioni)
 */
function invertMood(mood: MoodLevel): MoodLevel {
  const inversions: Record<MoodLevel, MoodLevel> = {
    molto_positivo: 'negativo',
    positivo: 'negativo',
    neutro: 'neutro',
    negativo: 'positivo',
    molto_negativo: 'positivo',
  }
  return inversions[mood]
}

/**
 * Intensità base per ogni mood level
 */
function moodToIntensity(mood: MoodLevel): number {
  const intensities: Record<MoodLevel, number> = {
    molto_negativo: 0.9,
    negativo: 0.6,
    neutro: 0.3,
    positivo: 0.6,
    molto_positivo: 0.9,
  }
  return intensities[mood]
}

/**
 * Converte mood level in valore numerico per calcoli
 */
export function moodToNumber(mood: MoodLevel): number {
  const values: Record<MoodLevel, number> = {
    molto_negativo: -2,
    negativo: -1,
    neutro: 0,
    positivo: 1,
    molto_positivo: 2,
  }
  return values[mood]
}

/**
 * Descrizione testuale del mood per il prompt
 */
export function moodToDescription(mood: MoodLevel): string {
  const descriptions: Record<MoodLevel, string> = {
    molto_negativo: 'molto giù, in difficoltà',
    negativo: 'un po\' giù o stressato',
    neutro: 'tranquillo, nella norma',
    positivo: 'di buon umore',
    molto_positivo: 'molto positivo ed energico',
  }
  return descriptions[mood]
}
