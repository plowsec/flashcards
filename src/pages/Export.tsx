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
  IonList,
  IonItem,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonToast,
} from '@ionic/react';
import { getDataRepository } from '../repositories';
import { Deck } from '../types';
import './Export.css';

const Export: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const history = useHistory();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [exportType, setExportType] = useState<'single' | 'all'>('single');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const repository = getDataRepository();

  useEffect(() => {
    if (id) {
      loadDeck();
    }
  }, [id]);

  const loadDeck = async () => {
    if (!id) return;
    const loadedDeck = await repository.getDeckById(id);
    if (!loadedDeck) {
      history.push('/decks');
      return;
    }
    setDeck(loadedDeck);
  };

  const handleExport = async () => {
    try {
      let data: any;
      let filename: string;

      if (exportType === 'single' && deck) {
        data = await repository.exportDeck(deck.id);
        filename = `${deck.name.replace(/[^a-z0-9]/gi, '_')}_deck.json`;
      } else {
        data = await repository.exportAllData();
        filename = `flashcards_backup_${new Date().toISOString().split('T')[0]}.json`;
      }

      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToastMessage('Export successful!');
      setShowToast(true);
    } catch (error) {
      console.error('Export error:', error);
      setToastMessage('Export failed. Please try again.');
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
          <IonTitle>Export Data</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="export-container">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Export Options</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonRadioGroup
                value={exportType}
                onIonChange={(e) => setExportType(e.detail.value)}
              >
                <IonList>
                  {deck && (
                    <IonItem>
                      <IonLabel>
                        <h2>Export This Deck</h2>
                        <p>Export only "{deck.name}" with all its cards</p>
                      </IonLabel>
                      <IonRadio slot="start" value="single" />
                    </IonItem>
                  )}
                  <IonItem>
                    <IonLabel>
                      <h2>Export All Data</h2>
                      <p>Export all decks and cards as a backup</p>
                    </IonLabel>
                    <IonRadio slot="start" value="all" />
                  </IonItem>
                </IonList>
              </IonRadioGroup>

              <div className="export-info">
                <h3>Export Format</h3>
                <p>
                  Data will be exported as a JSON file that can be imported later.
                  This includes all card content, images (as base64), and study
                  progress.
                </p>
              </div>

              <IonButton expand="block" onClick={handleExport} className="ion-margin-top">
                Export Data
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Export;