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
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonTextarea,
  IonToast,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonRadioGroup,
  IonRadio,
} from '@ionic/react';
import { getDataRepository } from '../repositories';
import { ExportData, Deck, BulkImportData } from '../types';
import './Import.css';

const Import: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const history = useHistory();
  const [importMode, setImportMode] = useState<'file' | 'bulk'>('file');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [importTarget, setImportTarget] = useState<'new' | 'existing'>('new');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');

  const repository = getDataRepository();

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    const loadedDecks = await repository.getAllDecks();
    setDecks(loadedDecks);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Check if it's a full export or single deck
      if (data.version && data.decks) {
        // Full export
        await repository.importData(data as ExportData);
        setToastMessage('All data imported successfully!');
      } else if (data.id && data.name && data.cards) {
        // Single deck
        await repository.importDeck(data as Deck);
        setToastMessage('Deck imported successfully!');
      } else {
        throw new Error('Invalid file format');
      }

      setShowToast(true);
      setTimeout(() => {
        history.push('/decks');
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      setToastMessage('Import failed. Please check the file format.');
      setShowToast(true);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      setToastMessage('Please provide card data');
      setShowToast(true);
      return;
    }

    if (importTarget === 'new' && !deckName.trim()) {
      setToastMessage('Please provide a deck name for the new deck');
      setShowToast(true);
      return;
    }

    if (importTarget === 'existing' && !selectedDeckId) {
      setToastMessage('Please select a deck to import into');
      setShowToast(true);
      return;
    }

    try {
      // Parse bulk text - expecting format:
      // front text | back text
      // or with images:
      // front text | back text | front_image_url | back_image_url
      const lines = bulkText.split('\n').filter(line => line.trim());
      const cards = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 2) {
          throw new Error('Each line must have at least front and back separated by |');
        }
        return {
          front: parts[0],
          back: parts[1],
          frontImage: parts[2] || undefined,
          backImage: parts[3] || undefined,
        };
      });

      const bulkData: BulkImportData = {
        deckName: importTarget === 'new' ? deckName : '',
        cards,
      };

      // Create deck if importing to new deck, or use existing
      let targetDeckId = id || selectedDeckId;
      if (importTarget === 'new' || !targetDeckId) {
        const newDeck = await repository.createDeck({
          name: deckName,
          description: `Bulk imported ${cards.length} cards`,
          cards: [],
        });
        targetDeckId = newDeck.id;
      }

      await repository.bulkImportCards(targetDeckId, bulkData);

      setToastMessage(`Successfully imported ${cards.length} cards!`);
      setShowToast(true);
      setTimeout(() => {
        history.push(`/deck/${targetDeckId}`);
      }, 2000);
    } catch (error: any) {
      console.error('Bulk import error:', error);
      setToastMessage(error.message || 'Bulk import failed. Please check the format.');
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={id ? `/deck/${id}` : '/decks'} />
          </IonButtons>
          <IonTitle>Import Data</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="import-container">
          <IonSegment
            value={importMode}
            onIonChange={(e) => setImportMode(e.detail.value as 'file' | 'bulk')}
          >
            <IonSegmentButton value="file">
              <IonLabel>Import File</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="bulk">
              <IonLabel>Bulk Import</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {importMode === 'file' ? (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Import from File</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="import-info">
                  <p>
                    Import a previously exported JSON file containing decks and cards.
                    This can be a single deck or a full backup.
                  </p>
                </div>

                <div className="file-input-wrapper">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="file-input-label">
                    Choose File
                  </label>
                </div>
              </IonCardContent>
            </IonCard>
          ) : (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Bulk Import Cards</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="import-info">
                  <h3>Format Instructions</h3>
                  <p>Enter one card per line in the following format:</p>
                  <code>front text | back text</code>
                  <p>Or with images:</p>
                  <code>front text | back text | front_image_url | back_image_url</code>
                  <p className="example-label">Example:</p>
                  <pre className="example-code">
What is React? | A JavaScript library for building user interfaces
What is TypeScript? | A typed superset of JavaScript
                  </pre>
                </div>

                <IonRadioGroup value={importTarget} onIonChange={(e) => setImportTarget(e.detail.value)}>
                  <IonItem>
                    <IonLabel>Create New Deck</IonLabel>
                    <IonRadio slot="start" value="new" />
                  </IonItem>
                  <IonItem>
                    <IonLabel>Import to Existing Deck</IonLabel>
                    <IonRadio slot="start" value="existing" />
                  </IonItem>
                </IonRadioGroup>

                {importTarget === 'new' ? (
                  <IonItem>
                    <IonLabel position="stacked">New Deck Name *</IonLabel>
                    <IonInput
                      value={deckName}
                      onIonInput={(e) => setDeckName(e.detail.value || '')}
                      placeholder="Enter deck name"
                    />
                  </IonItem>
                ) : (
                  <IonItem>
                    <IonLabel position="stacked">Select Deck *</IonLabel>
                    <IonSelect
                      value={selectedDeckId}
                      onIonChange={(e) => setSelectedDeckId(e.detail.value)}
                      placeholder="Choose a deck"
                    >
                      {decks.map((deck) => (
                        <IonSelectOption key={deck.id} value={deck.id}>
                          {deck.name} ({deck.cards.length} cards)
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                )}

                <IonItem>
                  <IonLabel position="stacked">Card Data *</IonLabel>
                  <IonTextarea
                    value={bulkText}
                    onIonInput={(e) => setBulkText(e.detail.value || '')}
                    placeholder="Paste your card data here..."
                    rows={10}
                    className="bulk-textarea"
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  onClick={handleBulkImport}
                  disabled={
                    !bulkText.trim() ||
                    (importTarget === 'new' && !deckName.trim()) ||
                    (importTarget === 'existing' && !selectedDeckId)
                  }
                  className="ion-margin-top"
                >
                  Import Cards
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Import;