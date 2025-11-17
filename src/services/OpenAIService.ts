// OpenAI service for AI-powered features
// Handles API key management and OpenAI API interactions

import {
  SubjectType,
  CourseOutlineNode,
  GeneratedCard,
  DeckTemplate,
  Deck,
  GapAnalysis
} from '../types';

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

Provide a short explanation that helps the user understand:
1. Why this is the correct answer
2. Key concepts involved
3. Any important context or background
4. Common misconceptions to avoid

Keep the explanation short but to the point, avoid behind vague or too generic. The user will read your reply on mobile, so there isn't much space.`;

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

  /**
   * Generate improvement suggestions for a flashcard
   */
  async generateCardImprovements(
    front: string,
    back: string,
    improveType: 'front' | 'back' | 'both'
  ): Promise<Array<{ front: string; back: string }>> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let prompt: string;
    
    if (improveType === 'front') {
      prompt = `Given this flashcard:
Front: ${front}
Back: ${back}

Generate 3 alternative versions of the FRONT side only. Keep the back side exactly the same. The alternatives should:
1. Test the same knowledge in different ways
2. Be clear and unambiguous
3. Vary in difficulty or approach
4. Be concise and well-formatted
5. Work for any use case (language learning, facts, concepts, etc.)

Return ONLY a JSON array of 3 objects with "front" and "back" properties. Example format:
[
  {"front": "alternative front 1", "back": "${back}"},
  {"front": "alternative front 2", "back": "${back}"},
  {"front": "alternative front 3", "back": "${back}"}
]`;
    } else if (improveType === 'back') {
      prompt = `Given this flashcard:
Front: ${front}
Back: ${back}

Generate 3 alternative versions of the BACK side only. Keep the front side exactly the same. The alternatives should:
1. Provide the same core information in different ways
2. Be clear and accurate
3. Vary in detail or presentation
4. Be concise and well-formatted
5. Work for any use case (translations, definitions, examples, etc.)

Return ONLY a JSON array of 3 objects with "front" and "back" properties. Example format:
[
  {"front": "${front}", "back": "alternative back 1"},
  {"front": "${front}", "back": "alternative back 2"},
  {"front": "${front}", "back": "alternative back 3"}
]`;
    } else {
      prompt = `Given this flashcard:
Front: ${front}
Back: ${back}

Generate 3 improved versions of this flashcard (both sides). The improvements should:
1. Make both sides clearer and more specific
2. Improve formatting and readability
3. Fix any ambiguities or errors
4. Maintain the core learning objective
5. Work for any use case (language learning, facts, concepts, etc.)

Return ONLY a JSON array of 3 objects with "front" and "back" properties. Example format:
[
  {"front": "improved front 1", "back": "improved back 1"},
  {"front": "improved front 2", "back": "improved back 2"},
  {"front": "improved front 3", "back": "improved back 3"}
]`;
    }

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
              content: 'You are an expert at creating effective educational flashcards. You help improve flashcards to be clearer, more effective, and better for learning.',
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
      const content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON array from the response
      const improvements = JSON.parse(content);
      
      if (!Array.isArray(improvements) || improvements.length !== 3) {
        throw new Error('Invalid response format from OpenAI');
      }

      return improvements;
    } catch (error) {
      console.error('Error generating card improvements:', error);
      throw error;
    }
  }
  /**
   * Helper function to strip markdown code blocks from JSON responses
   */
  private stripMarkdownCodeBlocks(content: string): string {
    // Remove ```json and ``` markers
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  }

  /**
   * Generate a course outline for a subject
   * @param subject - The subject to create an outline for (e.g., "Classical Mechanics")
   * @param subjectType - The type of subject
   * @param description - Optional description of what the user wants to learn
   * @param depth - How many levels deep (2-4 recommended)
   * @param breadth - Average number of subtopics per topic (3-5 recommended)
   */
  async generateCourseOutline(
    subject: string,
    subjectType: SubjectType,
    description: string = '',
    depth: number = 3,
    breadth: number = 4
  ): Promise<CourseOutlineNode[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Create a comprehensive course outline for "${subject}" (${subjectType}).
${description ? `\nUser's learning goals: ${description}` : ''}

Requirements:
- Create a hierarchical structure with ${depth} levels deep
- Each topic should have approximately ${breadth} subtopics
- Estimate the number of flashcards needed for each leaf topic (10-20 cards)
- Include clear, descriptive titles and brief descriptions
- Focus on key concepts that are essential for understanding the subject
- Organize topics in a logical learning progression

Return ONLY a JSON array of root-level topics. Each topic should have this structure:
{
  "id": "unique-id",
  "title": "Topic Title",
  "description": "Brief description of what this covers",
  "level": 0,
  "parentId": null,
  "children": [nested topics with level+1],
  "estimatedCardCount": 15,
  "status": "pending"
}

For leaf nodes (no children), include estimatedCardCount. For parent nodes, set it to 0.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert curriculum designer who creates well-structured, comprehensive learning outlines. You understand how to break down complex subjects into logical, progressive learning paths.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Strip markdown code blocks if present
      content = this.stripMarkdownCodeBlocks(content);

      const outline = JSON.parse(content);
      
      if (!Array.isArray(outline)) {
        throw new Error('Invalid response format from OpenAI');
      }

      return outline;
    } catch (error) {
      console.error('Error generating course outline:', error);
      throw error;
    }
  }

  /**
   * Refine a course outline based on user feedback
   * @param outline - Current outline
   * @param feedback - User's feedback/instructions
   */
  async refineCourseOutline(
    outline: CourseOutlineNode[],
    feedback: string
  ): Promise<CourseOutlineNode[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Here is the current course outline:
${JSON.stringify(outline, null, 2)}

User feedback: ${feedback}

Please refine the outline based on the user's feedback. Maintain the same JSON structure with id, title, description, level, parentId, children, estimatedCardCount, and status fields.

Return ONLY the updated JSON array of root-level topics.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert curriculum designer who refines learning outlines based on feedback.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Strip markdown code blocks if present
      content = this.stripMarkdownCodeBlocks(content);

      const refinedOutline = JSON.parse(content);
      
      if (!Array.isArray(refinedOutline)) {
        throw new Error('Invalid response format from OpenAI');
      }

      return refinedOutline;
    } catch (error) {
      console.error('Error refining course outline:', error);
      throw error;
    }
  }

  /**
   * Generate flashcards for a specific topic in the outline
   * @param node - The outline node to generate cards for
   * @param template - The deck template to use
   * @param count - Number of cards to generate (default: 15)
   * @param existingCardFronts - Optional array of existing card fronts to avoid duplicates
   */
  async generateFlashcardsForTopic(
    node: CourseOutlineNode,
    template: DeckTemplate,
    count: number = 15,
    existingCardFronts: string[] = []
  ): Promise<GeneratedCard[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const existingCardsContext = existingCardFronts.length > 0
      ? `\n\nExisting cards in this deck (avoid duplicating these topics):\n${existingCardFronts.map((front, i) => `${i + 1}. ${front}`).join('\n')}`
      : '';

    const prompt = `Generate ${count} flashcards for the topic: "${node.title}"
Description: ${node.description}
${existingCardsContext}

Template:
- Front label: ${template.frontLabel}
- Back label: ${template.backLabel}
- Include examples: ${template.includeExamples}

Requirements:
- Create high-quality, educational flashcards
- Cover key concepts, definitions, and important details
- Vary difficulty: some easy, some medium, some hard
- Make questions clear and unambiguous
- Provide complete, accurate answers
- Include brief explanations of why each card is important
- Use markdown formatting for better readability
${existingCardFronts.length > 0 ? '- IMPORTANT: Avoid creating cards that duplicate or overlap with the existing cards listed above' : ''}

Return ONLY a JSON array of ${count} flashcard objects with this structure:
{
  "id": "unique-id",
  "front": "Question or term",
  "back": "Answer or definition",
  "explanation": "Why this card is important to learn",
  "difficulty": "easy" | "medium" | "hard",
  "selected": true,
  "nodeId": "${node.id}"
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educator who creates effective, high-quality flashcards for learning. You understand how to break down complex topics into memorable, testable knowledge.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Strip markdown code blocks if present
      content = this.stripMarkdownCodeBlocks(content);

      const cards = JSON.parse(content);
      
      if (!Array.isArray(cards)) {
        throw new Error('Invalid response format from OpenAI');
      }

      return cards;
    } catch (error) {
      console.error('Error generating flashcards:', error);
      throw error;
    }
  }

  /**
   * Analyze a deck to find gaps and suggest improvements
   * @param deck - The deck to analyze
   * @param subject - The subject area
   */
  async analyzeGaps(
    deck: Deck,
    subject: string
  ): Promise<GapAnalysis> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Extract card content for analysis
    const cardSummary = deck.cards.map(card => ({
      front: card.front.substring(0, 100), // Limit length for API
      back: card.back.substring(0, 100),
    }));

    const prompt = `Analyze this flashcard deck for the subject "${subject}":

Deck: ${deck.name}
Description: ${deck.description}
Number of cards: ${deck.cards.length}

Sample cards:
${JSON.stringify(cardSummary.slice(0, 20), null, 2)}

Please analyze this deck and identify:
1. Missing topics that should be covered
2. Weak areas (topics with too few cards or insufficient coverage)
3. Suggest 5-10 new flashcards to fill the most important gaps

Return ONLY a JSON object with this structure:
{
  "deckId": "${deck.id}",
  "missingTopics": ["topic1", "topic2", ...],
  "weakAreas": ["area1", "area2", ...],
  "suggestedCards": [
    {
      "id": "unique-id",
      "front": "Question",
      "back": "Answer",
      "explanation": "Why this fills a gap",
      "difficulty": "medium",
      "selected": true,
      "nodeId": ""
    }
  ],
  "analysisDate": "${new Date().toISOString()}"
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educator who analyzes learning materials to identify gaps and suggest improvements.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Strip markdown code blocks if present
      content = this.stripMarkdownCodeBlocks(content);

      const analysis = JSON.parse(content);
      
      // Ensure analysisDate is a Date object
      analysis.analysisDate = new Date(analysis.analysisDate);

      return analysis;
    } catch (error) {
      console.error('Error analyzing gaps:', error);
      throw error;
    }
  }

  /**
   * Generate additional cards to fill identified gaps
   * @param gapAnalysis - The gap analysis result
   * @param template - The deck template to use
   */
  async generateGapFillingCards(
    gapAnalysis: GapAnalysis,
    template: DeckTemplate
  ): Promise<GeneratedCard[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Generate flashcards to fill these gaps:

Missing topics: ${gapAnalysis.missingTopics.join(', ')}
Weak areas: ${gapAnalysis.weakAreas.join(', ')}

Template:
- Front label: ${template.frontLabel}
- Back label: ${template.backLabel}

Generate 10-15 flashcards that address these gaps. Focus on the most important missing concepts.

Return ONLY a JSON array of flashcard objects with this structure:
{
  "id": "unique-id",
  "front": "Question",
  "back": "Answer",
  "explanation": "Which gap this fills",
  "difficulty": "easy" | "medium" | "hard",
  "selected": true,
  "nodeId": ""
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educator who creates targeted flashcards to fill knowledge gaps.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Strip markdown code blocks if present
      content = this.stripMarkdownCodeBlocks(content);

      const cards = JSON.parse(content);
      
      if (!Array.isArray(cards)) {
        throw new Error('Invalid response format from OpenAI');
      }

      return cards;
    } catch (error) {
      console.error('Error generating gap-filling cards:', error);
      throw error;
    }
  }
}

export const openAIService = OpenAIService.getInstance();