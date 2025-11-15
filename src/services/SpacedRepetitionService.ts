// SM-2 Spaced Repetition Algorithm Implementation
// Based on SuperMemo 2 algorithm by Piotr Wozniak

import { Card, ReviewResult } from '../types';

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

export class SpacedRepetitionService {
  /**
   * Calculate the next review parameters based on SM-2 algorithm
   * @param card - The card being reviewed
   * @param quality - Quality of recall (0-5)
   * @returns Updated SM-2 parameters
   */
  static calculateNextReview(card: Card, quality: ReviewResult['quality']): SM2Result {
    let { easeFactor, interval, repetitions } = card;

    // If quality < 3, reset the card (failed recall)
    if (quality < 3) {
      repetitions = 0;
      interval = 0;
    } else {
      // Successful recall
      if (repetitions === 0) {
        interval = 1; // First successful recall: review in 1 day
      } else if (repetitions === 1) {
        interval = 6; // Second successful recall: review in 6 days
      } else {
        // Subsequent reviews: multiply previous interval by ease factor
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    }

    // Update ease factor based on quality
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Ensure ease factor doesn't go below 1.3
    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
      easeFactor,
      interval,
      repetitions,
      nextReviewDate,
    };
  }

  /**
   * Determine if a card is due for review
   * @param card - The card to check
   * @returns true if the card is due for review
   */
  static isDue(card: Card): boolean {
    const now = new Date();
    return card.nextReviewDate <= now;
  }

  /**
   * Get all cards that are due for review
   * @param cards - Array of cards to filter
   * @returns Array of cards due for review
   */
  static getDueCards(cards: Card[]): Card[] {
    return cards.filter(card => this.isDue(card));
  }

  /**
   * Sort cards by difficulty (based on ease factor and repetitions)
   * @param cards - Array of cards to sort
   * @param ascending - Sort order (true for easiest first, false for hardest first)
   * @returns Sorted array of cards
   */
  static sortByDifficulty(cards: Card[], ascending: boolean = false): Card[] {
    return [...cards].sort((a, b) => {
      // Lower ease factor and fewer repetitions = more difficult
      const difficultyA = a.easeFactor * (a.repetitions + 1);
      const difficultyB = b.easeFactor * (b.repetitions + 1);
      
      return ascending ? difficultyA - difficultyB : difficultyB - difficultyA;
    });
  }

  /**
   * Get cards that have never been reviewed
   * @param cards - Array of cards to filter
   * @returns Array of unknown cards
   */
  static getUnknownCards(cards: Card[]): Card[] {
    return cards.filter(card => card.repetitions === 0 && !card.lastReviewDate);
  }

  /**
   * Calculate study statistics
   * @param cards - Array of cards
   * @returns Statistics object
   */
  static getStudyStats(cards: Card[]): {
    total: number;
    due: number;
    new: number;
    learning: number;
    mastered: number;
  } {
    const now = new Date();
    
    return {
      total: cards.length,
      due: cards.filter(card => card.nextReviewDate <= now).length,
      new: cards.filter(card => card.repetitions === 0 && !card.lastReviewDate).length,
      learning: cards.filter(card => card.repetitions > 0 && card.repetitions < 5).length,
      mastered: cards.filter(card => card.repetitions >= 5).length,
    };
  }

  /**
   * Map quality rating to difficulty level
   * @param quality - Quality rating (0-5)
   * @returns Difficulty level
   */
  static qualityToDifficulty(quality: ReviewResult['quality']): Card['difficulty'] {
    if (quality === 0 || quality === 1) return 'hard';
    if (quality === 2 || quality === 3) return 'medium';
    return 'easy';
  }

  /**
   * Get recommended study order based on mode
   * @param cards - Array of cards
   * @param mode - Study mode
   * @returns Sorted array of cards
   */
  static getStudyOrder(
    cards: Card[],
    mode: 'due' | 'difficult' | 'unknown' | 'random' | 'sequential'
  ): Card[] {
    switch (mode) {
      case 'due':
        // Due cards first, then by next review date
        return [...cards].sort((a, b) => {
          const aDue = this.isDue(a);
          const bDue = this.isDue(b);
          if (aDue && !bDue) return -1;
          if (!aDue && bDue) return 1;
          return a.nextReviewDate.getTime() - b.nextReviewDate.getTime();
        });

      case 'difficult':
        // Most difficult cards first
        return this.sortByDifficulty(cards, false);

      case 'unknown':
        // Unknown cards first, then by creation date
        const unknown = this.getUnknownCards(cards);
        const known = cards.filter(card => card.repetitions > 0 || card.lastReviewDate);
        return [
          ...unknown.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
          ...known,
        ];

      case 'random':
        // Shuffle cards randomly
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;

      case 'sequential':
        // Original order (by creation date)
        return [...cards].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      default:
        return cards;
    }
  }
}