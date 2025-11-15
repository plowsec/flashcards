// LocalStorage implementation of the data repository
// Client-side only storage using browser's localStorage

import { v4 as uuidv4 } from 'uuid';
import { Deck, Card, StudySession, BulkImportData, ExportData, Folder } from '../types';
import { IDataRepository } from './IDataRepository';

const STORAGE_KEYS = {
  DECKS: 'flashcards_decks',
  FOLDERS: 'flashcards_folders',
  STUDY_SESSIONS: 'flashcards_study_sessions',
};

export class LocalStorageRepository implements IDataRepository {
  private getDecksFromStorage(): Deck[] {
    const data = localStorage.getItem(STORAGE_KEYS.DECKS);
    if (!data) return [];
    
    const decks = JSON.parse(data);
    // Convert date strings back to Date objects and ensure folderIds exists
    return decks.map((deck: any) => ({
      ...deck,
      folderIds: deck.folderIds || [], // Ensure folderIds exists for backward compatibility
      createdAt: new Date(deck.createdAt),
      updatedAt: new Date(deck.updatedAt),
      cards: deck.cards.map((card: any) => ({
        ...card,
        nextReviewDate: new Date(card.nextReviewDate),
        lastReviewDate: card.lastReviewDate ? new Date(card.lastReviewDate) : undefined,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
      })),
    }));
  }

  private saveDecksToStorage(decks: Deck[]): void {
    localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
  }

