import React, { useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonList,
  IonIcon,
  IonAlert,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { trash, pencil, add, folder as folderIcon, move } from 'ionicons/icons';
import { Folder } from '../types';
import { getDataRepository } from '../repositories';
import './FolderManager.css';

interface FolderManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  onFolderSelect?: (folderId: string | null) => void;
}

const FolderManager: React.FC<FolderManagerProps> = ({
  isOpen,
  onClose,
  currentFolderId,
  onFolderSelect,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const repository = getDataRepository();

  React.useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, currentFolderId]);

  const loadFolders = async () => {
    const allFolders = await repository.getAllFolders();
    setFolders(allFolders);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      await repository.createFolder({
        name: folderName,
        description: folderDescription,
        parentId: currentFolderId,
      });
      await loadFolders();
      resetForm();
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !folderName.trim()) return;

    try {
      await repository.updateFolder(editingFolder.id, {
        name: folderName,
        description: folderDescription,
      });
      await loadFolders();
      resetForm();
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      await repository.deleteFolder(folderToDelete);
      await loadFolders();
      setFolderToDelete(null);
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleMoveFolder = async () => {
    if (!folderToMove) return;

    try {
      await repository.updateFolder(folderToMove.id, {
        parentId: targetParentId,
      });
      await loadFolders();
      setShowMoveModal(false);
      setFolderToMove(null);
      setTargetParentId(null);
    } catch (error) {
      console.error('Error moving folder:', error);
    }
  };

  const openMoveModal = (folder: Folder) => {
    setFolderToMove(folder);
    setTargetParentId(folder.parentId);
    setShowMoveModal(true);
  };

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || '');
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setEditingFolder(null);
    setFolderName('');
    setFolderDescription('');
  };

  const confirmDelete = (folderId: string) => {
    setFolderToDelete(folderId);
    setShowDeleteAlert(true);
  };

  const getCurrentFolderChildren = () => {
    return folders.filter((f) => f.parentId === currentFolderId);
  };

  const handleFolderClick = (folderId: string) => {
    if (onFolderSelect) {
      onFolderSelect(folderId);
    }
  };

  const handleBackClick = () => {
    if (currentFolderId && onFolderSelect) {
      const currentFolder = folders.find((f) => f.id === currentFolderId);
      onFolderSelect(currentFolder?.parentId || null);
    }
  };

  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              {currentFolder ? currentFolder.name : 'Folders'}
            </IonTitle>
            <IonButtons slot="start">
              {currentFolderId && (
                <IonButton onClick={handleBackClick}>Back</IonButton>
              )}
            </IonButtons>
            <IonButtons slot="end">
              <IonButton onClick={onClose}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="folder-manager">
            <IonButton
              expand="block"
              onClick={() => setShowCreateModal(true)}
              className="ion-margin-bottom"
            >
              <IonIcon slot="start" icon={add} />
              Create Subfolder
            </IonButton>

            <IonList>
              {getCurrentFolderChildren().length === 0 ? (
                <div className="empty-state">
                  <IonIcon icon={folderIcon} className="empty-icon" />
                  <p>No subfolders yet</p>
                </div>
              ) : (
                getCurrentFolderChildren().map((folder) => (
                  <IonItem key={folder.id} className="folder-item">
                    <IonIcon icon={folderIcon} slot="start" />
                    <IonLabel onClick={() => handleFolderClick(folder.id)}>
                      <h2>{folder.name}</h2>
                      {folder.description && <p>{folder.description}</p>}
                    </IonLabel>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => openMoveModal(folder)}
                      title="Move folder"
                    >
                      <IonIcon slot="icon-only" icon={move} />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => openEditModal(folder)}
                      title="Edit folder"
                    >
                      <IonIcon slot="icon-only" icon={pencil} />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      color="danger"
                      size="small"
                      onClick={() => confirmDelete(folder.id)}
                      title="Delete folder"
                    >
                      <IonIcon slot="icon-only" icon={trash} />
                    </IonButton>
                  </IonItem>
                ))
              )}
            </IonList>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showCreateModal} onDidDismiss={resetForm}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>
              {editingFolder ? 'Edit Folder' : 'New Folder'}
            </IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={resetForm}>Cancel</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonItem>
            <IonLabel position="stacked">Folder Name *</IonLabel>
            <IonInput
              value={folderName}
              onIonInput={(e) => setFolderName(e.detail.value || '')}
              placeholder="Enter folder name"
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Description</IonLabel>
            <IonTextarea
              value={folderDescription}
              onIonInput={(e) => setFolderDescription(e.detail.value || '')}
              placeholder="Enter folder description"
              rows={4}
            />
          </IonItem>
          <IonButton
            expand="block"
            onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
            disabled={!folderName.trim()}
            className="ion-margin-top"
          >
            {editingFolder ? 'Update Folder' : 'Create Folder'}
          </IonButton>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showMoveModal} onDidDismiss={() => setShowMoveModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Move Folder</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowMoveModal(false)}>Cancel</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {folderToMove && (
            <>
              <IonItem>
                <IonLabel>
                  <h2>Moving: {folderToMove.name}</h2>
                  <p>Select a new parent folder or move to top level</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Move to</IonLabel>
                <IonSelect
                  value={targetParentId}
                  onIonChange={(e) => setTargetParentId(e.detail.value)}
                  placeholder="Select parent folder"
                >
                  <IonSelectOption value={null}>Top Level (No Parent)</IonSelectOption>
                  {folders
                    .filter(f =>
                      // Don't allow moving to itself or its own children
                      f.id !== folderToMove.id &&
                      !isDescendant(f.id, folderToMove.id, folders)
                    )
                    .map(folder => (
                      <IonSelectOption key={folder.id} value={folder.id}>
                        {getFolderPath(folder.id, folders)}
                      </IonSelectOption>
                    ))}
                </IonSelect>
              </IonItem>

              <IonButton
                expand="block"
                onClick={handleMoveFolder}
                className="ion-margin-top"
              >
                Move Folder
              </IonButton>
            </>
          )}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={showDeleteAlert}
        onDidDismiss={() => setShowDeleteAlert(false)}
        header="Delete Folder"
        message="Are you sure you want to delete this folder? All subfolders will also be deleted. Decks in this folder will not be deleted."
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: handleDeleteFolder,
          },
        ]}
      />
    </>
  );
};

// Helper function to check if a folder is a descendant of another
function isDescendant(folderId: string, ancestorId: string, folders: Folder[]): boolean {
  const folder = folders.find(f => f.id === folderId);
  if (!folder || !folder.parentId) return false;
  if (folder.parentId === ancestorId) return true;
  return isDescendant(folder.parentId, ancestorId, folders);
}

// Helper function to get the full path of a folder
function getFolderPath(folderId: string, folders: Folder[]): string {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return '';
  
  if (!folder.parentId) return folder.name;
  
  const parentPath = getFolderPath(folder.parentId, folders);
  return parentPath ? `${parentPath} / ${folder.name}` : folder.name;
}

export default FolderManager;