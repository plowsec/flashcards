import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonFabList,
  IonModal,
  IonInput,
  IonTextarea,
  IonButtons,
  IonAlert,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonBadge,
  IonChip,
  IonSelect,
  IonSelectOption,
  IonBreadcrumbs,
  IonBreadcrumb,
} from '@ionic/react';
import { add, trash, pencil, play, folder as folderIcon, cloudUpload, settings, folderOpen, chevronForward } from 'ionicons/icons';
import { getDataRepository } from '../repositories';
import { Deck, Folder } from '../types';
import { SpacedRepetitionService } from '../services/SpacedRepetitionService';
import FolderManager from '../components/FolderManager';
import './Decks.css';

const Decks: React.FC = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);

  const repository = getDataRepository();

  useEffect(() => {
    loadData();
  }, [currentFolderId]);

  const loadData = async () => {
    const loadedDecks = await repository.getAllDecks();
    const loadedFolders = await repository.getAllFolders();
    setDecks(loadedDecks);
    setFolders(loadedFolders);
  };

  const handleCreateDeck = async () => {
    if (!deckName.trim()) return;

    try {
      const folderIdsToUse = currentFolderId ? [currentFolderId, ...selectedFolderIds] : selectedFolderIds;
      await repository.createDeck({
        name: deckName,
        description: deckDescription,
        cards: [],
        folderIds: folderIdsToUse,
      });
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error creating deck:', error);
    }
  };

  const handleUpdateDeck = async () => {
    if (!editingDeck || !deckName.trim()) return;

    try {
      await repository.updateDeck(editingDeck.id, {
        name: deckName,
        description: deckDescription,
        folderIds: selectedFolderIds,
      });
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error updating deck:', error);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckToDelete) return;

    try {
      await repository.deleteDeck(deckToDelete);
      await loadData();
      setDeckToDelete(null);
    } catch (error) {
      console.error('Error deleting deck:', error);
    }
  };

  const openEditModal = (deck: Deck) => {
    setEditingDeck(deck);
    setDeckName(deck.name);
    setDeckDescription(deck.description);
    setSelectedFolderIds(deck.folderIds || []);
    setShowModal(true);
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingDeck(null);
    setDeckName('');
    setDeckDescription('');
    setSelectedFolderIds([]);
  };

  const confirmDelete = (deckId: string) => {
    setDeckToDelete(deckId);
    setShowDeleteAlert(true);
  };

  const getDeckStats = (deck: Deck) => {
    return SpacedRepetitionService.getStudyStats(deck.cards);
  };

  const getCurrentFolderChildren = () => {
    return folders.filter((f) => f.parentId === currentFolderId);
  };

  const getDecksInCurrentFolder = () => {
    if (currentFolderId === null) {
      // Root level: show decks with no folders or decks in root folders
      return decks.filter((d) => {
        const deckFolderIds = d.folderIds || [];
        return deckFolderIds.length === 0 || deckFolderIds.some(fid => {
          const folder = folders.find(f => f.id === fid);
          return folder && folder.parentId === null;
        });
      });
    }
    return decks.filter((d) => (d.folderIds || []).includes(currentFolderId));
  };

  const getBreadcrumbs = () => {
    const breadcrumbs: Folder[] = [];
    let currentId = currentFolderId;
    
    while (currentId) {
      const folder = folders.find((f) => f.id === currentId);
      if (folder) {
        breadcrumbs.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    
    return breadcrumbs;
  };

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{currentFolder ? currentFolder.name : 'My Decks'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowFolderManager(true)}>
              <IonIcon slot="icon-only" icon={folderOpen} />
            </IonButton>
            <IonButton routerLink="/settings">
              <IonIcon slot="icon-only" icon={settings} />
            </IonButton>
            <IonButton routerLink="/import">
              <IonIcon slot="icon-only" icon={cloudUpload} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {getBreadcrumbs().length > 0 && (
          <IonToolbar>
            <IonBreadcrumbs>
              <IonBreadcrumb onClick={() => handleBreadcrumbClick(null)}>
                Home
              </IonBreadcrumb>
              {getBreadcrumbs().map((folder) => (
                <IonBreadcrumb
                  key={folder.id}
                  onClick={() => handleBreadcrumbClick(folder.id)}
                >
                  {folder.name}
                </IonBreadcrumb>
              ))}
            </IonBreadcrumbs>
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">My Decks</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Folders Section */}
        {getCurrentFolderChildren().length > 0 && (
          <div className="folders-section">
            <h3 className="section-title">Folders</h3>
            <div className="folders-grid">
              {getCurrentFolderChildren().map((folder) => (
                <IonCard
                  key={folder.id}
                  className="folder-card"
                  onClick={() => handleFolderClick(folder.id)}
                >
                  <IonCardContent>
                    <div className="folder-card-content">
                      <IonIcon icon={folderIcon} className="folder-icon" />
                      <div>
                        <h3>{folder.name}</h3>
                        {folder.description && <p>{folder.description}</p>}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          </div>
        )}

        {/* Decks Section */}
        {getDecksInCurrentFolder().length === 0 && getCurrentFolderChildren().length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={folderIcon} className="empty-icon" />
            <h2>Nothing Here Yet</h2>
            <p>Create a deck or folder to get started!</p>
          </div>
        ) : (
          <div className="decks-container">
            {getDecksInCurrentFolder().length > 0 && (
              <h3 className="section-title">Decks</h3>
            )}
            {getDecksInCurrentFolder().map((deck) => {
              const stats = getDeckStats(deck);
              return (
                <IonCard key={deck.id} className="deck-card">
                  <IonCardHeader>
                    <IonCardTitle>{deck.name}</IonCardTitle>
                    <IonCardSubtitle>{deck.description}</IonCardSubtitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="deck-stats">
                      <IonBadge color="primary">{stats.total} cards</IonBadge>
                      <IonBadge color="warning">{stats.due} due</IonBadge>
                      <IonBadge color="success">{stats.new} new</IonBadge>
                      <IonBadge color="medium">{stats.learning} learning</IonBadge>
                    </div>
                    <div className="deck-actions">
                      <IonButton
                        routerLink={`/deck/${deck.id}`}
                        fill="solid"
                        size="small"
                      >
                        <IonIcon slot="start" icon={folderIcon} />
                        View
                      </IonButton>
                      <IonButton
                        routerLink={`/study/${deck.id}`}
                        fill="solid"
                        color="success"
                        size="small"
                        disabled={stats.total === 0}
                      >
                        <IonIcon slot="start" icon={play} />
                        Study
                      </IonButton>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => openEditModal(deck)}
                      >
                        <IonIcon slot="icon-only" icon={pencil} />
                      </IonButton>
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={() => confirmDelete(deck.id)}
                      >
                        <IonIcon slot="icon-only" icon={trash} />
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton>
            <IonIcon icon={add} />
          </IonFabButton>
          <IonFabList side="top">
            <IonFabButton onClick={() => setShowModal(true)} data-desc="New Deck">
              <IonIcon icon={add} />
            </IonFabButton>
            <IonFabButton onClick={() => setShowFolderManager(true)} data-desc="Manage Folders">
              <IonIcon icon={folderIcon} />
            </IonFabButton>
          </IonFabList>
        </IonFab>

        <IonModal isOpen={showModal} onDidDismiss={resetForm}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{editingDeck ? 'Edit Deck' : 'New Deck'}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={resetForm}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Deck Name *</IonLabel>
              <IonInput
                value={deckName}
                onIonInput={(e) => setDeckName(e.detail.value || '')}
                placeholder="Enter deck name"
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Description</IonLabel>
              <IonTextarea
                value={deckDescription}
                onIonInput={(e) => setDeckDescription(e.detail.value || '')}
                placeholder="Enter deck description"
                rows={4}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Folders</IonLabel>
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
              onClick={editingDeck ? handleUpdateDeck : handleCreateDeck}
              disabled={!deckName.trim()}
              className="ion-margin-top"
            >
              {editingDeck ? 'Update Deck' : 'Create Deck'}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete Deck"
          message="Are you sure you want to delete this deck? This action cannot be undone."
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: handleDeleteDeck,
            },
          ]}
        />

        <FolderManager
          isOpen={showFolderManager}
          onClose={() => {
            setShowFolderManager(false);
            loadData();
          }}
          currentFolderId={currentFolderId}
          onFolderSelect={(folderId) => {
            setCurrentFolderId(folderId);
            setShowFolderManager(false);
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Decks;