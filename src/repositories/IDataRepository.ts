// Data repository interface - abstraction layer for data persistence
// This allows easy migration to a backend in the future

import { Deck, Card, StudySession, BulkImportData, ExportData, Folder } from '../types';

export interface IDataRepository {
  // Deck operations
  getAllDecks(): Promise<Deck[]>;
  getDeckById(id: string): Promise<Deck | null>;
  createDeck(deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deck>;
  updateDeck(id: string, deck: Partial<Deck>): Promise<Deck>;
  deleteDeck(id: string): Promise<void>;

  // Folder operations
  getAllFolders(): Promise<Folder[]>;
  getFolderById(id: string): Promise<Folder | null>;
  createFolder(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder>;
  updateFolder(id: string, folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
  getFoldersByParentId(parentId: string | null): Promise<Folder[]>;
  getDecksByFolderId(folderId: string): Promise<Deck[]>;

  // Card operations
  getCardsByDeckId(deckId: string): Promise<Card[]>;
  getCardById(deckId: string, cardId: string): Promise<Card | null>;
  createCard(deckId: string, card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card>;
  updateCard(deckId: string, cardId: string, card: Partial<Card>): Promise<Card>;
  deleteCard(deckId: string, cardId: string): Promise<void>;

  // Study session operations
  saveStudySession(session: StudySession): Promise<void>;
  getStudySessions(deckId: string): Promise<StudySession[]>;

  // Bulk operations
  bulkImportCards(deckId: string, data: BulkImportData): Promise<void>;
  
  // Export/Import operations
  exportAllData(): Promise<ExportData>;
  importData(data: ExportData): Promise<void>;
  exportDeck(deckId: string): Promise<Deck>;
  importDeck(deck: Deck): Promise<void>;

  // Utility operations
  clearAllData(): Promise<void>;
}