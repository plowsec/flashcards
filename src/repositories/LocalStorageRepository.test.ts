import { LocalStorageRepository } from './LocalStorageRepository';
import { Deck, Card } from '../types';

describe('LocalStorageRepository', () => {
  let repository: LocalStorageRepository;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    repository = new LocalStorageRepository();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Deck Operations', () => {
    test('should create a new deck', async () => {
      const deckData = {
        name: 'Test Deck',
        description: 'A test deck',
        cards: [],
        folderIds: [],
      };

      const deck = await repository.createDeck(deckData);

      expect(deck.id).toBeDefined();
      expect(deck.name).toBe('Test Deck');
      expect(deck.description).toBe('A test deck');
      expect(deck.cards).toEqual([]);
      expect(deck.createdAt).toBeInstanceOf(Date);
      expect(deck.updatedAt).toBeInstanceOf(Date);
    });

    test('should get all decks', async () => {
      await repository.createDeck({ name: 'Deck 1', description: 'First', cards: [], folderIds: [] });
      await repository.createDeck({ name: 'Deck 2', description: 'Second', cards: [], folderIds: [] });

      const decks = await repository.getAllDecks();

      expect(decks).toHaveLength(2);
      expect(decks[0].name).toBe('Deck 1');
      expect(decks[1].name).toBe('Deck 2');
    });

    test('should get deck by id', async () => {
      const created = await repository.createDeck({ name: 'Test', description: 'Test', cards: [], folderIds: [] });
      const retrieved = await repository.getDeckById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test');
    });

    test('should return null for non-existent deck', async () => {
      const deck = await repository.getDeckById('non-existent-id');
      expect(deck).toBeNull();
    });

    test('should update a deck', async () => {
      const created = await repository.createDeck({ name: 'Original', description: 'Test', cards: [], folderIds: [] });
      
      // Small delay to ensure updatedAt is different
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await repository.updateDeck(created.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Test');
      expect(updated.id).toBe(created.id);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    test('should throw error when updating non-existent deck', async () => {
      await expect(
        repository.updateDeck('non-existent', { name: 'Test' })
      ).rejects.toThrow('Deck with id non-existent not found');
    });

    test('should delete a deck', async () => {
      const created = await repository.createDeck({ name: 'To Delete', description: 'Test', cards: [], folderIds: [] });
      
      await repository.deleteDeck(created.id);
      
      const decks = await repository.getAllDecks();
      expect(decks).toHaveLength(0);
    });
  });

  describe('Card Operations', () => {
    let testDeck: Deck;

    beforeEach(async () => {
      testDeck = await repository.createDeck({ name: 'Test Deck', description: 'Test', cards: [], folderIds: [] });
    });

    test('should create a new card', async () => {
      const cardData = {
        front: 'Question',
        back: 'Answer',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      const card = await repository.createCard(testDeck.id, cardData);

      expect(card.id).toBeDefined();
      expect(card.front).toBe('Question');
      expect(card.back).toBe('Answer');
      expect(card.createdAt).toBeInstanceOf(Date);
      expect(card.updatedAt).toBeInstanceOf(Date);
    });

    test('should get cards by deck id', async () => {
      const cardData = {
        front: 'Q1',
        back: 'A1',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      await repository.createCard(testDeck.id, cardData);
      await repository.createCard(testDeck.id, { ...cardData, front: 'Q2', back: 'A2' });

      const cards = await repository.getCardsByDeckId(testDeck.id);

      expect(cards).toHaveLength(2);
      expect(cards[0].front).toBe('Q1');
      expect(cards[1].front).toBe('Q2');
    });

    test('should get card by id', async () => {
      const cardData = {
        front: 'Question',
        back: 'Answer',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      const created = await repository.createCard(testDeck.id, cardData);
      const retrieved = await repository.getCardById(testDeck.id, created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.front).toBe('Question');
    });

    test('should update a card', async () => {
      const cardData = {
        front: 'Original',
        back: 'Answer',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      const created = await repository.createCard(testDeck.id, cardData);
      const updated = await repository.updateCard(testDeck.id, created.id, { 
        front: 'Updated',
        difficulty: 'easy' 
      });

      expect(updated.front).toBe('Updated');
      expect(updated.difficulty).toBe('easy');
      expect(updated.back).toBe('Answer');
    });

    test('should delete a card', async () => {
      const cardData = {
        front: 'To Delete',
        back: 'Answer',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      const created = await repository.createCard(testDeck.id, cardData);
      await repository.deleteCard(testDeck.id, created.id);

      const cards = await repository.getCardsByDeckId(testDeck.id);
      expect(cards).toHaveLength(0);
    });

    test('should throw error when creating card in non-existent deck', async () => {
      const cardData = {
        front: 'Question',
        back: 'Answer',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown' as const,
      };

      await expect(
        repository.createCard('non-existent', cardData)
      ).rejects.toThrow('Deck with id non-existent not found');
    });
  });

  describe('Bulk Import', () => {
    let testDeck: Deck;

    beforeEach(async () => {
      testDeck = await repository.createDeck({ name: 'Test Deck', description: 'Test', cards: [], folderIds: [] });
    });

    test('should bulk import cards', async () => {
      const bulkData = {
        deckName: 'Test Deck',
        cards: [
          { front: 'Q1', back: 'A1' },
          { front: 'Q2', back: 'A2' },
          { front: 'Q3', back: 'A3' },
        ],
      };

      await repository.bulkImportCards(testDeck.id, bulkData);

      const cards = await repository.getCardsByDeckId(testDeck.id);
      expect(cards).toHaveLength(3);
      expect(cards[0].front).toBe('Q1');
      expect(cards[1].front).toBe('Q2');
      expect(cards[2].front).toBe('Q3');
    });

    test('should set default values for bulk imported cards', async () => {
      const bulkData = {
        deckName: 'Test Deck',
        cards: [{ front: 'Q1', back: 'A1' }],
      };

      await repository.bulkImportCards(testDeck.id, bulkData);

      const cards = await repository.getCardsByDeckId(testDeck.id);
      expect(cards[0].easeFactor).toBe(2.5);
      expect(cards[0].interval).toBe(0);
      expect(cards[0].repetitions).toBe(0);
      expect(cards[0].difficulty).toBe('unknown');
    });
  });

  describe('Export/Import', () => {
    test('should export all data', async () => {
      await repository.createDeck({ name: 'Deck 1', description: 'First', cards: [], folderIds: [] });
      await repository.createDeck({ name: 'Deck 2', description: 'Second', cards: [], folderIds: [] });

      const exportData = await repository.exportAllData();

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportDate).toBeInstanceOf(Date);
      expect(exportData.decks).toHaveLength(2);
    });

    test('should import data', async () => {
      const deck1 = await repository.createDeck({ name: 'Existing', description: 'Test', cards: [], folderIds: [] });
      
      const importData = {
        version: '1.0.0',
        exportDate: new Date(),
        decks: [
          {
            id: 'new-deck-id',
            name: 'Imported Deck',
            description: 'Imported',
            cards: [],
            folderIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      await repository.importData(importData);

      const decks = await repository.getAllDecks();
      expect(decks).toHaveLength(2);
      expect(decks.some(d => d.name === 'Existing')).toBe(true);
      expect(decks.some(d => d.name === 'Imported Deck')).toBe(true);
    });

    test('should export a single deck', async () => {
      const created = await repository.createDeck({ name: 'Export Me', description: 'Test', cards: [], folderIds: [] });
      
      const exported = await repository.exportDeck(created.id);

      expect(exported.id).toBe(created.id);
      expect(exported.name).toBe('Export Me');
    });

    test('should import a single deck', async () => {
      const deckToImport: Deck = {
        id: 'imported-id',
        name: 'Imported',
        description: 'Test',
        cards: [],
        folderIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.importDeck(deckToImport);

      const deck = await repository.getDeckById('imported-id');
      expect(deck).not.toBeNull();
      expect(deck?.name).toBe('Imported');
    });
  });

  describe('Study Sessions', () => {
    test('should save study session', async () => {
      const session = {
        deckId: 'test-deck',
        startTime: new Date(),
        cardsStudied: 10,
        correctAnswers: 8,
      };

      await repository.saveStudySession(session);

      const sessions = await repository.getStudySessions('test-deck');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].cardsStudied).toBe(10);
      expect(sessions[0].correctAnswers).toBe(8);
    });

    test('should get study sessions for specific deck', async () => {
      await repository.saveStudySession({
        deckId: 'deck-1',
        startTime: new Date(),
        cardsStudied: 5,
        correctAnswers: 4,
      });

      await repository.saveStudySession({
        deckId: 'deck-2',
        startTime: new Date(),
        cardsStudied: 10,
        correctAnswers: 8,
      });

      const sessions = await repository.getStudySessions('deck-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].deckId).toBe('deck-1');
    });
  });

  describe('Utility Operations', () => {
    test('should clear all data', async () => {
      await repository.createDeck({ name: 'Test', description: 'Test', cards: [], folderIds: [] });
      await repository.saveStudySession({
        deckId: 'test',
        startTime: new Date(),
        cardsStudied: 5,
        correctAnswers: 4,
      });

      await repository.clearAllData();

      const decks = await repository.getAllDecks();
      const sessions = await repository.getStudySessions('test');
      
      expect(decks).toHaveLength(0);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Date Serialization', () => {
    test('should properly serialize and deserialize dates', async () => {
      const now = new Date();
      const deck = await repository.createDeck({
        name: 'Test',
        description: 'Test',
        cards: [],
        folderIds: []
      });

      // Retrieve the deck to ensure dates are properly deserialized
      const retrieved = await repository.getDeckById(deck.id);

      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.updatedAt).toBeInstanceOf(Date);
      expect(retrieved?.createdAt.getTime()).toBeCloseTo(now.getTime(), -2);
    });

    test('should properly handle card dates', async () => {
      const deck = await repository.createDeck({ name: 'Test', description: 'Test', cards: [], folderIds: [] });
      const nextReview = new Date(Date.now() + 86400000); // Tomorrow
      
      const card = await repository.createCard(deck.id, {
        front: 'Q',
        back: 'A',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: nextReview,
        difficulty: 'unknown',
      });

      const retrieved = await repository.getCardById(deck.id, card.id);

      expect(retrieved?.nextReviewDate).toBeInstanceOf(Date);
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.updatedAt).toBeInstanceOf(Date);
    });
  });
});