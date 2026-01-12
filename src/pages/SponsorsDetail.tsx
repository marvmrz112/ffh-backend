import React, { useEffect, useMemo, useState } from 'react';
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
import { saveOutline, trashOutline } from 'ionicons/icons';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'public_sponsors';

type SponsorRow = {
  id: string;
  name: string;
  tier: string | null;
  website: string | null;
  logo_url: string | null;
  sort_order: number | null;
  created_at: string;
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const SponsorsDetail: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  // 1) normal: aus Params
  const params = useParams<Record<string, string | undefined>>();
  const firstParamValue =
    (params && Object.keys(params).length > 0
      ? params[Object.keys(params)[0]]
      : undefined) ?? undefined;

  const fromParams = params.id ?? params.sponsorId ?? params.uuid ?? firstParamValue;

  // 2) fallback: aus URL (letztes Segment)
  const lastSegment = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }, [location.pathname]);

  const rawId = fromParams ?? lastSegment;

  const id = useMemo(() => (rawId && isUuid(rawId) ? rawId : null), [rawId]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [tier, setTier] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [sortOrder, setSortOrder] = useState<string>('');

  const load = async () => {
    setErr(null);

    if (!id) {
      setLoading(false);
      setErr('Ungültige Sponsor-ID.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,name,tier,website,logo_url,sort_order,created_at')
      .eq('id', id)
      .single();

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const row = data as SponsorRow;
    setName(row.name ?? '');
    setTier(row.tier ?? '');
    setWebsite(row.website ?? '');
    setLogoUrl(row.logo_url ?? '');
    setSortOrder(row.sort_order == null ? '' : String(row.sort_order));

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    setErr(null);

    if (!id) {
      setErr('Ungültige Sponsor-ID.');
      return;
    }

    const n = name.trim();
    if (n.length < 2) {
      setErr('Bitte gib einen Namen an (mind. 2 Zeichen).');
      return;
    }

    const so =
      sortOrder.trim() === ''
        ? null
        : Number.isFinite(Number(sortOrder))
          ? Number(sortOrder)
          : NaN;

    if (so !== null && Number.isNaN(so)) {
      setErr('Sortierung muss eine Zahl sein (oder leer lassen).');
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from(TABLE)
      .update({
        name: n,
        tier: tier.trim() === '' ? null : tier.trim(),
        website: website.trim() === '' ? null : website.trim(),
        logo_url: logoUrl.trim() === '' ? null : logoUrl.trim(),
        sort_order: so,
      })
      .eq('id', id);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    history.replace('/sponsors');
  };

  const remove = async () => {
    setErr(null);

    if (!id) {
      setErr('Ungültige Sponsor-ID.');
      return;
    }

    const ok = window.confirm('Sponsor wirklich löschen?');
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase.from(TABLE).delete().eq('id', id);

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
          <IonTitle>Sponsor</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              {/* Debug (kannst du später löschen) */}
              <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 10 }}>
                DEBUG: path={location.pathname} | fromParams={String(fromParams)} | lastSeg={String(lastSegment)} | raw={String(rawId)} | id={String(id)}
              </div>

              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{err}</p>
                </IonText>
              )}

              {!loading && !err && (
                <>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                    Details bearbeiten
                  </div>

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
                    <IonInput value={website} onIonChange={(e) => setWebsite(e.detail.value ?? '')} />
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Logo URL (optional)</IonLabel>
                    <IonInput value={logoUrl} onIonChange={(e) => setLogoUrl(e.detail.value ?? '')} />
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

                  <IonButton expand="block" onClick={save} disabled={busy}>
                    {busy ? (
                      <IonSpinner />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={saveOutline} />
                        Speichern
                      </>
                    )}
                  </IonButton>

                  <IonButton expand="block" color="danger" onClick={remove} disabled={busy}>
                    {busy ? (
                      <IonSpinner />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={trashOutline} />
                        Löschen
                      </>
                    )}
                  </IonButton>
                </>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SponsorsDetail;
