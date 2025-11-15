import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonText,
  IonToast,
} from '@ionic/react';
import { save, key, checkmarkCircle, closeCircle } from 'ionicons/icons';
import { openAIService } from '../services/OpenAIService';
import './Settings.css';

const Settings: React.FC = () => {
  const history = useHistory();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  useEffect(() => {
    const existingKey = openAIService.getApiKey();
    if (existingKey) {
      setHasExistingKey(true);
      // Show masked version
      setApiKey('••••••••••••••••••••••••••••••••••••••••');
    }
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKey || apiKey.includes('•')) {
      setToastMessage('Please enter a valid API key');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setToastMessage('OpenAI API keys should start with "sk-"');
      setToastColor('danger');
      setShowToast(true);
      return;
    }

    openAIService.setApiKey(apiKey);
    setHasExistingKey(true);
    setToastMessage('API key saved successfully!');
    setToastColor('success');
    setShowToast(true);
    
    // Mask the key after saving
    setTimeout(() => {
      setApiKey('••••••••••••••••••••••••••••••••••••••••');
      setShowKey(false);
    }, 1000);
  };

  const handleClearApiKey = () => {
    openAIService.clearApiKey();
    setApiKey('');
    setHasExistingKey(false);
    setToastMessage('API key cleared');
    setToastColor('success');
    setShowToast(true);
  };

  const handleInputFocus = () => {
    if (hasExistingKey && apiKey.includes('•')) {
      setApiKey('');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/decks" />
          </IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="settings-container">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={key} /> OpenAI API Configuration
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="api-key-status">
                {hasExistingKey ? (
                  <div className="status-indicator success">
                    <IonIcon icon={checkmarkCircle} />
                    <span>API Key Configured</span>
                  </div>
                ) : (
                  <div className="status-indicator warning">
                    <IonIcon icon={closeCircle} />
                    <span>No API Key Configured</span>
                  </div>
                )}
              </div>

              <IonText color="medium">
                <p className="info-text">
                  Configure your OpenAI API key to enable AI-powered features:
                </p>
                <ul className="feature-list">
                  <li>AI explanations for flashcards</li>
                  <li>Follow-up questions and answers</li>
                  <li>Smart multiple choice with confusing options</li>
                </ul>
              </IonText>

              <IonItem className="api-key-input">
                <IonLabel position="stacked">OpenAI API Key</IonLabel>
                <IonInput
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onIonInput={(e) => setApiKey(e.detail.value || '')}
                  onIonFocus={handleInputFocus}
                  placeholder="sk-..."
                  className="monospace-input"
                />
              </IonItem>

              <div className="button-group">
                <IonButton
                  expand="block"
                  onClick={handleSaveApiKey}
                  disabled={!apiKey || apiKey.includes('•')}
                >
                  <IonIcon slot="start" icon={save} />
                  Save API Key
                </IonButton>

                {hasExistingKey && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    color="danger"
                    onClick={handleClearApiKey}
                  >
                    Clear API Key
                  </IonButton>
                )}
              </div>

              <IonText color="medium">
                <p className="help-text">
                  <strong>How to get an API key:</strong>
                  <br />
                  1. Visit{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    platform.openai.com/api-keys
                  </a>
                  <br />
                  2. Sign in or create an account
                  <br />
                  3. Click "Create new secret key"
                  <br />
                  4. Copy the key and paste it here
                </p>
                <p className="help-text">
                  <strong>Privacy:</strong> Your API key is stored locally in your browser
                  and never sent to our servers. It's only used to communicate directly
                  with OpenAI's API.
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          color={toastColor}
        />
      </IonContent>
    </IonPage>
  );
};

export default Settings;