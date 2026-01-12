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
  IonTextarea,
  IonTitle,
  IonToolbar,
  IonDatetime,
  IonAccordion,
  IonAccordionGroup,
} from '@ionic/react';
import { chevronBackOutline, saveOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'news_posts';

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

const NewsCreate: React.FC = () => {
  const history = useHistory();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // geplant / sofort
  const [publishedAt, setPublishedAt] = useState<string>(new Date().toISOString());

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => {
    return { t: title.trim(), b: body.trim() };
  }, [title, body]);

  const validate = () => {
    if (trimmed.t.length < 3) return 'Bitte eine Überschrift mit mindestens 3 Zeichen eingeben.';
    if (trimmed.b.length < 5) return 'Bitte einen Text mit mindestens 5 Zeichen eingeben.';
    if (!publishedAt) return 'Bitte einen Zeitpunkt für „Sichtbar ab“ auswählen.';
    return null;
  };

  const save = async () => {
    setErr(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from(TABLE).insert([
        {
          title: trimmed.t,
          body: trimmed.b,
          published_at: publishedAt,
        },
      ]);

      if (error) {
        const hint =
          error.code === '42501' || /permission denied|row level security/i.test(error.message)
            ? '\n\nHinweis: INSERT ist durch RLS/Policy nicht erlaubt.'
            : '';
        setErr(error.message + hint);
        return;
      }

      history.replace('/news');
    } catch (e: any) {
      setErr(e?.message ?? 'Unbekannter Fehler beim Speichern.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/news" />
          </IonButtons>
          <IonTitle>News</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              {/* Card-Header Row: Titel links, Action rechts */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Neuer Beitrag</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={() => history.replace('/news')}
                    disabled={busy}
                    aria-label="Zurück zur Liste"
                  >
                    <IonIcon slot="icon-only" icon={chevronBackOutline} />
                  </IonButton>

                  <IonButton size="small" onClick={save} disabled={busy} aria-label="Veröffentlichen">
                    {busy ? (
                      <IonSpinner />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={saveOutline} />
                        Veröffentlichen
                      </>
                    )}
                  </IonButton>
                </div>
              </div>

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{err}</p>
                </IonText>
              )}

              <IonItem>
                <IonLabel position="stacked">Überschrift</IonLabel>
                <IonInput
                  value={title}
                  placeholder="Kurzer, klarer Titel"
                  onIonChange={(e) => setTitle(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Text</IonLabel>
                <IonTextarea
                  value={body}
                  placeholder="Kurze Info für Besucherinnen und Besucher"
                  autoGrow
                  rows={8}
                  onIonChange={(e) => setBody(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <div style={{ height: 10 }} />

              <IonAccordionGroup>
                <IonAccordion value="publish">
                  <IonItem slot="header">
                    <IonLabel>
                      Sichtbar ab
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(publishedAt)}</div>
                    </IonLabel>
                  </IonItem>

                  <div slot="content" style={{ padding: 12 }}>
                    <IonDatetime
                      value={publishedAt}
                      presentation="date-time"
                      onIonChange={(e) => {
                        const v = e.detail.value;
                        if (typeof v === 'string' && v) setPublishedAt(v);
                      }}
                    />

                    <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                      Der Beitrag erscheint erst ab diesem Zeitpunkt in der App.
                    </div>
                  </div>
                </IonAccordion>
              </IonAccordionGroup>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Tipp: Was ist neu, wann gilt es, wo findet es statt?
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default NewsCreate;
