// Core data types for the flashcards application

export type AnswerValidation =
  | 'exact' // Exact match required
  | 'case-insensitive' // Case doesn't matter
  | 'typo-tolerant' // Accept minor typos (Levenshtein distance)
  | 'keyword' // One key word must be present
  | 'flexible'; // Any reasonable answer

export interface Card {
  id: string;
  front: string; // Supports markdown
  back: string; // Supports markdown
  frontImage?: string; // Base64 or URL
  backImage?: string; // Base64 or URL
  easeFactor: number; // For SM-2 algorithm
  interval: number; // Days until next review
  repetitions: number; // Number of successful repetitions
  nextReviewDate: Date;
  lastReviewDate?: Date;
  difficulty: 'unknown' | 'hard' | 'medium' | 'easy';
  answerValidation?: AnswerValidation; // How strict answer checking should be
  aiGeneratedOptions?: string[]; // AI-generated confusing wrong answers for multiple choice
  savedExplanation?: string; // Saved AI explanation
  savedFollowUps?: Array<{ question: string; answer: string }>; // Saved follow-up Q&A
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId: string | null; // null for root folders
  createdAt: Date;
  updatedAt: Date;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  cards: Card[];
  folderIds: string[]; // Decks can belong to multiple folders
  createdAt: Date;
  updatedAt: Date;
}

export interface StudySession {
  deckId: string;
  startTime: Date;
  endTime?: Date;
  cardsStudied: number;
  correctAnswers: number;
}

export type StudyMode =
  | 'due' // Cards due for review
  | 'difficult' // Difficult cards first
  | 'unknown' // Unknown cards first
  | 'random' // Random order
  | 'sequential'; // Sequential order

export type StudyInteractionType =
  | 'learn' // Adaptive: starts with multiple choice, progresses to written
  | 'flashcards' // Classic flip cards
  | 'test' // Written answers only
  | 'match' // Matching game
  | 'ai-quiz'; // AI-powered multiple choice with confusing options

export type QuestionType =
  | 'multiple-choice' // Show 4 options
  | 'written' // Type the answer
  | 'flashcard'; // Show/hide answer

export type SortOption = 
  | 'createdAt-asc'
  | 'createdAt-desc'
  | 'difficulty-asc'
  | 'difficulty-desc'
  | 'nextReview-asc'
  | 'nextReview-desc';

export interface ReviewResult {
  quality: 0 | 1 | 2 | 3 | 4 | 5; // SM-2 quality rating
  // 0: Complete blackout
  // 1: Incorrect response; correct one remembered
  // 2: Incorrect response; correct one seemed easy to recall
  // 3: Correct response recalled with serious difficulty
  // 4: Correct response after hesitation
  // 5: Perfect response
}

export interface BulkImportData {
  deckName: string;
  cards: Array<{
    front: string;
    back: string;
    frontImage?: string;
    backImage?: string;
  }>;
}

export interface ExportData {
  version: string;
  exportDate: Date;
  decks: Deck[];
  folders?: Folder[]; // Optional for backward compatibility
}

// AI Course Builder Types

// Subject types that support AI course generation
export type SubjectType =
  | 'medicine'
  | 'science'
  | 'mathematics'
  | 'history'
  | 'general'; // For custom subjects

// Deck template defines how cards should be structured
export interface DeckTemplate {
  id: string;
  name: string;
  subjectType: SubjectType;
  frontLabel: string;      // e.g., "Question", "Term", "Concept"
  backLabel: string;       // e.g., "Answer", "Definition", "Explanation"
  includeImages: boolean;
  includeExamples: boolean;
  createdAt: Date;
}

// Course outline node represents a topic in the hierarchy
export interface CourseOutlineNode {
  id: string;
  title: string;
  description: string;
  level: number;           // 0 = root, 1 = chapter, 2 = section, etc.
  parentId: string | null;
  children: CourseOutlineNode[];
  estimatedCardCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

// Complete course outline
export interface CourseOutline {
  id: string;
  subject: string;
  subjectType: SubjectType;
  templateId: string;
  rootNodes: CourseOutlineNode[];
  createdAt: Date;
  status: 'draft' | 'approved' | 'generating' | 'completed';
}

// Generated flashcard (before user approval)
export interface GeneratedCard {
  id: string;
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
  explanation?: string;    // Why this card is important
  difficulty: 'easy' | 'medium' | 'hard';
  selected: boolean;       // User selection for import
  nodeId: string;          // Which outline node it belongs to
}

// Batch of generated cards for a topic
export interface CardGenerationBatch {
  id: string;
  outlineNodeId: string;
  cards: GeneratedCard[];
  status: 'generating' | 'ready' | 'imported';
  createdAt: Date;
}

// Gap analysis result for existing decks
export interface GapAnalysis {
  deckId: string;
  missingTopics: string[];
  weakAreas: string[];      // Topics with few cards
  suggestedCards: GeneratedCard[];
  analysisDate: Date;
}