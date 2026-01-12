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

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  created_at: string;
};

const TABLE = 'program_items';

function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { timeStyle: 'short' });
}

const ProgramList: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProgramRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,title,description,location,start_time,end_time,created_at')
      .order('start_time', { ascending: true });

    if (error) {
      setErr(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as ProgramRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('program-items-changes')
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
          <IonTitle>Programm</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Programmpunkte</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <IonButton fill="outline" size="small" onClick={load} disabled={loading}>
                    <IonIcon slot="icon-only" icon={refreshOutline} />
                  </IonButton>

                  <IonButton size="small" onClick={() => history.push('/program/create')}>
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
                  <strong>Noch keine Einträge</strong>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    Sobald Programmpunkte angelegt sind, erscheinen sie hier.
                  </div>

                  <IonButton style={{ marginTop: 12 }} onClick={() => history.push('/program/create')}>
                    <IonIcon slot="start" icon={addOutline} />
                    Ersten Programmpunkt anlegen
                  </IonButton>
                </div>
              )}

              <IonList inset style={{ marginTop: 10 }}>
                {items.map((p) => (
                  <IonItem key={p.id} routerLink={`/program/${p.id}`} detail>
                    <IonLabel>
                      <strong>{p.title}</strong>
                      <div style={{ opacity: 0.8, fontSize: 12 }}>
                        {formatDateTime(p.start_time)}
                        {p.end_time ? ` – ${formatTime(p.end_time)}` : ''}
                        {p.location ? ` · ${p.location}` : ''}
                      </div>
                    </IonLabel>
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

export default ProgramList;
