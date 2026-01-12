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

type NewsRow = {
  id: string; // uuid
  title: string;
  created_at: string; // timestamptz
  published_at: string | null; // timestamptz
};

const TABLE = 'news_posts';

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

const NewsList: React.FC = () => {
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,title,created_at,published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      setErr(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as NewsRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('news-posts-changes')
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
          <IonTitle>News</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              {/* Card-Header Row: Titel links, Actions rechts */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Aktuelles</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={load}
                    disabled={loading}
                    aria-label="Aktualisieren"
                  >
                    <IonIcon slot="icon-only" icon={refreshOutline} />
                  </IonButton>

                  <IonButton
                    size="small"
                    onClick={() => history.push('/news/create')}
                    aria-label="Neuer Beitrag"
                  >
                    <IonIcon slot="start" icon={addOutline} />
                    Neu
                  </IonButton>
                </div>
              </div>

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
                  <strong>Noch keine News</strong>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    Sobald ein Beitrag veröffentlicht wird, erscheint er hier.
                  </div>

                  <IonButton style={{ marginTop: 12 }} onClick={() => history.push('/news/create')}>
                    <IonIcon slot="start" icon={addOutline} />
                    Neuer Beitrag
                  </IonButton>
                </div>
              )}

              <IonList inset style={{ marginTop: 10 }}>
                {items.map((n) => {
                  const shownDate = n.published_at ?? n.created_at;
                  return (
                    <IonItem key={n.id} routerLink={`/news/${n.id}`} detail>
                      <IonLabel>
                        <strong>{n.title}</strong>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          {formatDate(shownDate)}
                        </div>
                      </IonLabel>
                    </IonItem>
                  );
                })}
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default NewsList;
