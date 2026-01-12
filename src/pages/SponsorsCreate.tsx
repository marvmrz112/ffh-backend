import React, { useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { saveOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'public_sponsors';

function isValidUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const SponsorsCreate: React.FC = () => {
  const history = useHistory();

  const [name, setName] = useState('');
  const [tier, setTier] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [sortOrder, setSortOrder] = useState<string>('10');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const n = name.trim();
    if (n.length < 2) return false;
    if (website.trim() && !isValidUrl(website.trim())) return false;
    if (logoUrl.trim() && !isValidUrl(logoUrl.trim())) return false;
    return !busy;
  }, [name, website, logoUrl, busy]);

  const save = async () => {
    setErr(null);

    const n = name.trim();
    if (n.length < 2) {
      setErr('Name ist zu kurz.');
      return;
    }

    const w = website.trim();
    const l = logoUrl.trim();

    if (w && !isValidUrl(w)) {
      setErr('Website-URL ist ungültig.');
      return;
    }
    if (l && !isValidUrl(l)) {
      setErr('Logo-URL ist ungültig.');
      return;
    }

    const so = sortOrder.trim() ? Number(sortOrder) : null;
    if (sortOrder.trim() && Number.isNaN(so)) {
      setErr('Sortierung muss eine Zahl sein.');
      return;
    }

    setBusy(true);

    const { error } = await supabase.from(TABLE).insert([
      {
        name: n,
        tier: tier.trim() || null,
        website: w || null,
        logo_url: l || null,
        sort_order: so,
      },
    ]);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    history.replace('/sponsors');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/sponsors" />
          </IonButtons>
          <IonTitle>Sponsor anlegen</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Neuer Sponsor</div>

              <IonItem>
                <IonLabel position="stacked">Name</IonLabel>
                <IonInput value={name} onIonChange={(e) => setName(e.detail.value ?? '')} />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Tier (optional)</IonLabel>
                <IonInput value={tier} onIonChange={(e) => setTier(e.detail.value ?? '')} />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Website (optional)</IonLabel>
                <IonInput
                  value={website}
                  placeholder="https://..."
                  onIonChange={(e) => setWebsite(e.detail.value ?? '')}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Logo URL (optional)</IonLabel>
                <IonInput
                  value={logoUrl}
                  placeholder="https://.../logo.png"
                  onIonChange={(e) => setLogoUrl(e.detail.value ?? '')}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Sortierung (optional)</IonLabel>
                <IonInput
                  inputmode="numeric"
                  value={sortOrder}
                  onIonChange={(e) => setSortOrder(e.detail.value ?? '')}
                />
              </IonItem>

              <div style={{ height: 12 }} />

              <IonButton expand="block" onClick={save} disabled={!canSave}>
                {busy ? (
                  <IonSpinner />
                ) : (
                  <>
                    <IonIcon slot="start" icon={saveOutline} />
                    Speichern
                  </>
                )}
              </IonButton>

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{err}</p>
                </IonText>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SponsorsCreate;
