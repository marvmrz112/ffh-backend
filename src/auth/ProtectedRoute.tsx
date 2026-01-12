import React from 'react';
import { Redirect } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from './AuthProvider';

export const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }

  if (!session) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
};
