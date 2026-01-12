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
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
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
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const ProgramDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ProgramRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,title,description,location,start_time,end_time,created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setItem(null);
      setLoading(false);
      return;
    }

    setItem((data as ProgramRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (!uuidRegex.test(id)) {
      setErr('Ungültige ID.');
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const remove = async () => {
    if (!item) return;

    const ok = window.confirm('Eintrag wirklich löschen?');
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const { error } = await supabase.from(TABLE).delete().eq('id', item.id);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    history.replace('/program');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/program" />
          </IonButtons>
          <IonTitle>Programm</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{err}</p>
                </IonText>
              )}

              {!loading && !err && !item && (
                <IonText>
                  <p>Nicht gefunden.</p>
                </IonText>
              )}

              {!loading && item && (
                <>
                  <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
                    {item.title}
                  </div>

                  <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 12 }}>
                    {formatDateTime(item.start_time)}
                    {item.end_time ? ` – ${formatTime(item.end_time)}` : ''}
                    {item.location ? ` · ${item.location}` : ''}
                  </div>

                  {item.description && (
                    <IonText>
                      <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{item.description}</p>
                    </IonText>
                  )}

                  <div style={{ height: 14 }} />

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

export default ProgramDetail;
