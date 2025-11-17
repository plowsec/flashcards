// Template service for managing deck templates
// Provides default templates and template management

import { DeckTemplate, SubjectType } from '../types';
import { getDataRepository } from '../repositories';

export class TemplateService {
  private static instance: TemplateService;
  private repository = getDataRepository();

  private constructor() {}

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  /**
   * Get default templates for each subject type
   */
  getDefaultTemplates(): Omit<DeckTemplate, 'id' | 'createdAt'>[] {
    return [
      {
        name: 'Question & Answer',
        subjectType: 'general',
        frontLabel: 'Question',
        backLabel: 'Answer',
        includeImages: false,
        includeExamples: true,
      },
      {
        name: 'Concept & Explanation',
        subjectType: 'science',
        frontLabel: 'Concept',
        backLabel: 'Explanation',
        includeImages: false,
        includeExamples: true,
      },
      {
        name: 'Term & Definition',
        subjectType: 'general',
        frontLabel: 'Term',
        backLabel: 'Definition',
        includeImages: false,
        includeExamples: false,
      },
      {
        name: 'Medical Concept',
        subjectType: 'medicine',
        frontLabel: 'Medical Term/Concept',
        backLabel: 'Description & Clinical Significance',
        includeImages: false,
        includeExamples: true,
      },
      {
        name: 'Problem & Solution',
        subjectType: 'mathematics',
        frontLabel: 'Problem',
        backLabel: 'Solution & Steps',
        includeImages: false,
        includeExamples: true,
      },
      {
        name: 'Historical Fact',
        subjectType: 'history',
        frontLabel: 'Event/Person/Date',
        backLabel: 'Details & Significance',
        includeImages: false,
        includeExamples: true,
      },
    ];
  }

  /**
   * Initialize default templates if none exist
   * Also performs one-time cleanup of duplicate templates
   */
  async initializeDefaultTemplates(): Promise<void> {
    const existingTemplates = await this.repository.getAllTemplates();
    
    // Check if we need to clean up duplicates (one-time migration)
    const templateNames = existingTemplates.map(t => t.name);
    const hasDuplicates = templateNames.length !== new Set(templateNames).size;
    
    if (hasDuplicates || existingTemplates.length === 0) {
      // Clear all existing templates
      for (const template of existingTemplates) {
        await this.repository.deleteTemplate(template.id);
      }
      
      // Create fresh templates
      const defaultTemplates = this.getDefaultTemplates();
      
      for (const template of defaultTemplates) {
        await this.repository.createTemplate(template);
      }
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<DeckTemplate[]> {
    return this.repository.getAllTemplates();
  }

  /**
   * Get templates for a specific subject type
   */
  async getTemplatesBySubjectType(subjectType: SubjectType): Promise<DeckTemplate[]> {
    const allTemplates = await this.repository.getAllTemplates();
    return allTemplates.filter(
      t => t.subjectType === subjectType || t.subjectType === 'general'
    );
  }

  /**
   * Create a custom template
   */
  async createTemplate(template: Omit<DeckTemplate, 'id' | 'createdAt'>): Promise<DeckTemplate> {
    return this.repository.createTemplate(template);
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, updates: Partial<DeckTemplate>): Promise<DeckTemplate> {
    return this.repository.updateTemplate(id, updates);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    return this.repository.deleteTemplate(id);
  }
}

export const templateService = TemplateService.getInstance();