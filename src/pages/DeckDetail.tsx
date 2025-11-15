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
} from '@ionic/react';
import { add, trash, pencil, play, download, cloudUpload, folder as folderIcon } from 'ionicons/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDataRepository } from '../repositories';
import { Deck, Card, SortOption, AnswerValidation, Folder } from '../types';
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
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const repository = getDataRepository();

  useEffect(() => {
    loadDeck();
    loadFolders();
  }, [id]);

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
    const values = { unknown: 0, hard: 1, medium: 2, easy: 3 };
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
              <IonSelect
                value={sortOption}
                onIonChange={(e) => setSortOption(e.detail.value)}
              >
                <IonSelectOption value="createdAt-desc">Newest First</IonSelectOption>
                <IonSelectOption value="createdAt-asc">Oldest First</IonSelectOption>
                <IonSelectOption value="difficulty-desc">Hardest First</IonSelectOption>
                <IonSelectOption value="difficulty-asc">Easiest First</IonSelectOption>
                <IonSelectOption value="nextReview-asc">Due Soonest</IonSelectOption>
                <IonSelectOption value="nextReview-desc">Due Latest</IonSelectOption>
              </IonSelect>
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
            <IonItem>
              <IonLabel position="stacked">Front (Markdown supported) *</IonLabel>
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
            <IonItem>
              <IonLabel>Front Image (optional)</IonLabel>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'front')}
              />
            </IonItem>
            {cardFrontImage && (
              <img src={cardFrontImage} alt="Front preview" className="image-preview" />
            )}

            <IonItem>
              <IonLabel position="stacked">Back (Markdown supported) *</IonLabel>
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
            <IonItem>
              <IonLabel>Back Image (optional)</IonLabel>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'back')}
              />
            </IonItem>
            {cardBackImage && (
              <img src={cardBackImage} alt="Back preview" className="image-preview" />
            )}

            <IonItem>
              <IonLabel position="stacked">Answer Validation</IonLabel>
              <IonSelect
                value={answerValidation}
                onIonChange={(e) => setAnswerValidation(e.detail.value)}
              >
                <IonSelectOption value="exact">Exact Match</IonSelectOption>
                <IonSelectOption value="case-insensitive">Case Insensitive</IonSelectOption>
                <IonSelectOption value="typo-tolerant">Typo Tolerant</IonSelectOption>
                <IonSelectOption value="keyword">Keyword Match</IonSelectOption>
                <IonSelectOption value="flexible">Flexible (Recommended)</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonText color="medium" className="validation-description">
              <small>{AnswerValidationService.getValidationDescription(answerValidation)}</small>
            </IonText>

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
      </IonContent>
    </IonPage>
  );
};

export default DeckDetail;