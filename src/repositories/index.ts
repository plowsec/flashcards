// Repository factory and exports

import { IDataRepository } from './IDataRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

// Factory function to get the appropriate repository
// This makes it easy to switch to a different implementation (e.g., API-based) in the future
export function getDataRepository(): IDataRepository {
  // For now, always return LocalStorageRepository
  // In the future, this could check environment variables or configuration
  // to return different implementations (e.g., ApiRepository)
  return new LocalStorageRepository();
}

// Export types and interfaces
export type { IDataRepository };
export { LocalStorageRepository };