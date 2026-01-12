import React, { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  newspaperOutline,
  calendarOutline,
  restaurantOutline,
  timerOutline,
  ribbonOutline,
  logOutOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type TileProps = {
  title: string;
  icon: string;
  to: string;
};

const Tile: React.FC<TileProps> = ({ title, icon, to }) => {
  const history = useHistory();

  return (
    <IonCard
      button
      onClick={() => history.push(to)}
      style={{
        margin: 0,
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <IonCardContent
        style={{
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <IonIcon icon={icon} style={{ fontSize: 22 }} />
          </div>

          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        </div>

        <div style={{ opacity: 0.35, fontWeight: 900 }}>›</div>
      </IonCardContent>
    </IonCard>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.75, marginBottom: 10 }}>{title}</div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </div>
  </div>
);

const Home: React.FC = () => {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setEmail(data?.user?.email ?? '');
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? '');
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
      history.replace('/login');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Backend</IonTitle>

          <IonButtons slot="end">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingRight: 10,
                fontSize: 13,
                opacity: 0.85,
                maxWidth: 260,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={email}
            >
              {email || '—'}
            </div>

            <IonButton onClick={logout} disabled={busy} color="medium">
              {busy ? (
                <IonSpinner />
              ) : (
                <>
                  <IonIcon slot="start" icon={logOutOutline} />
                  Logout
                </>
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Section title="Inhalt">
            <Tile title="News" icon={newspaperOutline} to="/news" />
            <Tile title="Programm" icon={calendarOutline} to="/program" />
            <Tile title="Food & Drinks" icon={restaurantOutline} to="/food" />
          </Section>

          <Section title="Orga">
            <Tile title="Countdown" icon={timerOutline} to="/countdown" />
            <Tile title="Sponsoren" icon={ribbonOutline} to="/sponsors" />
          </Section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
