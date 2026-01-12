import React, { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { refreshOutline, saveOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'event_start';

type EventStartRow = {
  id: string;
  created_at?: string | null;
  event_name: string | null;
  event_start: string | null; // timestamptz
  event_end: string | null;   // timestamptz
  hero_subtitle: string | null;
  countdown_enabled: boolean | null;
};

function toIsoOrNull(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

const Countdown: React.FC = () => {
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rowId, setRowId] = useState<string | null>(null);

  const [eventName, setEventName] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [startIso, setStartIso] = useState<string | null>(null);
  const [endIso, setEndIso] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);

  const canSave = useMemo(() => {
    return !!startIso && !busy && !loading;
  }, [startIso, busy, loading]);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,event_name,event_start,event_end,hero_subtitle,countdown_enabled,created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setRowId(null);
      setEventName('');
      setHeroSubtitle('');
      setStartIso(null);
      setEndIso(null);
      setEnabled(true);
      setLoading(false);
      return;
    }

    const r = data as EventStartRow;
    setRowId(r.id);
    setEventName(r.event_name ?? '');
    setHeroSubtitle(r.hero_subtitle ?? '');
    setStartIso(r.event_start ?? null);
    setEndIso(r.event_end ?? null);
    setEnabled(r.countdown_enabled ?? true);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setErr(null);

    if (!startIso) {
      setErr('Bitte ein Startdatum setzen.');
      return;
    }

    setBusy(true);

    const payload = {
      event_name: eventName.trim() || null,
      hero_subtitle: heroSubtitle.trim() || null,
      event_start: startIso,
      event_end: endIso,
      countdown_enabled: enabled,
    };

    const res = rowId
      ? await supabase.from(TABLE).update(payload).eq('id', rowId).select('id').maybeSingle()
      : await supabase.from(TABLE).insert([payload]).select('id').maybeSingle();

    if (res.error) {
      setErr(res.error.message);
      setBusy(false);
      return;
    }

    setRowId((res.data as any)?.id ?? rowId);
    setBusy(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>

          <IonTitle>Countdown</IonTitle>

          <IonButtons slot="end">
            <IonButton fill="clear" onClick={load} disabled={loading || busy} aria-label="Refresh">
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                Countdown Einstellungen
              </div>

              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{err}</p>
                </IonText>
              )}

              {!loading && (
                <>
                  <IonItem>
                    <IonLabel position="stacked">Event-Name (optional)</IonLabel>
                    <IonInput
                      value={eventName}
                      placeholder="z.B. Feuerwehrfest"
                      onIonChange={(e) => setEventName(e.detail.value ?? '')}
                    />
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Untertitel (optional)</IonLabel>
                    <IonInput
                      value={heroSubtitle}
                      placeholder="Kurz & knackig"
                      onIonChange={(e) => setHeroSubtitle(e.detail.value ?? '')}
                    />
                  </IonItem>

                  <div style={{ height: 10 }} />

                  <IonItem lines="none">
                    <IonLabel>
                      <div style={{ fontWeight: 800 }}>Countdown aktiv</div>
                    </IonLabel>
                    <IonCheckbox
                      slot="end"
                      checked={enabled}
                      onIonChange={(e) => setEnabled(!!e.detail.checked)}
                    />
                  </IonItem>

                  <div style={{ height: 14 }} />

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>Start</div>
                      <IonDatetimeButton datetime="dt-start" />
                      <IonModal keepContentsMounted>
                        <IonDatetime
                          id="dt-start"
                          presentation="date-time"
                          value={startIso ?? undefined}
                          onIonChange={(e) => setStartIso(toIsoOrNull(e.detail.value))}
                        />
                      </IonModal>

                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                        {startIso
                          ? new Date(startIso).toLocaleString('de-DE', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Noch kein Startdatum gesetzt.'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                        Ende (optional)
                      </div>
                      <IonDatetimeButton datetime="dt-end" />
                      <IonModal keepContentsMounted>
                        <IonDatetime
                          id="dt-end"
                          presentation="date-time"
                          value={endIso ?? undefined}
                          onIonChange={(e) => setEndIso(toIsoOrNull(e.detail.value))}
                        />
                      </IonModal>

                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                        {endIso
                          ? new Date(endIso).toLocaleString('de-DE', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Kein Enddatum gesetzt.'}
                      </div>

                      {endIso && (
                        <IonButton size="small" fill="clear" style={{ marginTop: 6 }} onClick={() => setEndIso(null)}>
                          Enddatum entfernen
                        </IonButton>
                      )}
                    </div>
                  </div>

                  <div style={{ height: 16 }} />

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

                  <div style={{ height: 4 }} />

                  <IonButton
                    expand="block"
                    fill="clear"
                    onClick={() => history.push('/')}
                    disabled={busy}
                  >
                    Zurück zur Home
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

export default Countdown;