  private getStudySessionsFromStorage(): StudySession[] {
    const data = localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
    if (!data) return [];
    
    const sessions = JSON.parse(data);
    return sessions.map((session: any) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
    }));
  }

  private saveStudySessionsToStorage(sessions: StudySession[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(sessions));
  }

  // Deck operations
  async getAllDecks(): Promise<Deck[]> {
    return this.getDecksFromStorage();
  }

  async getDeckById(id: string): Promise<Deck | null> {
    const decks = this.getDecksFromStorage();
    return decks.find(deck => deck.id === id) || null;
  }

  async createDeck(deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deck> {
    const decks = this.getDecksFromStorage();
    const now = new Date();
    const newDeck: Deck = {
      ...deck,
      folderIds: deck.folderIds || [], // Ensure folderIds is always an array
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    decks.push(newDeck);
    this.saveDecksToStorage(decks);
    return newDeck;
  }

  async updateDeck(id: string, updates: Partial<Deck>): Promise<Deck> {
    const decks = this.getDecksFromStorage();
    const index = decks.findIndex(deck => deck.id === id);
    
    if (index === -1) {
      throw new Error(`Deck with id ${id} not found`);
    }

    const updatedDeck: Deck = {
      ...decks[index],
      ...updates,
      id: decks[index].id, // Ensure id doesn't change
      createdAt: decks[index].createdAt, // Ensure createdAt doesn't change
      updatedAt: new Date(),
    };

    decks[index] = updatedDeck;
    this.saveDecksToStorage(decks);
    return updatedDeck;
  }

  async deleteDeck(id: string): Promise<void> {
    const decks = this.getDecksFromStorage();
    const filteredDecks = decks.filter(deck => deck.id !== id);
    this.saveDecksToStorage(filteredDecks);
  }

  // Folder operations
  private getFoldersFromStorage(): Folder[] {
    const data = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (!data) return [];
    
    const folders = JSON.parse(data);
    return folders.map((folder: any) => ({
      ...folder,
      createdAt: new Date(folder.createdAt),
      updatedAt: new Date(folder.updatedAt),
    }));
  }

  private saveFoldersToStorage(folders: Folder[]): void {
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
  }

  async getAllFolders(): Promise<Folder[]> {
    return this.getFoldersFromStorage();
  }

  async getFolderById(id: string): Promise<Folder | null> {
    const folders = this.getFoldersFromStorage();
    return folders.find(folder => folder.id === id) || null;
  }

  async createFolder(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const folders = this.getFoldersFromStorage();
    const now = new Date();
    const newFolder: Folder = {
      ...folder,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    folders.push(newFolder);
    this.saveFoldersToStorage(folders);
    return newFolder;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const folders = this.getFoldersFromStorage();
    const index = folders.findIndex(folder => folder.id === id);
    
    if (index === -1) {
      throw new Error(`Folder with id ${id} not found`);
    }

    const updatedFolder: Folder = {
      ...folders[index],
      ...updates,
      id: folders[index].id,
      createdAt: folders[index].createdAt,
      updatedAt: new Date(),
    };

    folders[index] = updatedFolder;
    this.saveFoldersToStorage(folders);
    return updatedFolder;
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = this.getFoldersFromStorage();
    const decks = this.getDecksFromStorage();
    
    // Remove folder from all decks
    const updatedDecks = decks.map(deck => ({
      ...deck,
      folderIds: deck.folderIds.filter(folderId => folderId !== id),
    }));
    
    // Delete the folder and all its subfolders recursively
    const foldersToDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder.parentId && foldersToDelete.has(folder.parentId) && !foldersToDelete.has(folder.id)) {
          foldersToDelete.add(folder.id);
          changed = true;
        }
      }
    }
    
    const filteredFolders = folders.filter(folder => !foldersToDelete.has(folder.id));
    
    this.saveFoldersToStorage(filteredFolders);
    this.saveDecksToStorage(updatedDecks);
  }

  async getFoldersByParentId(parentId: string | null): Promise<Folder[]> {
    const folders = this.getFoldersFromStorage();
    return folders.filter(folder => folder.parentId === parentId);
  }

  async getDecksByFolderId(folderId: string): Promise<Deck[]> {
    const decks = this.getDecksFromStorage();
    return decks.filter(deck => deck.folderIds.includes(folderId));
  }

  // Card operations
  async getCardsByDeckId(deckId: string): Promise<Card[]> {
    const deck = await this.getDeckById(deckId);
    return deck?.cards || [];
  }

  async getCardById(deckId: string, cardId: string): Promise<Card | null> {
    const deck = await this.getDeckById(deckId);
    if (!deck) return null;
    return deck.cards.find(card => card.id === cardId) || null;
  }

  async createCard(deckId: string, card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card> {
    const decks = this.getDecksFromStorage();
    const deckIndex = decks.findIndex(deck => deck.id === deckId);
    
    if (deckIndex === -1) {
      throw new Error(`Deck with id ${deckId} not found`);
    }

    const now = new Date();
    const newCard: Card = {
      ...card,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    decks[deckIndex].cards.push(newCard);
    decks[deckIndex].updatedAt = now;
    this.saveDecksToStorage(decks);
    return newCard;
  }

  async updateCard(deckId: string, cardId: string, updates: Partial<Card>): Promise<Card> {
    const decks = this.getDecksFromStorage();
    const deckIndex = decks.findIndex(deck => deck.id === deckId);
    
    if (deckIndex === -1) {
      throw new Error(`Deck with id ${deckId} not found`);
    }

    const cardIndex = decks[deckIndex].cards.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) {
      throw new Error(`Card with id ${cardId} not found in deck ${deckId}`);
    }

    const now = new Date();
    const updatedCard: Card = {
      ...decks[deckIndex].cards[cardIndex],
      ...updates,
      id: decks[deckIndex].cards[cardIndex].id, // Ensure id doesn't change
      createdAt: decks[deckIndex].cards[cardIndex].createdAt, // Ensure createdAt doesn't change
      updatedAt: now,
    };

    decks[deckIndex].cards[cardIndex] = updatedCard;
    decks[deckIndex].updatedAt = now;
    this.saveDecksToStorage(decks);
    return updatedCard;
  }

  async deleteCard(deckId: string, cardId: string): Promise<void> {
    const decks = this.getDecksFromStorage();
    const deckIndex = decks.findIndex(deck => deck.id === deckId);
    
    if (deckIndex === -1) {
      throw new Error(`Deck with id ${deckId} not found`);
    }

    decks[deckIndex].cards = decks[deckIndex].cards.filter(card => card.id !== cardId);
    decks[deckIndex].updatedAt = new Date();
    this.saveDecksToStorage(decks);
  }

  // Study session operations
  async saveStudySession(session: StudySession): Promise<void> {
    const sessions = this.getStudySessionsFromStorage();
    sessions.push(session);
    this.saveStudySessionsToStorage(sessions);
  }

  async getStudySessions(deckId: string): Promise<StudySession[]> {
    const sessions = this.getStudySessionsFromStorage();
    return sessions.filter(session => session.deckId === deckId);
  }

  // Bulk operations
  async bulkImportCards(deckId: string, data: BulkImportData): Promise<void> {
    const decks = this.getDecksFromStorage();
    const deckIndex = decks.findIndex(deck => deck.id === deckId);
    
    if (deckIndex === -1) {
      throw new Error(`Deck with id ${deckId} not found`);
    }

    const now = new Date();
    const newCards: Card[] = data.cards.map(cardData => ({
      id: uuidv4(),
      front: cardData.front,
      back: cardData.back,
      frontImage: cardData.frontImage,
      backImage: cardData.backImage,
      easeFactor: 2.5, // Default SM-2 ease factor
      interval: 0,
      repetitions: 0,
      nextReviewDate: now,
      difficulty: 'unknown' as const,
      createdAt: now,
      updatedAt: now,
    }));

    decks[deckIndex].cards.push(...newCards);
    decks[deckIndex].updatedAt = now;
    this.saveDecksToStorage(decks);
  }

  // Export/Import operations
  async exportAllData(): Promise<ExportData> {
    const decks = this.getDecksFromStorage();
    const folders = this.getFoldersFromStorage();
    return {
      version: '1.0.0',
      exportDate: new Date(),
      decks,
      folders,
    };
  }

  async importData(data: ExportData): Promise<void> {
    // Merge imported decks with existing ones
    const existingDecks = this.getDecksFromStorage();
    const importedDeckIds = new Set(data.decks.map(d => d.id));
    
    // Keep existing decks that aren't in the import
    const decksToKeep = existingDecks.filter(d => !importedDeckIds.has(d.id));
    
    // Combine with imported decks
    const allDecks = [...decksToKeep, ...data.decks];
    this.saveDecksToStorage(allDecks);
    
    // Import folders if present (for backward compatibility, folders might not exist)
    if (data.folders) {
      const existingFolders = this.getFoldersFromStorage();
      const importedFolderIds = new Set(data.folders.map(f => f.id));
      
      // Keep existing folders that aren't in the import
      const foldersToKeep = existingFolders.filter(f => !importedFolderIds.has(f.id));
      
      // Combine with imported folders
      const allFolders = [...foldersToKeep, ...data.folders];
      this.saveFoldersToStorage(allFolders);
    }
  }

  async exportDeck(deckId: string): Promise<Deck> {
    const deck = await this.getDeckById(deckId);
    if (!deck) {
      throw new Error(`Deck with id ${deckId} not found`);
    }
    return deck;
  }

  async importDeck(deck: Deck): Promise<void> {
    const decks = this.getDecksFromStorage();
    
    // Check if deck with same id exists
    const existingIndex = decks.findIndex(d => d.id === deck.id);
    
    if (existingIndex !== -1) {
      // Replace existing deck
      decks[existingIndex] = deck;
    } else {
      // Add new deck
      decks.push(deck);
    }
    
    this.saveDecksToStorage(decks);
  }

  // Utility operations
  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.DECKS);
    localStorage.removeItem(STORAGE_KEYS.FOLDERS);
    localStorage.removeItem(STORAGE_KEYS.STUDY_SESSIONS);
  }
}