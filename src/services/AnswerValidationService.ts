import { AnswerValidation } from '../types';

export class AnswerValidationService {
  /**
   * Validates a user's answer against the correct answer based on validation type
   */
  static validateAnswer(
    userAnswer: string,
    correctAnswer: string,
    validationType: AnswerValidation = 'flexible'
  ): { isCorrect: boolean; similarity: number } {
    const trimmedUser = userAnswer.trim();
    const trimmedCorrect = correctAnswer.trim();

    if (!trimmedUser) {
      return { isCorrect: false, similarity: 0 };
    }

    switch (validationType) {
      case 'exact':
        return this.exactMatch(trimmedUser, trimmedCorrect);
      
      case 'case-insensitive':
        return this.caseInsensitiveMatch(trimmedUser, trimmedCorrect);
      
      case 'typo-tolerant':
        return this.typoTolerantMatch(trimmedUser, trimmedCorrect);
      
      case 'keyword':
        return this.keywordMatch(trimmedUser, trimmedCorrect);
      
      case 'flexible':
        return this.flexibleMatch(trimmedUser, trimmedCorrect);
      
      default:
        return this.flexibleMatch(trimmedUser, trimmedCorrect);
    }
  }

  /**
   * Exact match - must be identical
   */
  private static exactMatch(userAnswer: string, correctAnswer: string): { isCorrect: boolean; similarity: number } {
    const isCorrect = userAnswer === correctAnswer;
    return { isCorrect, similarity: isCorrect ? 1 : 0 };
  }

  /**
   * Case insensitive match
   */
  private static caseInsensitiveMatch(userAnswer: string, correctAnswer: string): { isCorrect: boolean; similarity: number } {
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    return { isCorrect, similarity: isCorrect ? 1 : 0 };
  }

  /**
   * Typo tolerant - uses Levenshtein distance
   */
  private static typoTolerantMatch(userAnswer: string, correctAnswer: string): { isCorrect: boolean; similarity: number } {
    const distance = this.levenshteinDistance(
      userAnswer.toLowerCase(),
      correctAnswer.toLowerCase()
    );
    const maxLength = Math.max(userAnswer.length, correctAnswer.length);
    const similarity = 1 - distance / maxLength;
    
    // Allow up to 15% character differences
    const threshold = 0.85;
    const isCorrect = similarity >= threshold;
    
    return { isCorrect, similarity };
  }

  /**
   * Keyword match - at least one key word must be present
   */
  private static keywordMatch(userAnswer: string, correctAnswer: string): { isCorrect: boolean; similarity: number } {
    const userLower = userAnswer.toLowerCase();
    const correctLower = correctAnswer.toLowerCase();
    
    // Extract words (3+ characters) from correct answer
    const keywords = correctLower
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .filter(word => !this.isCommonWord(word));
    
    if (keywords.length === 0) {
      // If no keywords, fall back to case-insensitive
      return this.caseInsensitiveMatch(userAnswer, correctAnswer);
    }
    
    // Check if any keyword is present in user answer
    const matchedKeywords = keywords.filter(keyword => userLower.includes(keyword));
    const similarity = matchedKeywords.length / keywords.length;
    const isCorrect = matchedKeywords.length > 0;
    
    return { isCorrect, similarity };
  }

  /**
   * Flexible match - combines multiple strategies
   */
  private static flexibleMatch(userAnswer: string, correctAnswer: string): { isCorrect: boolean; similarity: number } {
    // Try exact match first
    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
      return { isCorrect: true, similarity: 1 };
    }
    
    // Try typo-tolerant with more lenient threshold
    const typoResult = this.typoTolerantMatch(userAnswer, correctAnswer);
    if (typoResult.similarity >= 0.75) {
      return { isCorrect: true, similarity: typoResult.similarity };
    }
    
    // Try keyword match
    const keywordResult = this.keywordMatch(userAnswer, correctAnswer);
    if (keywordResult.isCorrect) {
      return keywordResult;
    }
    
    return { isCorrect: false, similarity: Math.max(typoResult.similarity, keywordResult.similarity) };
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if a word is a common word that shouldn't be used as a keyword
   */
  private static isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
      'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
      'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did',
      'she', 'too', 'use', 'way', 'with', 'this', 'that', 'from', 'have',
      'they', 'will', 'what', 'been', 'more', 'when', 'your', 'said', 'each',
      'than', 'them', 'very', 'were', 'into', 'just', 'like', 'some', 'time'
    ]);
    return commonWords.has(word.toLowerCase());
  }

  /**
   * Generate multiple choice options for a card
   */
  static generateMultipleChoiceOptions(
    correctAnswer: string,
    allAnswers: string[],
    count: number = 4
  ): string[] {
    // Filter out the correct answer and similar answers
    const otherAnswers = allAnswers.filter(
      answer => answer.toLowerCase() !== correctAnswer.toLowerCase()
    );

    // Shuffle and take random wrong answers
    const shuffled = [...otherAnswers].sort(() => Math.random() - 0.5);
    const wrongAnswers = shuffled.slice(0, count - 1);

    // Combine with correct answer and shuffle
    const options = [...wrongAnswers, correctAnswer];
    return options.sort(() => Math.random() - 0.5);
  }

  /**
   * Get validation description for UI
   */
  static getValidationDescription(validationType: AnswerValidation): string {
    switch (validationType) {
      case 'exact':
        return 'Exact match required (case-sensitive)';
      case 'case-insensitive':
        return 'Exact match (case doesn\'t matter)';
      case 'typo-tolerant':
        return 'Minor typos accepted';
      case 'keyword':
        return 'Key word must be present';
      case 'flexible':
        return 'Flexible matching (recommended)';
      default:
        return 'Flexible matching';
    }
  }
}