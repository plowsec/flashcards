import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useIonViewWillEnter } from '@ionic/react';
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
  IonFab,
  IonFabButton,
  IonModal,
  IonInput,
  IonTextarea,
  IonAlert,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonBadge,
  IonSearchbar,
  IonText,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonCheckbox,
} from '@ionic/react';
import { add, trash, pencil, play, download, cloudUpload, folder as folderIcon, time, flame, calendar, trendingDown, trendingUp, analytics, checkmark, sparkles, lockClosed, lockOpen, key, text, checkmarkCircle, image } from 'ionicons/icons';
import { openAIService } from '../services/OpenAIService';
import { GapAnalysis, GeneratedCard } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDataRepository } from '../repositories';
import { Deck, Card, SortOption, AnswerValidation, Folder, SubjectType } from '../types';
import { AnswerValidationService } from '../services/AnswerValidationService';
import './DeckDetail.css';

const DeckDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('createdAt-desc');
  const [showModal, setShowModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardFrontImage, setCardFrontImage] = useState('');
  const [cardBackImage, setCardBackImage] = useState('');
  const [answerValidation, setAnswerValidation] = useState<AnswerValidation>('flexible');
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [showGapAnalysisModal, setShowGapAnalysisModal] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestedCards, setSuggestedCards] = useState<GeneratedCard[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [isGeneratingAICards, setIsGeneratingAICards] = useState(false);
  const [aiCardCount, setAICardCount] = useState(10);
  const [aiCardTopic, setAICardTopic] = useState('');

  const repository = getDataRepository();

  useEffect(() => {
    loadDeck();
    loadFolders();
    setHasApiKey(openAIService.hasApiKey());
  }, [id]);

  // Reload data when view is entered (e.g., returning from import)
  useIonViewWillEnter(() => {
    loadDeck();
    loadFolders();
  });

  useEffect(() => {
    if (deck) {
      filterAndSortCards();
    }
  }, [deck, searchText, sortOption]);

  const loadDeck = async () => {
    const loadedDeck = await repository.getDeckById(id);
    if (!loadedDeck) {
      history.push('/decks');
      return;
    }
    setDeck(loadedDeck);
    setSelectedFolderIds(loadedDeck.folderIds || []);
  };

  const loadFolders = async () => {
    const loadedFolders = await repository.getAllFolders();
    setFolders(loadedFolders);
  };

  const filterAndSortCards = () => {
    if (!deck) return;

    let cards = [...deck.cards];

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      cards = cards.filter(
        (card) =>
          card.front.toLowerCase().includes(search) ||
          card.back.toLowerCase().includes(search)
      );
    }

    // Sort cards
    cards.sort((a, b) => {
      switch (sortOption) {
        case 'createdAt-asc':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'createdAt-desc':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'difficulty-asc':
          return getDifficultyValue(a.difficulty) - getDifficultyValue(b.difficulty);
        case 'difficulty-desc':
          return getDifficultyValue(b.difficulty) - getDifficultyValue(a.difficulty);
        case 'nextReview-asc':
          return a.nextReviewDate.getTime() - b.nextReviewDate.getTime();
        case 'nextReview-desc':
          return b.nextReviewDate.getTime() - a.nextReviewDate.getTime();
        default:
          return 0;
      }
    });

    setFilteredCards(cards);
  };

  const getDifficultyValue = (difficulty: Card['difficulty']): number => {
    const values = { unknown: 0, easy: 1, medium: 2, hard: 3 };
    return values[difficulty];
  };

  const handleCreateCard = async () => {
    if (!deck || !cardFront.trim() || !cardBack.trim()) return;

    try {
      await repository.createCard(deck.id, {
        front: cardFront,
        back: cardBack,
        frontImage: cardFrontImage || undefined,
        backImage: cardBackImage || undefined,
        answerValidation,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
        difficulty: 'unknown',
      });
      await loadDeck();
      resetForm();
    } catch (error) {
      console.error('Error creating card:', error);
    }
  };

  const handleUpdateCard = async () => {
    if (!deck || !editingCard || !cardFront.trim() || !cardBack.trim()) return;

    try {
      await repository.updateCard(deck.id, editingCard.id, {
        front: cardFront,
        back: cardBack,
        frontImage: cardFrontImage || undefined,
        backImage: cardBackImage || undefined,
        answerValidation,
      });
      await loadDeck();
      resetForm();
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const handleDeleteCard = async () => {
    if (!deck || !cardToDelete) return;

    try {
      await repository.deleteCard(deck.id, cardToDelete);
      await loadDeck();
      setCardToDelete(null);
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const openEditModal = (card: Card) => {
    setEditingCard(card);
    setCardFront(card.front);
    setCardBack(card.back);
    setCardFrontImage(card.frontImage || '');
    setCardBackImage(card.backImage || '');
    setAnswerValidation(card.answerValidation || 'flexible');
    setShowImageUpload(!!(card.frontImage || card.backImage));
    setShowModal(true);
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingCard(null);
    setCardFront('');
    setCardBack('');
    setCardFrontImage('');
    setCardBackImage('');
    setAnswerValidation('flexible');
    setShowImageUpload(false);
  };

  const confirmDelete = (cardId: string) => {
    setCardToDelete(cardId);
    setShowDeleteAlert(true);
  };

  const getDifficultyColor = (difficulty: Card['difficulty']) => {
    const colors = {
      unknown: 'medium',
      hard: 'danger',
      medium: 'warning',
      easy: 'success',
    };
    return colors[difficulty];
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (side === 'front') {
        setCardFrontImage(base64);
      } else {
        setCardBackImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateFolders = async () => {
    if (!deck) return;

    try {
      await repository.updateDeck(deck.id, {
        folderIds: selectedFolderIds,
      });
      await loadDeck();
      setShowFolderModal(false);
    } catch (error) {
      console.error('Error updating folders:', error);
    }
  };

  const getDeckFolders = () => {
    if (!deck) return [];
    return folders.filter((f) => deck.folderIds.includes(f.id));
  };

  const handleAnalyzeGaps = async () => {
    if (!deck) return;
    
    setIsAnalyzing(true);
    setShowGapAnalysisModal(true);
    
    try {
      const analysis = await openAIService.analyzeGaps(deck, deck.name);
      setGapAnalysis(analysis);
      setSuggestedCards(analysis.suggestedCards);
      
      // Save analysis to repository
      await repository.saveGapAnalysis(analysis);
    } catch (error: any) {
      console.error('Error analyzing gaps:', error);
      alert(error.message || 'Failed to analyze deck gaps');
      setShowGapAnalysisModal(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestedCard = (cardId: string) => {
    setSuggestedCards(cards =>
      cards.map(card =>
        card.id === cardId ? { ...card, selected: !card.selected } : card
      )
    );
  };

  const handleAddSuggestedCards = async () => {
    if (!deck) return;
    
    try {
      const selectedCards = suggestedCards.filter(card => card.selected);
      
      for (const card of selectedCards) {
        await repository.createCard(deck.id, {
          front: card.front,
          back: card.back,
          frontImage: card.frontImage,
          backImage: card.backImage,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: new Date(),
          difficulty: 'unknown',
        });
      }
      
      await loadDeck();
      setShowSuggestionsModal(false);
      setShowGapAnalysisModal(false);
      alert(`Added ${selectedCards.length} cards to the deck!`);
    } catch (error: any) {
      console.error('Error adding suggested cards:', error);
      alert(error.message || 'Failed to add cards');
    }
  };

  const handleGenerateAICards = async () => {
    if (!deck) return;
    
    setIsGeneratingAICards(true);
    
    try {
      // Create a simple template based on deck content
      const template = {
        id: 'temp',
        name: 'Question & Answer',
        subjectType: 'general' as SubjectType,
        frontLabel: 'Question',
        backLabel: 'Answer',
        includeImages: false,
        includeExamples: true,
        createdAt: new Date(),
      };
      
      // Create a topic node for generation
      const topicNode = {
        id: 'temp',
        title: aiCardTopic || deck.name,
        description: deck.description || `Generate flashcards for ${deck.name}`,
        level: 0,
        parentId: null,
        children: [],
        estimatedCardCount: aiCardCount,
        status: 'pending' as const,
      };
      
      // Extract existing card fronts to avoid duplicates (only send fronts to save tokens)
      const existingCardFronts = deck.cards.map(card => card.front);
      
      const cards = await openAIService.generateFlashcardsForTopic(
        topicNode,
        template,
        aiCardCount,
        existingCardFronts
      );
      
      setSuggestedCards(cards);
      setShowAIGenerateModal(false);
      setShowSuggestionsModal(true);
    } catch (error: any) {
      console.error('Error generating AI cards:', error);
      alert(error.message || 'Failed to generate flashcards');
    } finally {
      setIsGeneratingAICards(false);
    }
  };

  if (!deck) {
    return null;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/decks" />
          </IonButtons>
          <IonTitle>{deck.name}</IonTitle>
          <IonButtons slot="end">
            {hasApiKey && (
              <>
                <IonButton onClick={() => setShowAIGenerateModal(true)} data-desc="Generate AI Cards">
                  <IonIcon slot="icon-only" icon={sparkles} />
                </IonButton>
                <IonButton onClick={handleAnalyzeGaps} disabled={deck.cards.length === 0} data-desc="Gap Analysis">
                  <IonIcon slot="icon-only" icon={analytics} />
                </IonButton>
              </>
            )}
            <IonButton onClick={() => setShowFolderModal(true)}>
              <IonIcon slot="icon-only" icon={folderIcon} />
            </IonButton>
            <IonButton routerLink={`/study/${deck.id}`} disabled={deck.cards.length === 0}>
              <IonIcon slot="icon-only" icon={play} />
            </IonButton>
            <IonButton routerLink={`/deck/${deck.id}/import`}>
              <IonIcon slot="icon-only" icon={cloudUpload} />
            </IonButton>
            <IonButton routerLink={`/deck/${deck.id}/export`}>
              <IonIcon slot="icon-only" icon={download} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            placeholder="Search cards..."
          />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="deck-detail-container">
          <div className="deck-info">
            <p>{deck.description}</p>
            {getDeckFolders().length > 0 && (
              <div className="deck-folders">
                <IonLabel>Folders:</IonLabel>
                <div className="folder-chips">
                  {getDeckFolders().map((folder) => (
                    <IonChip key={folder.id}>
                      <IonIcon icon={folderIcon} />
                      <IonLabel>{folder.name}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </div>
            )}
            <div className="sort-controls">
              <IonLabel>Sort by:</IonLabel>
              <IonSegment
                value={sortOption}
                onIonChange={(e) => setSortOption(e.detail.value as SortOption)}
              >
                <IonSegmentButton value="createdAt-desc">
                  <IonIcon icon={time} />
                  <IonLabel>Newest</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="difficulty-desc">
                  <IonIcon icon={flame} />
                  <IonLabel>Hardest</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="nextReview-asc">
                  <IonIcon icon={calendar} />
                  <IonLabel>Due Soon</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="empty-state">
              <p>
                {searchText
                  ? 'No cards match your search'
                  : 'No cards yet. Add your first card!'}
              </p>
            </div>
          ) : (
            <IonList>
              {filteredCards.map((card) => (
                <IonCard key={card.id} className="card-item">
                  <IonCardContent>
                    <div className="card-header">
                      <IonBadge color={getDifficultyColor(card.difficulty)}>
                        {card.difficulty}
                      </IonBadge>
                      <div className="card-actions">
                        <IonButton
                          fill="clear"
                          size="small"
                          onClick={() => openEditModal(card)}
                        >
                          <IonIcon slot="icon-only" icon={pencil} />
                        </IonButton>
                        <IonButton
                          fill="clear"
                          color="danger"
                          size="small"
                          onClick={() => confirmDelete(card.id)}
                        >
                          <IonIcon slot="icon-only" icon={trash} />
                        </IonButton>
                      </div>
                    </div>
                    <div className="card-content">
                      <div className="card-side">
                        <strong>Front:</strong>
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {card.front}
                          </ReactMarkdown>
                        </div>
                        {card.frontImage && (
                          <img src={card.frontImage} alt="Front" className="card-image" />
                        )}
                      </div>
                      <div className="card-side">
                        <strong>Back:</strong>
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {card.back}
                          </ReactMarkdown>
                        </div>
                        {card.backImage && (
                          <img src={card.backImage} alt="Back" className="card-image" />
                        )}
                      </div>
                    </div>
                    <div className="card-meta">
                      <small>
                        Next review: {card.nextReviewDate.toLocaleDateString()}
                      </small>
                      <small>Repetitions: {card.repetitions}</small>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </IonList>
          )}
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowModal(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showModal} onDidDismiss={resetForm}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{editingCard ? 'Edit Card' : 'New Card'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={resetForm}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div className="markdown-support-notice">
              <IonIcon icon={text} />
              <span>Markdown supported</span>
            </div>

            <div className="text-area-card">
              <IonItem>
                <IonLabel position="stacked">Front *</IonLabel>
                <IonTextarea
                  value={cardFront}
                  onIonInput={(e) => setCardFront(e.detail.value || '')}
                  placeholder="Enter question or front side"
                  rows={4}
                />
              </IonItem>
              {cardFront && (
                <div className="markdown-preview">
                  <IonLabel>Preview:</IonLabel>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{cardFront}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="text-area-card">
              <IonItem>
                <IonLabel position="stacked">Back *</IonLabel>
                <IonTextarea
                  value={cardBack}
                  onIonInput={(e) => setCardBack(e.detail.value || '')}
                  placeholder="Enter answer or back side"
                  rows={4}
                />
              </IonItem>
              {cardBack && (
                <div className="markdown-preview">
                  <IonLabel>Preview:</IonLabel>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{cardBack}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="form-section">
              <div className="section-header">
                <IonLabel>Answer Validation</IonLabel>
              </div>
              <IonSegment
                value={answerValidation}
                onIonChange={(e) => setAnswerValidation(e.detail.value as AnswerValidation)}
                className="validation-segment"
              >
                <IonSegmentButton value="exact">
                  <IonIcon icon={lockClosed} />
                </IonSegmentButton>
                <IonSegmentButton value="case-insensitive">
                  <IonIcon icon={lockOpen} />
                </IonSegmentButton>
                <IonSegmentButton value="typo-tolerant">
                  <IonIcon icon={text} />
                </IonSegmentButton>
                <IonSegmentButton value="keyword">
                  <IonIcon icon={key} />
                </IonSegmentButton>
                <IonSegmentButton value="flexible">
                  <IonIcon icon={checkmarkCircle} />
                </IonSegmentButton>
              </IonSegment>
              <IonText className="validation-description">
                <small>{AnswerValidationService.getValidationDescription(answerValidation)}</small>
              </IonText>
            </div>

            <div className="form-section">
              <IonItem lines="none">
                <IonLabel>Support image attachments</IonLabel>
                <IonCheckbox
                  slot="start"
                  checked={showImageUpload}
                  onIonChange={(e) => setShowImageUpload(e.detail.checked)}
                />
              </IonItem>
              
              {showImageUpload && (
                <>
                  <IonButton
                    expand="block"
                    fill="outline"
                    size="small"
                    className="attachment-button"
                  >
                    <IonIcon slot="start" icon={image} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'front')}
                      className="file-input-overlay"
                    />
                    Add Front Image
                  </IonButton>
                  {cardFrontImage && (
                    <div className="image-preview-container">
                      <img src={cardFrontImage} alt="Front preview" className="image-preview" />
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => setCardFrontImage('')}
                      >
                        Remove
                      </IonButton>
                    </div>
                  )}

                  <IonButton
                    expand="block"
                    fill="outline"
                    size="small"
                    className="attachment-button"
                  >
                    <IonIcon slot="start" icon={image} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'back')}
                      className="file-input-overlay"
                    />
                    Add Back Image
                  </IonButton>
                  {cardBackImage && (
                    <div className="image-preview-container">
                      <img src={cardBackImage} alt="Back preview" className="image-preview" />
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => setCardBackImage('')}
                      >
                        Remove
                      </IonButton>
                    </div>
                  )}
                </>
              )}
            </div>

            <IonButton
              expand="block"
              onClick={editingCard ? handleUpdateCard : handleCreateCard}
              disabled={!cardFront.trim() || !cardBack.trim()}
              className="ion-margin-top"
            >
              {editingCard ? 'Update Card' : 'Create Card'}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete Card"
          message="Are you sure you want to delete this card?"
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: handleDeleteCard,
            },
          ]}
        />

        <IonModal isOpen={showFolderModal} onDidDismiss={() => setShowFolderModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Manage Folders</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowFolderModal(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Select Folders</IonLabel>
              <IonSelect
                value={selectedFolderIds}
                multiple={true}
                onIonChange={(e) => setSelectedFolderIds(e.detail.value)}
                placeholder="Select folders (optional)"
              >
                {folders.map((folder) => (
                  <IonSelectOption key={folder.id} value={folder.id}>
                    {folder.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            {selectedFolderIds.length > 0 && (
              <div className="selected-folders">
                {selectedFolderIds.map((folderId) => {
                  const folder = folders.find((f) => f.id === folderId);
                  return folder ? (
                    <IonChip key={folderId}>
                      <IonIcon icon={folderIcon} />
                      <IonLabel>{folder.name}</IonLabel>
                    </IonChip>
                  ) : null;
                })}
              </div>
            )}
            <IonButton
              expand="block"
              onClick={handleUpdateFolders}
              className="ion-margin-top"
            >
              Update Folders
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Gap Analysis Modal */}
        <IonModal isOpen={showGapAnalysisModal} onDidDismiss={() => setShowGapAnalysisModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Deck Gap Analysis</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowGapAnalysisModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {isAnalyzing ? (
              <div className="loading-state">
                <IonSpinner />
                <p>Analyzing deck for gaps...</p>
              </div>
            ) : gapAnalysis ? (
              <>
                <IonCard>
                  <IonCardContent>
                    <h2>Analysis Results</h2>
                    <p><strong>Deck:</strong> {deck.name}</p>
                    <p><strong>Cards:</strong> {deck.cards.length}</p>
                    <p><strong>Analyzed:</strong> {gapAnalysis.analysisDate.toLocaleDateString()}</p>
                  </IonCardContent>
                </IonCard>

                {gapAnalysis.missingTopics.length > 0 && (
                  <IonCard>
                    <IonCardContent>
                      <h3>Missing Topics</h3>
                      <IonList>
                        {gapAnalysis.missingTopics.map((topic, index) => (
                          <IonItem key={index}>
                            <IonLabel>{topic}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </IonCardContent>
                  </IonCard>
                )}

                {gapAnalysis.weakAreas.length > 0 && (
                  <IonCard>
                    <IonCardContent>
                      <h3>Weak Areas (Few Cards)</h3>
                      <IonList>
                        {gapAnalysis.weakAreas.map((area, index) => (
                          <IonItem key={index}>
                            <IonLabel>{area}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </IonCardContent>
                  </IonCard>
                )}

                {gapAnalysis.suggestedCards.length > 0 && (
                  <IonCard>
                    <IonCardContent>
                      <h3>Suggested Cards: {gapAnalysis.suggestedCards.length}</h3>
                      <IonButton
                        expand="block"
                        onClick={() => setShowSuggestionsModal(true)}
                      >
                        View & Select Suggestions
                      </IonButton>
                    </IonCardContent>
                  </IonCard>
                )}
              </>
            ) : null}
          </IonContent>
        </IonModal>

        {/* Suggestions Modal */}
        <IonModal isOpen={showSuggestionsModal} onDidDismiss={() => setShowSuggestionsModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Suggested Cards</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowSuggestionsModal(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonText color="medium">
              <p>Selected: {suggestedCards.filter(c => c.selected).length}/{suggestedCards.length} cards</p>
            </IonText>
            
            <IonList>
              {suggestedCards.map(card => (
                <IonCard key={card.id}>
                  <IonCardContent>
                    <IonItem lines="none">
                      <IonCheckbox
                        slot="start"
                        checked={card.selected}
                        onIonChange={() => toggleSuggestedCard(card.id)}
                      />
                      <IonLabel className="ion-text-wrap">
                        <h3><strong>Q:</strong> {card.front}</h3>
                        <p><strong>A:</strong> {card.back.substring(0, 150)}...</p>
                        {card.explanation && (
                          <p><em>{card.explanation}</em></p>
                        )}
                        <IonBadge color={
                          card.difficulty === 'easy' ? 'success' :
                          card.difficulty === 'medium' ? 'warning' :
                          'danger'
                        }>
                          {card.difficulty}
                        </IonBadge>
                      </IonLabel>
                    </IonItem>
                  </IonCardContent>
                </IonCard>
              ))}
            </IonList>

            <IonButton
              expand="block"
              onClick={handleAddSuggestedCards}
              disabled={!suggestedCards.some(c => c.selected)}
              className="ion-margin-top"
            >
              <IonIcon slot="start" icon={checkmark} />
              Add Selected Cards ({suggestedCards.filter(c => c.selected).length})
            </IonButton>
          </IonContent>
        </IonModal>

        {/* AI Card Generation Modal */}
        <IonModal isOpen={showAIGenerateModal} onDidDismiss={() => setShowAIGenerateModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Generate AI Flashcards</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowAIGenerateModal(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonCard>
              <IonCardContent>
                <p>Generate flashcards using AI for this deck.</p>
              </IonCardContent>
            </IonCard>

            <IonItem>
              <IonLabel position="stacked">Topic (optional)</IonLabel>
              <IonInput
                value={aiCardTopic}
                onIonInput={(e) => setAICardTopic(e.detail.value || '')}
                placeholder={`e.g., Advanced concepts in ${deck.name}`}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Number of Cards</IonLabel>
              <IonSelect
                value={aiCardCount}
                onIonChange={(e) => setAICardCount(e.detail.value)}
              >
                <IonSelectOption value={5}>5 cards</IonSelectOption>
                <IonSelectOption value={10}>10 cards</IonSelectOption>
                <IonSelectOption value={15}>15 cards</IonSelectOption>
                <IonSelectOption value={20}>20 cards</IonSelectOption>
                <IonSelectOption value={25}>25 cards</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonButton
              expand="block"
              onClick={handleGenerateAICards}
              disabled={isGeneratingAICards}
              className="ion-margin-top"
            >
              {isGeneratingAICards ? (
                <>
                  <IonSpinner slot="start" />
                  Generating...
                </>
              ) : (
                <>
                  <IonIcon slot="start" icon={sparkles} />
                  Generate Cards
                </>
              )}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default DeckDetail;