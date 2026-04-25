export interface QuizFrequencyPoint {
  /** ISO week string "YYYY-Www" or month string "YYYY-MM" */
  period: string;
  count: number;
}

export interface MasteryPoint {
  /** Month string "YYYY-MM" */
  period: string;
  /** Percentage of entries with canEToU === true */
  canEToUPct: number;
  /** Percentage of entries with canUToE === true */
  canUToEPct: number;
  /** Raw counts for tooltip granularity */
  canEToUCount: number;
  canUToECount: number;
  totalEntries: number;
}

export interface WordsOverTimePoint {
  /** Month string "YYYY-MM" */
  period: string;
  added: number;
  cumulative: number;
}

export interface PartOfSpeechPoint {
  partOfSpeech: string;
  count: number;
}

export interface QuizResultsPoint {
  /** Day string "YYYY-MM-DD" */
  period: string;
  knownCount: number;
  reviewCount: number;
  knownPct: number;
  reviewPct: number;
  total: number;
}

export interface ProblematicWord {
  wordId: string;
  word: string;
  translation?: string;
  reviewCount: number;
  totalAppearances: number;
  reviewRate: number;
}
