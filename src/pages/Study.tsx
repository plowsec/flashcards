import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonProgressBar,
  IonAlert,
  IonInput,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonModal,
  IonTextarea,
  IonSpinner,
} from '@ionic/react';
import { checkmark, close, refresh, timer, bulb, send } from 'ionicons/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDataRepository } from '../repositories';
import { Deck, Card, StudyMode, ReviewResult, StudyInteractionType, QuestionType } from '../types';
import { SpacedRepetitionService } from '../services/SpacedRepetitionService';
import { AnswerValidationService } from '../services/AnswerValidationService';
import { openAIService } from '../services/OpenAIService';
import './Study.css';

interface CardProgress {
  card: Card;
  correctCount: number;
  incorrectCount: number;
  currentQuestionType: QuestionType;
}

const Study: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [studyCards, setStudyCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>('due');
  const [interactionType, setInteractionType] = useState<StudyInteractionType>('flashcards');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showCompleteAlert, setShowCompleteAlert] = useState(false);
  const [sessionStartTime] = useState(new Date());

  // For written answers
  const [userAnswer, setUserAnswer] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState<{ isCorrect: boolean; similarity: number } | null>(null);

  // For multiple choice
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);

  // For Learn mode (adaptive)
  const [cardProgress, setCardProgress] = useState<Map<string, CardProgress>>(new Map());

  // For Match mode
  const [matchPairs, setMatchPairs] = useState<Array<{ front: string; back: string; cardId: string }>>([]);
  const [selectedFront, setSelectedFront] = useState<number | null>(null);
  const [selectedBack, setSelectedBack] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [matchEndTime, setMatchEndTime] = useState<number | null>(null);

  // For AI Explain feature
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const repository = getDataRepository();

  useEffect(() => {
    loadDeck();
  }, [id]);

  useEffect(() => {
    if (deck && sessionStarted) {
      prepareStudyCards();
    }
  }, [deck, studyMode, sessionStarted]);

  // Add keyboard listener for space to flip card
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only flip on space in flashcard mode when answer is not shown
      if (
        e.code === 'Space' &&
        sessionStarted &&
        interactionType === 'flashcards' &&
        !showAnswer &&
        studyCards.length > 0
      ) {
        e.preventDefault();
        setShowAnswer(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sessionStarted, interactionType, showAnswer, studyCards.length]);

  const loadDeck = async () => {
    const loadedDeck = await repository.getDeckById(id);
    if (!loadedDeck) {
      history.push('/decks');
      return;
    }
    setDeck(loadedDeck);
  };

  const prepareStudyCards = () => {
    if (!deck) return;

    let cards = [...deck.cards];

    // Filter based on mode
    if (studyMode === 'due') {
      cards = SpacedRepetitionService.getDueCards(cards);
    } else if (studyMode === 'unknown') {
      cards = SpacedRepetitionService.getUnknownCards(cards);
    }

    // Sort based on mode
    cards = SpacedRepetitionService.getStudyOrder(cards, studyMode);

    setStudyCards(cards);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setUserAnswer('');
    setAnswerFeedback(null);
    setSelectedOption(null);

    // Initialize card progress for Learn mode
    if (interactionType === 'learn') {
      const progress = new Map<string, CardProgress>();
      cards.forEach(card => {
        progress.set(card.id, {
          card,
          correctCount: 0,
          incorrectCount: 0,
          currentQuestionType: 'multiple-choice', // Start with easiest
        });
      });
      setCardProgress(progress);
    }

    // Initialize Match mode
    if (interactionType === 'match') {
      initializeMatchMode(cards);
    }

    // Generate multiple choice options for first card if needed
    if ((interactionType === 'learn' || interactionType === 'test') && cards.length > 0) {
      generateMultipleChoiceForCurrentCard(cards, 0);
    }

    // Generate AI options for AI Quiz mode
    if (interactionType === 'ai-quiz' && cards.length > 0) {
      generateAIOptionsForCurrentCard(cards[0]);
    }
  };

  const initializeMatchMode = (cards: Card[]) => {
    // Take up to 8 cards for matching
    const cardsToMatch = cards.slice(0, Math.min(8, cards.length));
    const pairs = cardsToMatch.map(card => ({
      front: card.front,
      back: card.back,
      cardId: card.id,
    }));
    
    setMatchPairs(pairs);
    setMatchedPairs(new Set());
    setSelectedFront(null);
    setSelectedBack(null);
    setMatchStartTime(Date.now());
    setMatchEndTime(null);
  };

  const generateMultipleChoiceForCurrentCard = (cards: Card[], index: number) => {
    if (index >= cards.length) return;
    
    const currentCard = cards[index];
    const allAnswers = cards.map(c => c.back);
    const options = AnswerValidationService.generateMultipleChoiceOptions(
      currentCard.back,
      allAnswers,
      4
    );
    setMultipleChoiceOptions(options);
  };

  const generateAIOptionsForCurrentCard = async (card: Card) => {
    // Check if card already has AI-generated options
    if (card.aiGeneratedOptions && card.aiGeneratedOptions.length === 3) {
      // Use cached options
      const allOptions = [card.back, ...card.aiGeneratedOptions].sort(() => Math.random() - 0.5);
      setMultipleChoiceOptions(allOptions);
      setIsGeneratingOptions(false);
      return;
    }

    // Generate new options using AI
    if (!openAIService.hasApiKey()) {
      // Fallback to regular multiple choice if no API key
      const allAnswers = studyCards.map(c => c.back);
      const options = AnswerValidationService.generateMultipleChoiceOptions(
        card.back,
        allAnswers,
        4
      );
      setMultipleChoiceOptions(options);
      setIsGeneratingOptions(false);
      return;
    }

    setIsGeneratingOptions(true);
    try {
      const confusingOptions = await openAIService.generateConfusingOptions(
        card.front,
        card.back,
        3
      );

      // Save the generated options to the card
      if (deck) {
        await repository.updateCard(deck.id, card.id, {
          aiGeneratedOptions: confusingOptions,
        });
        // Update local state
        card.aiGeneratedOptions = confusingOptions;
      }

      // Shuffle all options including the correct answer
      const allOptions = [card.back, ...confusingOptions].sort(() => Math.random() - 0.5);
      setMultipleChoiceOptions(allOptions);
    } catch (error) {
      console.error('Error generating AI options:', error);
      // Fallback to regular multiple choice
      const allAnswers = studyCards.map(c => c.back);
      const options = AnswerValidationService.generateMultipleChoiceOptions(
        card.back,
        allAnswers,
        4
      );
      setMultipleChoiceOptions(options);
    } finally {
      setIsGeneratingOptions(false);
    }
  };

  const startSession = () => {
    setSessionStarted(true);
    prepareStudyCards();
  };

  const getCurrentQuestionType = (): QuestionType => {
    if (interactionType === 'flashcards') return 'flashcard';
    if (interactionType === 'test') return 'written';
    if (interactionType === 'match') return 'flashcard'; // Not used in match mode
    if (interactionType === 'ai-quiz') return 'multiple-choice';
    
    // Learn mode - adaptive
    if (interactionType === 'learn' && studyCards.length > 0) {
      const currentCard = studyCards[currentCardIndex];
      const progress = cardProgress.get(currentCard.id);
      return progress?.currentQuestionType || 'multiple-choice';
    }
    
    return 'flashcard';
  };

  const handleMultipleChoiceAnswer = (option: string) => {
    if (!deck || studyCards.length === 0) return;
    
    const currentCard = studyCards[currentCardIndex];
    const isCorrect = option.toLowerCase() === currentCard.back.toLowerCase();
    
    setSelectedOption(option);
    
    // Update progress for Learn mode
    if (interactionType === 'learn') {
      updateLearnProgress(currentCard.id, isCorrect);
    }
    
    // Wait a moment to show feedback, then move to next
    setTimeout(() => {
      handleAnswerResult(isCorrect ? 4 : 2);
    }, 1000);
  };

  const handleWrittenAnswer = () => {
    if (!deck || studyCards.length === 0 || !userAnswer.trim()) return;
    
    const currentCard = studyCards[currentCardIndex];
    const validationType = currentCard.answerValidation || 'flexible';
    
    const result = AnswerValidationService.validateAnswer(
      userAnswer,
      currentCard.back,
      validationType
    );
    
    setAnswerFeedback(result);
    
    // Update progress for Learn mode
    if (interactionType === 'learn') {
      updateLearnProgress(currentCard.id, result.isCorrect);
    }
    
    // Auto-advance after showing feedback
    setTimeout(() => {
      const quality = result.isCorrect ? (result.similarity > 0.95 ? 5 : 4) : 2;
      handleAnswerResult(quality);
    }, 2000);
  };

  const updateLearnProgress = (cardId: string, isCorrect: boolean) => {
    const progress = cardProgress.get(cardId);
    if (!progress) return;
    
    const newProgress = { ...progress };
    
    if (isCorrect) {
      newProgress.correctCount++;
      // Progress to harder question type after 2 correct answers
      if (newProgress.correctCount >= 2) {
        if (newProgress.currentQuestionType === 'multiple-choice') {
          newProgress.currentQuestionType = 'flashcard';
        } else if (newProgress.currentQuestionType === 'flashcard') {
          newProgress.currentQuestionType = 'written';
        }
      }
    } else {
      newProgress.incorrectCount++;
      // Regress to easier question type after 2 incorrect answers
      if (newProgress.incorrectCount >= 2) {
        if (newProgress.currentQuestionType === 'written') {
          newProgress.currentQuestionType = 'flashcard';
        } else if (newProgress.currentQuestionType === 'flashcard') {
          newProgress.currentQuestionType = 'multiple-choice';
        }
        newProgress.incorrectCount = 0;
      }
    }
    
    const newMap = new Map(cardProgress);
    newMap.set(cardId, newProgress);
    setCardProgress(newMap);
  };

  const handleAnswerResult = async (quality: ReviewResult['quality']) => {
    if (!deck || studyCards.length === 0) return;

    const currentCard = studyCards[currentCardIndex];
    
    // Calculate next review using SM-2
    const sm2Result = SpacedRepetitionService.calculateNextReview(currentCard, quality);
    const difficulty = SpacedRepetitionService.qualityToDifficulty(quality);

    // Update card in repository
    await repository.updateCard(deck.id, currentCard.id, {
      ...sm2Result,
      difficulty,
      lastReviewDate: new Date(),
    });

    // Update statistics
    setCardsStudied(cardsStudied + 1);
    if (quality >= 3) {
      setCorrectAnswers(correctAnswers + 1);
    }

    // Move to next card or complete session
    if (currentCardIndex < studyCards.length - 1) {
      const nextIndex = currentCardIndex + 1;
      setCurrentCardIndex(nextIndex);
      setShowAnswer(false);
      setUserAnswer('');
      setAnswerFeedback(null);
      setSelectedOption(null);
      
      // Generate new multiple choice options if needed
      if (interactionType === 'learn' || interactionType === 'test') {
        generateMultipleChoiceForCurrentCard(studyCards, nextIndex);
      } else if (interactionType === 'ai-quiz') {
        generateAIOptionsForCurrentCard(studyCards[nextIndex]);
      }
    } else {
      await completeSession();
    }
  };

  const handleMatchClick = (index: number, type: 'front' | 'back') => {
    if (matchedPairs.has(index)) return;
    
    if (type === 'front') {
      if (selectedFront === index) {
        setSelectedFront(null);
      } else {
        setSelectedFront(index);
        
        // Check for match if back is already selected
        if (selectedBack !== null) {
          checkMatch(index, selectedBack);
        }
      }
    } else {
      if (selectedBack === index) {
        setSelectedBack(null);
      } else {
        setSelectedBack(index);
        
        // Check for match if front is already selected
        if (selectedFront !== null) {
          checkMatch(selectedFront, index);
        }
      }
    }
  };

  const checkMatch = (frontIndex: number, backIndex: number) => {
    const pair = matchPairs[frontIndex];
    const backText = matchPairs[backIndex].back;
    
    if (pair.back === backText) {
      // Correct match!
      const newMatched = new Set(matchedPairs);
      newMatched.add(frontIndex);
      newMatched.add(backIndex);
      setMatchedPairs(newMatched);
      setSelectedFront(null);
      setSelectedBack(null);
      
      // Check if all matched
      if (newMatched.size === matchPairs.length * 2) {
        setMatchEndTime(Date.now());
        setTimeout(() => completeSession(), 2000);
      }
    } else {
      // Wrong match - show briefly then deselect
      setTimeout(() => {
        setSelectedFront(null);
        setSelectedBack(null);
      }, 500);
    }
  };

  const completeSession = async () => {
    if (!deck) return;

    // Save study session
    await repository.saveStudySession({
      deckId: deck.id,
      startTime: sessionStartTime,
      endTime: new Date(),
      cardsStudied: interactionType === 'match' ? matchPairs.length : cardsStudied,
      correctAnswers: interactionType === 'match' ? matchPairs.length : correctAnswers,
    });

    setShowCompleteAlert(true);
  };

  const handleExplainCard = async () => {
    if (!currentCard || !openAIService.hasApiKey()) {
      return;
    }

    setShowExplainModal(true);
    setIsLoadingExplanation(true);
    setExplanation('');
    setConversationHistory([]);

    try {
      const aiExplanation = await openAIService.explainFlashcard(
        currentCard.front,
        currentCard.back
      );
      setExplanation(aiExplanation);
    } catch (error) {
      setExplanation(`Error: ${error instanceof Error ? error.message : 'Failed to get explanation'}`);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleFollowUpQuestion = async () => {
    if (!currentCard || !followUpQuestion.trim() || !openAIService.hasApiKey()) {
      return;
    }

    setIsLoadingExplanation(true);

    try {
      const answer = await openAIService.answerFollowUpQuestion(
        currentCard.front,
        currentCard.back,
        explanation,
        followUpQuestion
      );

      setConversationHistory([
        ...conversationHistory,
        { question: followUpQuestion, answer },
      ]);
      setFollowUpQuestion('');
    } catch (error) {
      setConversationHistory([
        ...conversationHistory,
        {
          question: followUpQuestion,
          answer: `Error: ${error instanceof Error ? error.message : 'Failed to get answer'}`,
        },
      ]);
      setFollowUpQuestion('');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const closeExplainModal = () => {
    setShowExplainModal(false);
    setExplanation('');
    setFollowUpQuestion('');
    setConversationHistory([]);
  };

  const resetSession = () => {
    setSessionStarted(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setCardsStudied(0);
    setCorrectAnswers(0);
    setUserAnswer('');
    setAnswerFeedback(null);
    setSelectedOption(null);
    setCardProgress(new Map());
  };

  const handleCompleteAlertDismiss = () => {
    setShowCompleteAlert(false);
    history.push(`/deck/${id}`);
  };

  if (!deck) {
    return null;
  }

  const currentCard = studyCards[currentCardIndex];
  const progress = studyCards.length > 0 ? (currentCardIndex + 1) / studyCards.length : 0;
  const currentQuestionType = getCurrentQuestionType();

  // Render Match Mode
  const renderMatchMode = () => {
    const fronts = [...matchPairs].sort(() => Math.random() - 0.5);
    const backs = [...matchPairs].sort(() => Math.random() - 0.5);
    
    const elapsedTime = matchStartTime && !matchEndTime 
      ? Math.floor((Date.now() - matchStartTime) / 1000)
      : matchStartTime && matchEndTime
      ? Math.floor((matchEndTime - matchStartTime) / 1000)
      : 0;
    
    return (
      <div className="match-mode">
        <div className="match-header">
          <h2>Match the Cards!</h2>
          <div className="match-stats">
            <IonIcon icon={timer} />
            <span>{elapsedTime}s</span>
            <span className="match-progress">
              {matchedPairs.size / 2} / {matchPairs.length} matched
            </span>
          </div>
        </div>
        
        <div className="match-grid">
          <div className="match-column">
            <h3>Questions</h3>
            {fronts.map((pair, index) => {
              const originalIndex = matchPairs.indexOf(pair);
              const isMatched = matchedPairs.has(originalIndex);
              const isSelected = selectedFront === originalIndex;
              
              return (
                <IonCard
                  key={`front-${originalIndex}`}
                  className={`match-card ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMatchClick(originalIndex, 'front')}
                >
                  <IonCardContent>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {pair.front}
                    </ReactMarkdown>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
          
          <div className="match-column">
            <h3>Answers</h3>
            {backs.map((pair, index) => {
              const originalIndex = matchPairs.indexOf(pair);
              const isMatched = matchedPairs.has(originalIndex);
              const isSelected = selectedBack === originalIndex;
              
              return (
                <IonCard
                  key={`back-${originalIndex}`}
                  className={`match-card ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMatchClick(originalIndex, 'back')}
                >
                  <IonCardContent>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {pair.back}
                    </ReactMarkdown>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render current question based on type
  const renderQuestion = () => {
    if (!currentCard) return null;

    // Multiple Choice
    if (currentQuestionType === 'multiple-choice') {
      if (isGeneratingOptions) {
        return (
          <div className="question-container">
            <IonCard className="flashcard">
              <IonCardContent>
                <div className="loading-explanation">
                  <IonSpinner />
                  <p>Generating confusing options with AI...</p>
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        );
      }

      return (
        <div className="question-container">
          <IonCard className="flashcard">
            <IonCardContent>
              <div className="card-side-label">Question</div>
              <div className="card-content-display">
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentCard.front}
                  </ReactMarkdown>
                </div>
                {currentCard.frontImage && (
                  <img src={currentCard.frontImage} alt="Front" className="card-image" />
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <div className="multiple-choice-options">
            {multipleChoiceOptions.map((option, index) => {
              const isCorrect = option.toLowerCase() === currentCard.back.toLowerCase();
              const isSelected = selectedOption === option;
              const showFeedback = selectedOption !== null;
              
              return (
                <IonButton
                  key={index}
                  expand="block"
                  fill={isSelected ? 'solid' : 'outline'}
                  color={
                    showFeedback
                      ? isCorrect
                        ? 'success'
                        : isSelected
                        ? 'danger'
                        : 'medium'
                      : 'primary'
                  }
                  onClick={() => !selectedOption && handleMultipleChoiceAnswer(option)}
                  disabled={selectedOption !== null}
                  className="multiple-choice-btn"
                >
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{option}</ReactMarkdown>
                  </div>
                  {showFeedback && isCorrect && <IonIcon icon={checkmark} slot="end" />}
                  {showFeedback && isSelected && !isCorrect && <IonIcon icon={close} slot="end" />}
                </IonButton>
              );
            })}
          </div>
        </div>
      );
    }

    // Written Answer
    if (currentQuestionType === 'written') {
      return (
        <div className="question-container">
          <IonCard className="flashcard">
            <IonCardContent>
              <div className="card-side-label">Question</div>
              <div className="card-content-display">
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentCard.front}
                  </ReactMarkdown>
                </div>
                {currentCard.frontImage && (
                  <img src={currentCard.frontImage} alt="Front" className="card-image" />
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <div className="written-answer-section">
            <IonInput
              value={userAnswer}
              onIonInput={(e) => setUserAnswer(e.detail.value || '')}
              placeholder="Type your answer..."
              disabled={answerFeedback !== null}
              className="answer-input"
            />
            
            {answerFeedback && (
              <div className={`answer-feedback ${answerFeedback.isCorrect ? 'correct' : 'incorrect'}`}>
                <IonIcon icon={answerFeedback.isCorrect ? checkmark : close} />
                <div>
                  <strong>{answerFeedback.isCorrect ? 'Correct!' : 'Incorrect'}</strong>
                  {!answerFeedback.isCorrect && (
                    <div className="correct-answer">
                      Correct answer: <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentCard.back}</ReactMarkdown>
                    </div>
                  )}
                  <small>Similarity: {Math.round(answerFeedback.similarity * 100)}%</small>
                </div>
              </div>
            )}
            
            {!answerFeedback && (
              <IonButton
                expand="block"
                onClick={handleWrittenAnswer}
                disabled={!userAnswer.trim()}
                className="submit-answer-btn"
              >
                Submit Answer
              </IonButton>
            )}
          </div>
        </div>
      );
    }

    // Flashcard (default)
    return (
      <div className="question-container">
        <IonCard
          className="flashcard"
          onClick={() => !showAnswer && setShowAnswer(true)}
          style={{ cursor: !showAnswer ? 'pointer' : 'default' }}
        >
          <IonCardContent>
            <div className="card-side-label">
              {showAnswer ? 'Answer' : 'Question'}
            </div>
            <div className="card-content-display">
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {showAnswer ? currentCard.back : currentCard.front}
                </ReactMarkdown>
              </div>
              {showAnswer && currentCard.backImage && (
                <img src={currentCard.backImage} alt="Back" className="card-image" />
              )}
              {!showAnswer && currentCard.frontImage && (
                <img src={currentCard.frontImage} alt="Front" className="card-image" />
              )}
            </div>
          </IonCardContent>
        </IonCard>

        {!showAnswer ? (
          <IonButton
            expand="block"
            onClick={() => setShowAnswer(true)}
            className="show-answer-btn"
          >
            Show Answer
          </IonButton>
        ) : (
          <div className="rating-buttons">
            <h3>How well did you know this?</h3>
            <div className="rating-grid">
              <IonButton color="danger" onClick={() => handleAnswerResult(0)} className="rating-btn">
                <div>
                  <IonIcon icon={close} />
                  <div>Complete Blackout</div>
                </div>
              </IonButton>
              <IonButton color="danger" onClick={() => handleAnswerResult(1)} className="rating-btn">
                <div>
                  <div>Incorrect</div>
                  <small>But remembered</small>
                </div>
              </IonButton>
              <IonButton color="warning" onClick={() => handleAnswerResult(2)} className="rating-btn">
                <div>
                  <div>Incorrect</div>
                  <small>Seemed easy</small>
                </div>
              </IonButton>
              <IonButton color="warning" onClick={() => handleAnswerResult(3)} className="rating-btn">
                <div>
                  <div>Correct</div>
                  <small>With difficulty</small>
                </div>
              </IonButton>
              <IonButton color="success" onClick={() => handleAnswerResult(4)} className="rating-btn">
                <div>
                  <div>Correct</div>
                  <small>After hesitation</small>
                </div>
              </IonButton>
              <IonButton color="success" onClick={() => handleAnswerResult(5)} className="rating-btn">
                <div>
                  <IonIcon icon={checkmark} />
                  <div>Perfect!</div>
                </div>
              </IonButton>
            </div>
          </div>
        )}

        {showAnswer && openAIService.hasApiKey() && (
          <IonButton
            expand="block"
            fill="outline"
            color="secondary"
            onClick={handleExplainCard}
            className="explain-btn ion-margin-top"
          >
            <IonIcon slot="start" icon={bulb} />
            Explain with AI
          </IonButton>
        )}
      </div>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/deck/${id}`} />
          </IonButtons>
          <IonTitle>Study: {deck.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={resetSession}>
              <IonIcon slot="icon-only" icon={refresh} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="study-container">
          {!sessionStarted ? (
            <div className="study-setup">
              <h2>Study Setup</h2>
              
              <IonCard>
                <IonCardContent>
                  <IonLabel>Study Interaction Type:</IonLabel>
                  <IonSegment
                    value={interactionType}
                    onIonChange={(e) => setInteractionType(e.detail.value as StudyInteractionType)}
                  >
                    <IonSegmentButton value="flashcards">
                      <IonLabel>Flashcards</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="learn">
                      <IonLabel>Learn</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="test">
                      <IonLabel>Test</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="match">
                      <IonLabel>Match</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="ai-quiz">
                      <IonLabel>AI Quiz</IonLabel>
                    </IonSegmentButton>
                  </IonSegment>

                  <div className="interaction-description">
                    {interactionType === 'flashcards' && (
                      <p>Classic flashcard mode - flip cards to reveal answers and rate your recall.</p>
                    )}
                    {interactionType === 'learn' && (
                      <p>Adaptive learning - starts with multiple choice, progresses to written answers based on your performance.</p>
                    )}
                    {interactionType === 'test' && (
                      <p>Test yourself - write answers and get instant feedback with validation.</p>
                    )}
                    {interactionType === 'match' && (
                      <p>Match game - race against the clock to match questions with answers!</p>
                    )}
                    {interactionType === 'ai-quiz' && (
                      <p>
                        AI-powered quiz with confusing wrong answers that test true understanding.
                        {!openAIService.hasApiKey() && (
                          <span style={{ color: 'var(--ion-color-warning)' }}>
                            {' '}(Configure OpenAI API key in Settings to enable)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard>
                <IonCardContent>
                  <IonLabel>Card Selection Mode:</IonLabel>
                  <IonSelect
                    value={studyMode}
                    onIonChange={(e) => setStudyMode(e.detail.value)}
                    className="mode-select"
                  >
                    <IonSelectOption value="due">Due Cards</IonSelectOption>
                    <IonSelectOption value="difficult">Difficult First</IonSelectOption>
                    <IonSelectOption value="unknown">Unknown First</IonSelectOption>
                    <IonSelectOption value="random">Random Order</IonSelectOption>
                    <IonSelectOption value="sequential">Sequential</IonSelectOption>
                  </IonSelect>

                  <div className="mode-description">
                    {studyMode === 'due' && (
                      <p>Review cards that are due for review based on spaced repetition.</p>
                    )}
                    {studyMode === 'difficult' && (
                      <p>Start with the most difficult cards first.</p>
                    )}
                    {studyMode === 'unknown' && (
                      <p>Focus on cards you haven't reviewed yet.</p>
                    )}
                    {studyMode === 'random' && (
                      <p>Study cards in random order.</p>
                    )}
                    {studyMode === 'sequential' && (
                      <p>Study cards in the order they were created.</p>
                    )}
                  </div>

                  <IonButton
                    expand="block"
                    onClick={startSession}
                    disabled={deck.cards.length === 0}
                    className="ion-margin-top"
                  >
                    Start Study Session
                  </IonButton>

                  {deck.cards.length === 0 && (
                    <p className="warning-text">
                      This deck has no cards. Add some cards first!
                    </p>
                  )}
                </IonCardContent>
              </IonCard>
            </div>
          ) : studyCards.length === 0 && interactionType !== 'match' ? (
            <div className="no-cards">
              <h2>No Cards to Study</h2>
              <p>
                {studyMode === 'due'
                  ? 'No cards are due for review right now. Great job!'
                  : studyMode === 'unknown'
                  ? 'No unknown cards. All cards have been reviewed!'
                  : 'No cards available for this study mode.'}
              </p>
              <IonButton onClick={resetSession}>Choose Different Mode</IonButton>
            </div>
          ) : interactionType === 'match' ? (
            renderMatchMode()
          ) : (
            <div className="study-session">
              <div className="progress-section">
                <div className="progress-info">
                  <span>
                    Card {currentCardIndex + 1} of {studyCards.length}
                  </span>
                  <span>
                    Correct: {correctAnswers} / {cardsStudied}
                  </span>
                  {interactionType === 'learn' && currentCard && (
                    <IonText color="medium">
                      <small>Mode: {currentQuestionType.replace('-', ' ')}</small>
                    </IonText>
                  )}
                </div>
                <IonProgressBar value={progress} />
              </div>

              {renderQuestion()}
            </div>
          )}
        </div>

        <IonAlert
          isOpen={showCompleteAlert}
          onDidDismiss={handleCompleteAlertDismiss}
          header="Session Complete!"
          message={
            interactionType === 'match'
              ? `You matched all ${matchPairs.length} pairs in ${matchEndTime && matchStartTime ? Math.floor((matchEndTime - matchStartTime) / 1000) : 0} seconds!`
              : `You studied ${cardsStudied} cards and got ${correctAnswers} correct (${
                  cardsStudied > 0 ? Math.round((correctAnswers / cardsStudied) * 100) : 0
                }%).`
          }
          buttons={['OK']}
        />

        <IonModal isOpen={showExplainModal} onDidDismiss={closeExplainModal}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>AI Explanation</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={closeExplainModal}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {currentCard && (
              <div className="explain-modal-content">
                <IonCard>
                  <IonCardContent>
                    <div className="card-preview">
                      <strong>Question:</strong>
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentCard.front}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="card-preview ion-margin-top">
                      <strong>Answer:</strong>
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentCard.back}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>

                {isLoadingExplanation && !explanation ? (
                  <div className="loading-explanation">
                    <IonSpinner />
                    <p>Getting AI explanation...</p>
                  </div>
                ) : explanation ? (
                  <IonCard>
                    <IonCardContent>
                      <h3>Explanation</h3>
                      <div className="markdown-content explanation-text">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {explanation}
                        </ReactMarkdown>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ) : null}

                {conversationHistory.length > 0 && (
                  <div className="conversation-history">
                    <h3>Follow-up Questions</h3>
                    {conversationHistory.map((item, index) => (
                      <IonCard key={index}>
                        <IonCardContent>
                          <div className="follow-up-question">
                            <strong>Q:</strong> {item.question}
                          </div>
                          <div className="follow-up-answer">
                            <strong>A:</strong>
                            <div className="markdown-content">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {item.answer}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                    ))}
                  </div>
                )}

                {explanation && (
                  <div className="follow-up-input">
                    <IonTextarea
                      value={followUpQuestion}
                      onIonInput={(e) => setFollowUpQuestion(e.detail.value || '')}
                      placeholder="Ask a follow-up question..."
                      rows={3}
                      disabled={isLoadingExplanation}
                    />
                    <IonButton
                      expand="block"
                      onClick={handleFollowUpQuestion}
                      disabled={!followUpQuestion.trim() || isLoadingExplanation}
                      className="ion-margin-top"
                    >
                      {isLoadingExplanation ? (
                        <>
                          <IonSpinner slot="start" />
                          Asking...
                        </>
                      ) : (
                        <>
                          <IonIcon slot="start" icon={send} />
                          Ask Question
                        </>
                      )}
                    </IonButton>
                  </div>
                )}
              </div>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Study;