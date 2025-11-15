import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Decks from './pages/Decks';
import DeckDetail from './pages/DeckDetail';
import Study from './pages/Study';
import Export from './pages/Export';
import Import from './pages/Import';
import Settings from './pages/Settings';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/decks">
          <Decks />
        </Route>
        <Route exact path="/deck/:id">
          <DeckDetail />
        </Route>
        <Route exact path="/study/:id">
          <Study />
        </Route>
        <Route exact path="/deck/:id/export">
          <Export />
        </Route>
        <Route exact path="/deck/:id/import">
          <Import />
        </Route>
        <Route exact path="/export">
          <Export />
        </Route>
        <Route exact path="/import">
          <Import />
        </Route>
        <Route exact path="/settings">
          <Settings />
        </Route>
        <Route exact path="/">
          <Redirect to="/decks" />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
