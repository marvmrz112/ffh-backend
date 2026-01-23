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
  trophyOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type TileProps = {
  title: string;
  icon: string;
  to: string;
  subtitle?: string;
};

const Tile: React.FC<TileProps> = ({ title, icon, to, subtitle }) => {
  const history = useHistory();

  return (
    <IonCard
      button
      onClick={() => history.push(to)}
      style={{
        margin: 0,
        borderRadius: 18,
        border: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.92)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              flex: '0 0 auto',
            }}
          >
            <IonIcon icon={icon} style={{ fontSize: 22 }} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 16,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>

            {subtitle ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  opacity: 0.65,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ opacity: 0.35, fontWeight: 900, fontSize: 18, flex: '0 0 auto' }}>›</div>
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
          {/* DEBUG BANNER – zum Testen auf Vercel (kannst du später wieder löschen) */}
          <div
            style={{
              background: 'linear-gradient(90deg, #d50000, #7a0000)',
              color: 'white',
              padding: '10px 12px',
              borderRadius: 12,
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            HOME.TSX LIVE ✅ {new Date().toLocaleString()}
          </div>

          <Section title="Inhalt">
            <Tile title="News" icon={newspaperOutline} to="/news" subtitle="Beiträge erstellen & verwalten" />
            <Tile title="Programm" icon={calendarOutline} to="/program" subtitle="Programmpunkte pflegen" />
            <Tile title="Food & Drinks" icon={restaurantOutline} to="/food" subtitle="Speisen & Preise" />
          </Section>

          <Section title="Orga">
            <Tile title="Countdown" icon={timerOutline} to="/countdown" subtitle="Event-Countdown konfigurieren" />
            <Tile title="Sponsoren" icon={ribbonOutline} to="/sponsors" subtitle="Sponsorenliste pflegen" />
          </Section>

          <Section title="Spiele">
            <Tile
              title="Spiele & Tabelle"
              icon={trophyOutline}
              to="/games"
              subtitle="Leaderboard / Platzierungen"
            />
          </Section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
