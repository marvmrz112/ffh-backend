import React, { useEffect, useState } from 'react';
import { IonContent, IonPage, IonSpinner, IonText } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback: React.FC = () => {
  const history = useHistory();
  const [msg, setMsg] = useState('Login wird abgeschlossen…');

  useEffect(() => {
    (async () => {
      // Supabase setzt die Session normalerweise selbst, wenn "detectSessionInUrl" aktiv ist.
      // Wir lesen sie hier nur und routen dann weiter.
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMsg(`Callback Fehler: ${error.message}`);
        return;
      }

      if (data.session) {
        history.replace('/home');
      } else {
        setMsg('Kein OAuth-Code in der URL. Bitte Login über /login starten.');
      }
    })();
  }, [history]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IonSpinner />
          <IonText>{msg}</IonText>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthCallback;
