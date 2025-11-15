// OpenAI service for AI-powered features
// Handles API key management and OpenAI API interactions

const STORAGE_KEY = 'flashcards_openai_api_key';

export class OpenAIService {
  private static instance: OpenAIService;
  private apiKey: string | null = null;

  private constructor() {
    this.loadApiKey();
  }

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  private loadApiKey(): void {
    this.apiKey = localStorage.getItem(STORAGE_KEY);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem(STORAGE_KEY, key);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey(): void {
    this.apiKey = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate confusing wrong answers for multiple choice questions
   * These should be plausible but incorrect based on the correct answer
   */
  async generateConfusingOptions(
    question: string,
    correctAnswer: string,
    count: number = 3
  ): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Given this flashcard:
Question: ${question}
Correct Answer: ${correctAnswer}

Generate ${count} plausible but INCORRECT answers that would confuse someone learning this material. The wrong answers should:
1. Be related to the topic and seem reasonable
2. NOT be trivially different or obviously wrong
3. Test understanding rather than just memory
4. Be similar in format and length to the correct answer
5. Avoid simple negations or opposite meanings

Return ONLY a JSON array of ${count} strings, nothing else. Example format: ["wrong answer 1", "wrong answer 2", "wrong answer 3"]`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating educational multiple choice questions. You generate plausible but incorrect answers that test true understanding.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON array from the response
      const options = JSON.parse(content);
      
      if (!Array.isArray(options) || options.length !== count) {
        throw new Error('Invalid response format from OpenAI');
      }

      return options;
    } catch (error) {
      console.error('Error generating confusing options:', error);
      throw error;
    }
  }

  /**
   * Explain a flashcard to the user
   */
  async explainFlashcard(
    question: string,
    answer: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Explain this flashcard in a clear, educational way:

Question: ${question}
Answer: ${answer}

Provide a detailed explanation that helps the user understand:
1. Why this is the correct answer
2. Key concepts involved
3. Any important context or background
4. Common misconceptions to avoid

Keep the explanation short but to the point, avoid behind vague or too generic.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful tutor who explains concepts clearly and concisely.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      const explanation = data.choices[0]?.message?.content?.trim();
      
      if (!explanation) {
        throw new Error('No response from OpenAI');
      }

      return explanation;
    } catch (error) {
      console.error('Error explaining flashcard:', error);
      throw error;
    }
  }

  /**
   * Answer a follow-up question about a flashcard
   */
  async answerFollowUpQuestion(
    question: string,
    answer: string,
    previousExplanation: string,
    followUpQuestion: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Context - Original Flashcard:
Question: ${question}
Answer: ${answer}

Previous Explanation:
${previousExplanation}

User's Follow-up Question:
${followUpQuestion}

Please answer the user's follow-up question in the context of this flashcard. Be helpful, clear, and educational. The user is on mobile, so keep your reply short.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful tutor answering follow-up questions about educational content.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      const answerText = data.choices[0]?.message?.content?.trim();
      
      if (!answerText) {
        throw new Error('No response from OpenAI');
      }

      return answerText;
    } catch (error) {
      console.error('Error answering follow-up question:', error);
      throw error;
    }
  }
}

export const openAIService = OpenAIService.getInstance();