import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonList,
  IonSpinner,
  IonAlert,
  IonCheckbox,
  IonBadge,
  IonProgressBar,
  IonText,
} from '@ionic/react';
import { arrowBack, arrowForward, sparkles, checkmark, close, refresh } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { 
  SubjectType, 
  DeckTemplate, 
  CourseOutlineNode, 
  CourseOutline,
  GeneratedCard 
} from '../types';
import { openAIService } from '../services/OpenAIService';
import { templateService } from '../services/TemplateService';
import { getDataRepository } from '../repositories';
import { v4 as uuidv4 } from 'uuid';
import './CourseBuilder.css';

type WizardStage = 'subject' | 'template' | 'outline' | 'structure' | 'cards';

const CourseBuilder: React.FC = () => {
  const history = useHistory();
  const repository = getDataRepository();

  // Wizard state
  const [currentStage, setCurrentStage] = useState<WizardStage>('subject');
  
  // Stage 1: Subject selection
  const [subject, setSubject] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [subjectType, setSubjectType] = useState<SubjectType>('general');
  
  // Stage 2: Template selection
  const [templates, setTemplates] = useState<DeckTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DeckTemplate | null>(null);
  
  // Stage 3: Outline generation
  const [outline, setOutline] = useState<CourseOutlineNode[]>([]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [outlineFeedback, setOutlineFeedback] = useState('');
  
  // Stage 4: Structure creation
  const [generateCardsNow, setGenerateCardsNow] = useState(false);
  const [isCreatingStructure, setIsCreatingStructure] = useState(false);
  
  // Stage 5: Card generation
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [createdDeckIds, setCreatedDeckIds] = useState<Map<string, string>>(new Map());
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  
  // Error handling
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadTemplates();
    checkApiKey();
  }, []);

  const checkApiKey = () => {
    if (!openAIService.hasApiKey()) {
      setErrorMessage('OpenAI API key not configured. Please set it in Settings.');
      setShowError(true);
    }
  };

  const loadTemplates = async () => {
    try {
      const allTemplates = await templateService.getAllTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setErrorMessage('Failed to load templates');
      setShowError(true);
    }
  };

  const handleGenerateOutline = async () => {
    if (!subject.trim()) return;
    
    setIsGeneratingOutline(true);
    try {
      const generatedOutline = await openAIService.generateCourseOutline(
        subject,
        subjectType,
        subjectDescription,
        3,
        4
      );
      setOutline(generatedOutline);
    } catch (error: any) {
      console.error('Error generating outline:', error);
      setErrorMessage(error.message || 'Failed to generate course outline');
      setShowError(true);
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleRefineOutline = async () => {
    if (!outlineFeedback.trim()) return;
    
    setIsGeneratingOutline(true);
    setShowFeedbackModal(false);
    try {
      const refinedOutline = await openAIService.refineCourseOutline(
        outline,
        outlineFeedback
      );
      setOutline(refinedOutline);
      setOutlineFeedback('');
    } catch (error: any) {
      console.error('Error refining outline:', error);
      setErrorMessage(error.message || 'Failed to refine outline');
      setShowError(true);
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const getAllLeafNodes = (nodes: CourseOutlineNode[]): CourseOutlineNode[] => {
    let leafNodes: CourseOutlineNode[] = [];
    
    const traverse = (node: CourseOutlineNode) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      } else {
        leafNodes.push(node);
      }
    };
    
    nodes.forEach(traverse);
    return leafNodes;
  };

  const createFolderStructure = async (
    nodes: CourseOutlineNode[],
    parentFolderId: string | null = null
  ): Promise<void> => {
    for (const node of nodes) {
      // Create folder for this node
      const folder = await repository.createFolder({
        name: node.title,
        description: node.description,
        parentId: parentFolderId,
      });
      
      // If this is a leaf node, create a deck
      if (!node.children || node.children.length === 0) {
        const deck = await repository.createDeck({
          name: node.title,
          description: node.description,
          cards: [],
          folderIds: [folder.id],
        });
        
        // Store the mapping of node ID to deck ID
        setCreatedDeckIds(prev => new Map(prev).set(node.id, deck.id));
      } else {
        // Recursively create subfolders and decks
        await createFolderStructure(node.children, folder.id);
      }
    }
  };

  const handleCreateStructure = async () => {
    setIsCreatingStructure(true);
    try {
      // Create a top-level folder for the entire course using the subject name
      const courseFolder = await repository.createFolder({
        name: subject,
        description: subjectDescription || `Course: ${subject}`,
        parentId: null,
      });
      
      // Create the folder and deck structure inside the course folder
      await createFolderStructure(outline, courseFolder.id);
      
      if (generateCardsNow) {
        // Move to card generation stage
        setCurrentStage('cards');
        setCurrentNodeIndex(0);
      } else {
        // Done - redirect to decks
        history.push('/decks');
      }
    } catch (error: any) {
      console.error('Error creating structure:', error);
      setErrorMessage(error.message || 'Failed to create structure');
      setShowError(true);
    } finally {
      setIsCreatingStructure(false);
    }
  };

  const handleGenerateCards = async () => {
    if (!selectedTemplate) return;
    
    const leafNodes = getAllLeafNodes(outline);
    if (currentNodeIndex >= leafNodes.length) return;
    
    const currentNode = leafNodes[currentNodeIndex];
    
    setIsGeneratingCards(true);
    try {
      const cards = await openAIService.generateFlashcardsForTopic(
        currentNode,
        selectedTemplate,
        currentNode.estimatedCardCount || 15
      );
      setGeneratedCards(cards);
    } catch (error: any) {
      console.error('Error generating cards:', error);
      setErrorMessage(error.message || 'Failed to generate flashcards');
      setShowError(true);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleAddSelectedCards = async () => {
    const leafNodes = getAllLeafNodes(outline);
    const currentNode = leafNodes[currentNodeIndex];
    const deckId = createdDeckIds.get(currentNode.id);
    
    if (!deckId) {
      setErrorMessage('Deck not found for this topic');
      setShowError(true);
      return;
    }
    
    try {
      // Add selected cards to the deck
      const selectedCards = generatedCards.filter(card => card.selected);
      
      for (const card of selectedCards) {
        await repository.createCard(deckId, {
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
      
      // Mark topic as completed
      setCompletedTopics(prev => new Set(prev).add(currentNode.id));
      
      // Move to next node or finish
      if (currentNodeIndex < leafNodes.length - 1) {
        setCurrentNodeIndex(currentNodeIndex + 1);
        setGeneratedCards([]);
      } else {
        // All done!
        history.push('/decks');
      }
    } catch (error: any) {
      console.error('Error adding cards:', error);
      setErrorMessage(error.message || 'Failed to add cards');
      setShowError(true);
    }
  };

  const handleSkipTopic = () => {
    const leafNodes = getAllLeafNodes(outline);
    
    // Move to next node or finish
    if (currentNodeIndex < leafNodes.length - 1) {
      setCurrentNodeIndex(currentNodeIndex + 1);
      setGeneratedCards([]);
    } else {
      // All done!
      history.push('/decks');
    }
  };

  const handleFinishEarly = () => {
    history.push('/decks');
  };

  const toggleCardSelection = (cardId: string) => {
    setGeneratedCards(cards =>
      cards.map(card =>
        card.id === cardId ? { ...card, selected: !card.selected } : card
      )
    );
  };

  const selectAllCards = () => {
    setGeneratedCards(cards => cards.map(card => ({ ...card, selected: true })));
  };

  const deselectAllCards = () => {
    setGeneratedCards(cards => cards.map(card => ({ ...card, selected: false })));
  };

  const renderOutlineTree = (nodes: CourseOutlineNode[], level: number = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ marginLeft: `${level * 20}px` }}>
        <IonItem>
          <IonLabel>
            <h3>{node.title}</h3>
            <p>{node.description}</p>
            {node.estimatedCardCount > 0 && (
              <IonBadge color="primary">{node.estimatedCardCount} cards</IonBadge>
            )}
          </IonLabel>
        </IonItem>
        {node.children && node.children.length > 0 && renderOutlineTree(node.children, level + 1)}
      </div>
    ));
  };

  const canProceed = () => {
    switch (currentStage) {
      case 'subject':
        return subject.trim().length > 0;
      case 'template':
        return selectedTemplate !== null;
      case 'outline':
        return outline.length > 0;
      case 'structure':
        return true;
      case 'cards':
        return generatedCards.some(card => card.selected);
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStage) {
      case 'subject':
        setCurrentStage('template');
        break;
      case 'template':
        setCurrentStage('outline');
        handleGenerateOutline();
        break;
      case 'outline':
        setCurrentStage('structure');
        break;
      case 'structure':
        handleCreateStructure();
        break;
      case 'cards':
        handleAddSelectedCards();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStage) {
      case 'template':
        setCurrentStage('subject');
        break;
      case 'outline':
        setCurrentStage('template');
        break;
      case 'structure':
        setCurrentStage('outline');
        break;
      case 'cards':
        // Can't go back during card generation
        break;
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.push('/decks')}>
              <IonIcon slot="icon-only" icon={close} />
            </IonButton>
          </IonButtons>
          <IonTitle>
            <IonIcon icon={sparkles} /> AI Course Builder
          </IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonProgressBar 
            value={
              currentStage === 'subject' ? 0.2 :
              currentStage === 'template' ? 0.4 :
              currentStage === 'outline' ? 0.6 :
              currentStage === 'structure' ? 0.8 :
              1.0
            } 
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Stage 1: Subject Selection */}
        {currentStage === 'subject' && (
          <div className="wizard-stage">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>What would you like to learn?</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                <IonLabel position="stacked">Subject *</IonLabel>
                <IonInput
                  value={subject}
                  onIonInput={(e) => setSubject(e.detail.value || '')}
                  placeholder="e.g., Classical Mechanics, Human Anatomy"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Description (optional)</IonLabel>
                <IonTextarea
                  value={subjectDescription}
                  onIonInput={(e) => setSubjectDescription(e.detail.value || '')}
                  placeholder="Describe what you want to learn or focus on..."
                  rows={3}
                />
              </IonItem>
              
              <IonItem>
                  <IonLabel position="stacked">Subject Type</IonLabel>
                  <IonSelect
                    value={subjectType}
                    onIonChange={(e) => setSubjectType(e.detail.value)}
                  >
                    <IonSelectOption value="general">General</IonSelectOption>
                    <IonSelectOption value="medicine">Medicine</IonSelectOption>
                    <IonSelectOption value="science">Science</IonSelectOption>
                    <IonSelectOption value="mathematics">Mathematics</IonSelectOption>
                    <IonSelectOption value="history">History</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonCard color="warning" className="ion-margin-top">
                  <IonCardContent>
                    <IonText>
                      <p><strong>Note:</strong> Language learning is not supported by this feature. 
                      For language learning, please create decks manually for better control.</p>
                    </IonText>
                  </IonCardContent>
                </IonCard>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* Stage 2: Template Selection */}
        {currentStage === 'template' && (
          <div className="wizard-stage">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Choose Card Template</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {(() => {
                    // Filter templates and deduplicate by name
                    const filtered = templates
                      .filter(t => t.subjectType === subjectType || (t.subjectType === 'general' && subjectType !== 'general'));
                    
                    // Deduplicate by name - keep first occurrence
                    const seen = new Set<string>();
                    const unique = filtered.filter(t => {
                      if (seen.has(t.name)) {
                        return false;
                      }
                      seen.add(t.name);
                      return true;
                    });
                    
                    return unique.map(template => (
                      <IonItem
                        key={template.id}
                        button
                        onClick={() => setSelectedTemplate(template)}
                        color={selectedTemplate?.id === template.id ? 'primary' : undefined}
                      >
                        <IonLabel>
                          <h2>{template.name}</h2>
                          <p>Front: {template.frontLabel} | Back: {template.backLabel}</p>
                          {template.includeExamples && <IonBadge color="success">With Examples</IonBadge>}
                        </IonLabel>
                        {selectedTemplate?.id === template.id && (
                          <IonIcon slot="end" icon={checkmark} />
                        )}
                      </IonItem>
                    ));
                  })()}
                </IonList>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* Stage 3: Outline Generation */}
        {currentStage === 'outline' && (
          <div className="wizard-stage">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Course Outline: {subject}</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {isGeneratingOutline ? (
                  <div className="loading-state">
                    <IonSpinner />
                    <p>Generating course outline...</p>
                  </div>
                ) : outline.length > 0 ? (
                  <>
                    <div className="outline-actions">
                      <IonButton size="small" onClick={() => handleGenerateOutline()}>
                        <IonIcon slot="start" icon={refresh} />
                        Regenerate
                      </IonButton>
                      <IonButton size="small" onClick={() => setShowFeedbackModal(true)}>
                        Give Feedback
                      </IonButton>
                    </div>
                    
                    <IonList>
                      {renderOutlineTree(outline)}
                    </IonList>
                    
                    <IonText color="medium">
                      <p>Total: {getAllLeafNodes(outline).reduce((sum, node) => sum + (node.estimatedCardCount || 0), 0)} cards across {getAllLeafNodes(outline).length} topics</p>
                    </IonText>
                  </>
                ) : null}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* Stage 4: Structure Creation */}
        {currentStage === 'structure' && (
          <div className="wizard-stage">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Create Structure</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {isCreatingStructure ? (
                  <div className="loading-state">
                    <IonSpinner />
                    <p>Creating folder structure and decks...</p>
                  </div>
                ) : (
                  <>
                    <IonText>
                      <p>The AI will create:</p>
                      <ul>
                        <li>Hierarchical folder structure</li>
                        <li>{getAllLeafNodes(outline).length} empty decks</li>
                      </ul>
                    </IonText>
                    
                    <IonItem>
                      <IonCheckbox
                        checked={generateCardsNow}
                        onIonChange={(e) => setGenerateCardsNow(e.detail.checked)}
                      />
                      <IonLabel className="ion-text-wrap">
                        <h3>Generate all flashcards now</h3>
                        <p>You can also generate cards later for each deck individually</p>
                      </IonLabel>
                    </IonItem>
                  </>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* Stage 5: Card Generation */}
        {currentStage === 'cards' && (
          <div className="wizard-stage">
            {(() => {
              const leafNodes = getAllLeafNodes(outline);
              const currentNode = leafNodes[currentNodeIndex];
              
              return (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>
                      Generate Flashcards ({currentNodeIndex + 1}/{leafNodes.length})
                    </IonCardTitle>
                    <p>Topic: {currentNode?.title}</p>
                    <IonText color="medium">
                      <p>Completed: {completedTopics.size}/{leafNodes.length} topics</p>
                    </IonText>
                  </IonCardHeader>
                  <IonCardContent>
                    {isGeneratingCards ? (
                      <div className="loading-state">
                        <IonSpinner />
                        <p>Generating flashcards...</p>
                      </div>
                    ) : generatedCards.length === 0 ? (
                      <IonButton expand="block" onClick={handleGenerateCards}>
                        Generate Cards
                      </IonButton>
                    ) : (
                      <>
                        <div className="card-actions">
                          <IonButton size="small" onClick={selectAllCards}>
                            Select All
                          </IonButton>
                          <IonButton size="small" onClick={deselectAllCards}>
                            Deselect All
                          </IonButton>
                          <IonButton size="small" onClick={handleGenerateCards}>
                            <IonIcon slot="start" icon={refresh} />
                            Regenerate
                          </IonButton>
                        </div>
                        
                        <IonText color="medium">
                          <p>Selected: {generatedCards.filter(c => c.selected).length}/{generatedCards.length} cards</p>
                        </IonText>
                        
                        <IonList>
                          {generatedCards.map(card => (
                            <IonItem key={card.id}>
                              <IonCheckbox
                                slot="start"
                                checked={card.selected}
                                onIonChange={() => toggleCardSelection(card.id)}
                              />
                              <IonLabel className="ion-text-wrap">
                                <h3>{card.front}</h3>
                                <p>{card.back.substring(0, 100)}...</p>
                                <IonBadge color={
                                  card.difficulty === 'easy' ? 'success' :
                                  card.difficulty === 'medium' ? 'warning' :
                                  'danger'
                                }>
                                  {card.difficulty}
                                </IonBadge>
                              </IonLabel>
                            </IonItem>
                          ))}
                        </IonList>
                      </>
                    )}
                  </IonCardContent>
                </IonCard>
              );
            })()}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="wizard-navigation">
          {currentStage !== 'subject' && currentStage !== 'cards' && (
            <IonButton onClick={handleBack} fill="outline">
              <IonIcon slot="start" icon={arrowBack} />
              Back
            </IonButton>
          )}
          
          {currentStage !== 'cards' && (
            <IonButton
              onClick={handleNext}
              disabled={!canProceed() || isGeneratingOutline || isCreatingStructure}
            >
              {currentStage === 'structure' ? 'Create Structure' : 'Next'}
              <IonIcon slot="end" icon={arrowForward} />
            </IonButton>
          )}
          
          {currentStage === 'cards' && (
            <>
              {generatedCards.length > 0 && (
                <>
                  <IonButton
                    onClick={handleAddSelectedCards}
                    disabled={!generatedCards.some(c => c.selected)}
                    color="primary"
                  >
                    {currentNodeIndex < getAllLeafNodes(outline).length - 1 ? 'Save & Next Topic' : 'Save & Finish'}
                    <IonIcon slot="end" icon={arrowForward} />
                  </IonButton>
                  <IonButton
                    onClick={handleSkipTopic}
                    fill="outline"
                  >
                    Skip Topic
                  </IonButton>
                </>
              )}
              <IonButton
                onClick={handleFinishEarly}
                fill="clear"
                color="medium"
              >
                Finish & Exit
              </IonButton>
            </>
          )}
        </div>

        {/* Feedback Modal */}
        <IonAlert
          isOpen={showFeedbackModal}
          onDidDismiss={() => setShowFeedbackModal(false)}
          header="Refine Outline"
          message="Tell the AI how to improve the outline:"
          inputs={[
            {
              name: 'feedback',
              type: 'textarea',
              placeholder: 'e.g., Add more detail on circular motion',
              value: outlineFeedback,
            },
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Regenerate',
              handler: (data) => {
                setOutlineFeedback(data.feedback);
                handleRefineOutline();
              },
            },
          ]}
        />

        {/* Error Alert */}
        <IonAlert
          isOpen={showError}
          onDidDismiss={() => setShowError(false)}
          header="Error"
          message={errorMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default CourseBuilder;