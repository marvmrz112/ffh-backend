import React from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
} from '@ionic/react';
import { trophyOutline, constructOutline } from 'ionicons/icons';

const GamesHome: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>

          <IonTitle>Spiele</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <IonCard>
            <IonCardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  flex: '0 0 auto',
                }}
              >
                <IonIcon icon={trophyOutline} style={{ fontSize: 22 }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.2 }}>
                  Spiele & Leaderboard
                </div>
                <div style={{ marginTop: 6, opacity: 0.7, fontWeight: 700, fontSize: 13.5 }}>
                  Seite ist verbunden und routing funktioniert. Nächster Schritt: Tabelle/Disziplinen/Teams anzeigen und
                  Ergebnisse pflegen.
                </div>

                <div style={{ marginTop: 12 }}>
                  <IonButton
                    size="small"
                    fill="outline"
                    onClick={() => {
                      // nur ein Platzhalter
                      window.alert('Next: Leaderboard UI + CRUD');
                    }}
                  >
                    <IonIcon slot="start" icon={constructOutline} />
                    Nächster Schritt
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardContent>
              <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.8 }}>Debug</div>
              <div style={{ marginTop: 8, fontWeight: 800 }}>
                GamesHome.tsx LIVE ✅
              </div>
              <div style={{ marginTop: 6, opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                Wenn du das nach Deploy auf Vercel siehst, sind Route, Build und Cache sauber.
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default GamesHome;
