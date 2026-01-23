import React, { useEffect, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonPage,
  IonText,
  IonTitle,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const LOGO_URL =
  'https://sotpwnjubybpmorbnunm.supabase.co/storage/v1/object/public/public-assets/bilder/logo.png';

const Login: React.FC = () => {
  const history = useHistory();
  const auth = useAuth() as any;

  // tolerant: egal wie du’s im Provider benannt hast
  const session = auth.session ?? null;
  const loading = auth.loading ?? false;
  const signIn =
    auth.signInWithAzure ??
    auth.signInMicrosoft ??
    auth.signInMicrosoft?.bind(auth) ??
    null;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (!loading && session) {
      // sicher: du hast garantiert "/" als Route
      history.replace('/');
    }
  }, [loading, session, history]);

  const handleLogin = async () => {
    setErr('');

    if (!signIn) {
      setErr('Login-Funktion nicht gefunden (AuthProvider: signInWithAzure oder signInMicrosoft fehlt).');
      return;
    }

    setBusy(true);
    try {
      await signIn();
      // OAuth Redirect passiert automatisch
    } catch (e: any) {
      setErr(e?.message ?? 'Login fehlgeschlagen');
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div
          style={{
            minHeight: '100%',
            display: 'grid',
            placeItems: 'center',
            padding: '28px 16px',
            background:
              'radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(900px 500px at 80% 30%, rgba(99,102,241,0.14), transparent 55%), linear-gradient(180deg, #0b1220 0%, #0b1220 30%, #0f172a 100%)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 22,
                  margin: '0 auto 12px auto',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <img
                  src={LOGO_URL}
                  alt="FFH"
                  style={{ width: 58, height: 58, objectFit: 'contain' }}
                />
              </div>

              <IonTitle style={{ color: 'white', fontWeight: 900, marginBottom: 6 }}>
                FFH Crew
              </IonTitle>

              <IonText style={{ color: 'rgba(255,255,255,0.75)' }}>
                Internes Crew-Dashboard – Anmeldung mit Microsoft
              </IonText>
            </div>

            <IonCard
              style={{
                margin: 0,
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <IonCardContent style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                  >
                    Du meldest dich mit deinem Feuerwehr Microsoft-Konto an. Danach landest du im
                    App Backend.
                  </div>

                  <IonButton
                    expand="block"
                    onClick={handleLogin}
                    disabled={busy || loading}
                    style={{ height: 46, fontWeight: 800 }}
                  >
                    {busy ? 'Anmelden…' : 'Mit Microsoft anmelden'}
                  </IonButton>

                  {err ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'rgba(239,68,68,0.16)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: 13,
                      }}
                    >
                      {err}
                    </div>
                  ) : null}
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        </div>
      </IonContent>

      <IonFooter style={{ background: '#0b1220' }}>
        <div style={{ padding: '10px 16px', textAlign: 'center' }}>
          <IonText style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
            © Freiwillige Feuerehr Kelkheim-Hornau 1928 e.V – intern
          </IonText>
        </div>
      </IonFooter>
    </IonPage>
  );
};

export default Login;
