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
import { saveOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'program_items';

function addMinutesIso(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

const ProgramCreate: React.FC = () => {
  const history = useHistory();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const [startTime, setStartTime] = useState<string>(new Date().toISOString());
  const [endTime, setEndTime] = useState<string>(addMinutesIso(60));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => {
    return {
      t: title.trim(),
      d: description.trim(),
      l: location.trim(),
    };
  }, [title, description, location]);

  const validate = () => {
    if (trimmed.t.length < 3) return 'Bitte einen Titel mit mindestens 3 Zeichen eingeben.';
    if (!startTime) return 'Bitte Startzeit auswählen.';
    if (endTime && new Date(endTime).getTime() < new Date(startTime).getTime())
      return 'Ende darf nicht vor Start liegen.';
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
          description: trimmed.d || null,
          location: trimmed.l || null,
          start_time: startTime,
          end_time: endTime || null,
        },
      ]);

      if (error) {
        setErr(error.message);
        return;
      }

      history.replace('/program');
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
            <IonBackButton defaultHref="/program" />
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
                <div style={{ fontWeight: 900, fontSize: 14 }}>Neuer Programmpunkt</div>

                <IonButton size="small" onClick={save} disabled={busy}>
                  {busy ? (
                    <IonSpinner />
                  ) : (
                    <>
                      <IonIcon slot="start" icon={saveOutline} />
                      Speichern
                    </>
                  )}
                </IonButton>
              </div>

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{err}</p>
                </IonText>
              )}

              <IonItem>
                <IonLabel position="stacked">Titel</IonLabel>
                <IonInput
                  value={title}
                  placeholder="Kurzer Titel"
                  onIonChange={(e) => setTitle(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Beschreibung</IonLabel>
                <IonTextarea
                  value={description}
                  placeholder="Optionaler Text"
                  autoGrow
                  rows={6}
                  onIonChange={(e) => setDescription(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Ort</IonLabel>
                <IonInput
                  value={location}
                  placeholder="Optional"
                  onIonChange={(e) => setLocation(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <div style={{ height: 10 }} />

              <IonAccordionGroup>
                <IonAccordion value="time">
                  <IonItem slot="header">
                    <IonLabel>
                      Zeit
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        Start: {new Date(startTime).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                        {endTime
                          ? ` · Ende: ${new Date(endTime).toLocaleString('de-DE', { timeStyle: 'short' })}`
                          : ''}
                      </div>
                    </IonLabel>
                  </IonItem>

                  <div slot="content" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                      Startzeit
                    </div>
                    <IonDatetime
                      value={startTime}
                      presentation="date-time"
                      onIonChange={(e) => {
                        const v = e.detail.value;
                        if (typeof v === 'string' && v) setStartTime(v);
                      }}
                    />

                    <div style={{ height: 12 }} />

                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                      Endzeit (optional)
                    </div>
                    <IonDatetime
                      value={endTime}
                      presentation="date-time"
                      onIonChange={(e) => {
                        const v = e.detail.value;
                        if (typeof v === 'string') setEndTime(v);
                      }}
                    />
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ProgramCreate;
