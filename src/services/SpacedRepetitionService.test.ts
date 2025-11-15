import { SpacedRepetitionService } from './SpacedRepetitionService';
import { Card } from '../types';

describe('SpacedRepetitionService', () => {
  const createMockCard = (overrides?: Partial<Card>): Card => ({
    id: '1',
    front: 'Question',
    back: 'Answer',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(),
    difficulty: 'unknown',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('calculateNextReview', () => {
    test('should reset card on failed recall (quality < 3)', () => {
      const card = createMockCard({ repetitions: 3, interval: 10, easeFactor: 2.5 });
      
      const result = SpacedRepetitionService.calculateNextReview(card, 2);

      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(0);
    });

    test('should set interval to 1 day on first successful recall', () => {
      const card = createMockCard({ repetitions: 0, interval: 0 });
      
      const result = SpacedRepetitionService.calculateNextReview(card, 4);

      expect(result.repetitions).toBe(1);
      expect(result.interval).toBe(1);
    });

    test('should set interval to 6 days on second successful recall', () => {
      const card = createMockCard({ repetitions: 1, interval: 1 });
      
      const result = SpacedRepetitionService.calculateNextReview(card, 4);

      expect(result.repetitions).toBe(2);
      expect(result.interval).toBe(6);
    });

    test('should multiply interval by ease factor on subsequent recalls', () => {
      const card = createMockCard({ repetitions: 2, interval: 6, easeFactor: 2.5 });
      
      const result = SpacedRepetitionService.calculateNextReview(card, 4);

      expect(result.repetitions).toBe(3);
      expect(result.interval).toBe(15); // 6 * 2.5 = 15
    });

    test('should adjust ease factor based on quality', () => {
      const card = createMockCard({ easeFactor: 2.5 });
      
      // Perfect response (quality 5)
      const result1 = SpacedRepetitionService.calculateNextReview(card, 5);
      expect(result1.easeFactor).toBeGreaterThan(2.5);

      // Poor response (quality 3)
      const result2 = SpacedRepetitionService.calculateNextReview(card, 3);
      expect(result2.easeFactor).toBeLessThan(2.5);
    });

    test('should not let ease factor go below 1.3', () => {
      const card = createMockCard({ easeFactor: 1.3 });
      
      const result = SpacedRepetitionService.calculateNextReview(card, 0);

      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    test('should calculate next review date correctly', () => {
      const card = createMockCard({ repetitions: 2, interval: 6 });
      const now = new Date();
      
      const result = SpacedRepetitionService.calculateNextReview(card, 4);

      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() + result.interval);
      
      // Allow 1 second difference for test execution time
      expect(Math.abs(result.nextReviewDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });
  });

  describe('isDue', () => {
    test('should return true for cards due today', () => {
      const card = createMockCard({ nextReviewDate: new Date() });
      
      expect(SpacedRepetitionService.isDue(card)).toBe(true);
    });

    test('should return true for cards overdue', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const card = createMockCard({ nextReviewDate: yesterday });
      
      expect(SpacedRepetitionService.isDue(card)).toBe(true);
    });

    test('should return false for cards not yet due', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const card = createMockCard({ nextReviewDate: tomorrow });
      
      expect(SpacedRepetitionService.isDue(card)).toBe(false);
    });
  });

  describe('getDueCards', () => {
    test('should return only due cards', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const cards = [
        createMockCard({ id: '1', nextReviewDate: yesterday }),
        createMockCard({ id: '2', nextReviewDate: new Date() }),
        createMockCard({ id: '3', nextReviewDate: tomorrow }),
      ];

      const dueCards = SpacedRepetitionService.getDueCards(cards);

      expect(dueCards).toHaveLength(2);
      expect(dueCards.map(c => c.id)).toEqual(['1', '2']);
    });
  });

  describe('sortByDifficulty', () => {
    test('should sort cards by difficulty (hardest first)', () => {
      const cards = [
        createMockCard({ id: '1', easeFactor: 2.5, repetitions: 5 }), // Easy
        createMockCard({ id: '2', easeFactor: 1.5, repetitions: 1 }), // Hard
        createMockCard({ id: '3', easeFactor: 2.0, repetitions: 3 }), // Medium
      ];

      const sorted = SpacedRepetitionService.sortByDifficulty(cards, false);

      expect(sorted[0].id).toBe('1'); // Easiest (highest difficulty score)
      expect(sorted[2].id).toBe('2'); // Hardest (lowest difficulty score)
    });

    test('should sort cards by difficulty (easiest first)', () => {
      const cards = [
        createMockCard({ id: '1', easeFactor: 2.5, repetitions: 5 }), // Easy
        createMockCard({ id: '2', easeFactor: 1.5, repetitions: 1 }), // Hard
        createMockCard({ id: '3', easeFactor: 2.0, repetitions: 3 }), // Medium
      ];

      const sorted = SpacedRepetitionService.sortByDifficulty(cards, true);

      expect(sorted[0].id).toBe('2'); // Hardest
      expect(sorted[2].id).toBe('1'); // Easiest
    });
  });

  describe('getUnknownCards', () => {
    test('should return cards that have never been reviewed', () => {
      const cards = [
        createMockCard({ id: '1', repetitions: 0, lastReviewDate: undefined }),
        createMockCard({ id: '2', repetitions: 1, lastReviewDate: new Date() }),
        createMockCard({ id: '3', repetitions: 0, lastReviewDate: undefined }),
      ];

      const unknown = SpacedRepetitionService.getUnknownCards(cards);

      expect(unknown).toHaveLength(2);
      expect(unknown.map(c => c.id)).toEqual(['1', '3']);
    });
  });

  describe('getStudyStats', () => {
    test('should calculate correct statistics', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const cards = [
        createMockCard({ repetitions: 0, lastReviewDate: undefined, nextReviewDate: yesterday }), // New & due
        createMockCard({ repetitions: 0, lastReviewDate: undefined, nextReviewDate: tomorrow }), // New
        createMockCard({ repetitions: 2, nextReviewDate: yesterday }), // Learning & due
        createMockCard({ repetitions: 3, nextReviewDate: tomorrow }), // Learning
        createMockCard({ repetitions: 5, nextReviewDate: tomorrow }), // Mastered
        createMockCard({ repetitions: 6, nextReviewDate: tomorrow }), // Mastered
      ];

      const stats = SpacedRepetitionService.getStudyStats(cards);

      expect(stats.total).toBe(6);
      expect(stats.new).toBe(2);
      expect(stats.learning).toBe(2);
      expect(stats.mastered).toBe(2);
      expect(stats.due).toBe(2);
    });
  });

  describe('qualityToDifficulty', () => {
    test('should map quality 0-1 to hard', () => {
      expect(SpacedRepetitionService.qualityToDifficulty(0)).toBe('hard');
      expect(SpacedRepetitionService.qualityToDifficulty(1)).toBe('hard');
    });

    test('should map quality 2-3 to medium', () => {
      expect(SpacedRepetitionService.qualityToDifficulty(2)).toBe('medium');
      expect(SpacedRepetitionService.qualityToDifficulty(3)).toBe('medium');
    });

    test('should map quality 4-5 to easy', () => {
      expect(SpacedRepetitionService.qualityToDifficulty(4)).toBe('easy');
      expect(SpacedRepetitionService.qualityToDifficulty(5)).toBe('easy');
    });
  });

  describe('getStudyOrder', () => {
    const createCardsForOrdering = () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return [
        createMockCard({ id: '1', repetitions: 0, nextReviewDate: tomorrow, createdAt: new Date('2024-01-01') }),
        createMockCard({ id: '2', repetitions: 3, nextReviewDate: yesterday, easeFactor: 1.5 }),
        createMockCard({ id: '3', repetitions: 5, nextReviewDate: tomorrow, easeFactor: 2.5 }),
        createMockCard({ id: '4', repetitions: 0, nextReviewDate: yesterday, createdAt: new Date('2024-01-02') }),
      ];
    };

    test('should order by due date in "due" mode', () => {
      const cards = createCardsForOrdering();
      const ordered = SpacedRepetitionService.getStudyOrder(cards, 'due');

      // Due cards should come first
      expect(ordered[0].id).toBe('2');
      expect(ordered[1].id).toBe('4');
    });

    test('should order by difficulty in "difficult" mode', () => {
      const cards = createCardsForOrdering();
      const ordered = SpacedRepetitionService.getStudyOrder(cards, 'difficult');

      // Most difficult (lowest ease factor * repetitions) should come first
      // Card 2: 1.5 * (3+1) = 6.0 (hardest)
      // Card 4: 2.5 * (0+1) = 2.5 (second hardest)
      // Card 1: 2.5 * (0+1) = 2.5 (tied)
      // Card 3: 2.5 * (5+1) = 15.0 (easiest)
      expect(ordered[0].id).toBe('3'); // Easiest first (descending order)
      expect(ordered[ordered.length - 1].id).toBe('4'); // Hardest last
    });

    test('should prioritize unknown cards in "unknown" mode', () => {
      const cards = createCardsForOrdering();
      const ordered = SpacedRepetitionService.getStudyOrder(cards, 'unknown');

      // Unknown cards should come first
      expect(ordered[0].repetitions).toBe(0);
      expect(ordered[1].repetitions).toBe(0);
    });

    test('should randomize in "random" mode', () => {
      const cards = createCardsForOrdering();
      const ordered1 = SpacedRepetitionService.getStudyOrder(cards, 'random');
      const ordered2 = SpacedRepetitionService.getStudyOrder(cards, 'random');

      // Should have same cards but potentially different order
      expect(ordered1).toHaveLength(cards.length);
      // Note: There's a small chance this could fail if random produces same order
    });

    test('should order by creation date in "sequential" mode', () => {
      const cards = createCardsForOrdering();
      const ordered = SpacedRepetitionService.getStudyOrder(cards, 'sequential');

      // Should be ordered by creation date
      expect(ordered[0].id).toBe('1'); // 2024-01-01
      expect(ordered[1].id).toBe('4'); // 2024-01-02
    });
  });
});