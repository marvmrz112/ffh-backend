import React, { useEffect, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { addOutline, refreshOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'public_sponsors';

type SponsorRow = {
  id: string;
  created_at: string;
  name: string | null;
  tier: string | null;
  website: string | null;
  logo_url: string | null;
  sort_order: number | null;
};

const SponsorsList: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SponsorRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,created_at,name,tier,website,logo_url,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      setErr(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as SponsorRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('sponsors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>

          <IonTitle>Sponsoren</IonTitle>

          <IonButtons slot="end">
            <IonButton fill="clear" onClick={load} disabled={loading}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>

            <IonButton onClick={() => history.push('/sponsors/create')}>
              <IonIcon slot="start" icon={addOutline} />
              Neu
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Alle Sponsoren</div>

              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{err}</p>
                </IonText>
              )}

              {!loading && !err && items.length === 0 && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: '1px dashed rgba(255,255,255,0.15)',
                    opacity: 0.85,
                    textAlign: 'center',
                  }}
                >
                  <strong>Noch keine Sponsoren</strong>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    Lege den ersten Sponsor an.
                  </div>

                  <IonButton style={{ marginTop: 12 }} onClick={() => history.push('/sponsors/create')}>
                    <IonIcon slot="start" icon={addOutline} />
                    Sponsor anlegen
                  </IonButton>
                </div>
              )}

              <IonList inset style={{ marginTop: 10 }}>
                {items.map((s) => (
                  <IonItem key={s.id} routerLink={`/sponsors/${s.id}`} detail>
                    <IonLabel>
                      <strong>{s.name ?? '(ohne Name)'}</strong>
                      <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                        {s.tier ? `Tier: ${s.tier}` : 'Kein Tier gesetzt'}
                        {typeof s.sort_order === 'number' ? ` • Sort: ${s.sort_order}` : ''}
                      </div>
                    </IonLabel>

                    {s.logo_url && (
                      <img
                        src={s.logo_url}
                        alt=""
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          objectFit: 'cover',
                          marginLeft: 10,
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      />
                    )}
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SponsorsList;
