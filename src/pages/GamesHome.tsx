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
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  IonInput,
  IonToast,
} from '@ionic/react';
import {
  trophyOutline,
  settingsOutline,
  peopleOutline,
  listOutline,
  addCircleOutline,
  saveOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type GamesSettingsRow = {
  id: string;
  enabled: boolean;
  show_in_app: boolean;
  title: string | null;
  event_id: string | null;
  updated_at: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  sort_order: number | null;
};

type DisciplineRow = {
  id: string;
  name: string;
  scoring_mode: 'points_only' | 'time_best' | 'distance_best';
  unit: string | null;
  sort_order: number | null;
};

function safeErr(e: any): string {
  return e?.message || e?.error_description || e?.hint || 'Unbekannter Fehler';
}

/** Accepts "mm:ss", "m:ss", "ss", "mm:ss.mmm" and returns ms */
function parseTimeToMs(input: string): number | null {
  const s = (input || '').trim();
  if (!s) return null;

  // If plain number: treat as seconds (can be decimal)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const sec = Number(s);
    if (!Number.isFinite(sec)) return null;
    return Math.round(sec * 1000);
  }

  // mm:ss(.mmm)
  const m = s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;

  const mm = Number(m[1]);
  const ss = Number(m[2]);
  const frac = m[3] ? m[3] : '0';
  const ms = Number(frac.padEnd(3, '0').slice(0, 3));

  if (![mm, ss, ms].every(Number.isFinite)) return null;
  if (ss >= 60) return null;

  return mm * 60_000 + ss * 1000 + ms;
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.06)',
  fontWeight: 850,
  fontSize: 12.5,
};

const GamesHome: React.FC = () => {
  const history = useHistory();

  // Settings
  const [settings, setSettings] = useState<GamesSettingsRow | null>(null);
  const [sTitle, setSTitle] = useState('');
  const [sEnabled, setSEnabled] = useState(true);
  const [sShowInApp, setSShowInApp] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Counts
  const [cntTeams, setCntTeams] = useState<number | null>(null);
  const [cntDisc, setCntDisc] = useState<number | null>(null);
  const [cntResults, setCntResults] = useState<number | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  // Quick add result
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [quickLoading, setQuickLoading] = useState(true);

  const [teamId, setTeamId] = useState<string>('');
  const [discId, setDiscId] = useState<string>('');
  const [points, setPoints] = useState<string>(''); // numeric string
  const [timeInput, setTimeInput] = useState<string>(''); // "mm:ss" etc
  const [distanceInput, setDistanceInput] = useState<string>(''); // meters or mm? we store mm
  const [note, setNote] = useState<string>('');
  const [savingResult, setSavingResult] = useState(false);

  // UX
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastOpen, setToastOpen] = useState(false);
  const [errorTop, setErrorTop] = useState<string | null>(null);

  const selectedDiscipline = useMemo(
    () => disciplines.find((d) => d.id === discId) ?? null,
    [discId, disciplines]
  );

  const loadSettings = async () => {
    setSettingsLoading(true);
    setErrorTop(null);

    const { data, error } = await supabase
      .from('games_settings')
      .select('id, enabled, show_in_app, title, event_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      // If table missing or RLS denies, we show error but keep page usable
      setErrorTop(`games_settings: ${safeErr(error)}`);
      setSettings(null);
      setSTitle('');
      setSEnabled(true);
      setSShowInApp(true);
      setSettingsLoading(false);
      return;
    }

    const row = (data?.[0] as GamesSettingsRow) ?? null;
    setSettings(row);
    setSTitle(row?.title ?? 'Spiele');
    setSEnabled(row?.enabled ?? true);
    setSShowInApp(row?.show_in_app ?? true);
    setSettingsLoading(false);
  };

  const loadCounts = async () => {
    setCountsLoading(true);

    const [t, d, r] = await Promise.all([
      supabase.from('games_teams').select('id', { count: 'exact', head: true }),
      supabase.from('games_disciplines').select('id', { count: 'exact', head: true }),
      supabase.from('games_results').select('id', { count: 'exact', head: true }),
    ]);

    setCntTeams(t.error ? null : t.count ?? 0);
    setCntDisc(d.error ? null : d.count ?? 0);
    setCntResults(r.error ? null : r.count ?? 0);

    // Don’t overwrite top error unless none set; counts can fail separately
    if (!errorTop) {
      const err = t.error || d.error || r.error;
      if (err) setErrorTop(`Counts: ${safeErr(err)}`);
    }

    setCountsLoading(false);
  };

  const loadQuickLists = async () => {
    setQuickLoading(true);

    const [t, d] = await Promise.all([
      supabase
        .from('games_teams')
        .select('id,name,logo_url,sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('games_disciplines')
        .select('id,name,scoring_mode,unit,sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (t.error && !errorTop) setErrorTop(`games_teams: ${safeErr(t.error)}`);
    if (d.error && !errorTop) setErrorTop(`games_disciplines: ${safeErr(d.error)}`);

    setTeams((t.data as TeamRow[]) ?? []);
    setDisciplines((d.data as DisciplineRow[]) ?? []);

    // Defaults
    if (!teamId && (t.data?.[0] as any)?.id) setTeamId((t.data?.[0] as any).id);
    if (!discId && (d.data?.[0] as any)?.id) setDiscId((d.data?.[0] as any).id);

    setQuickLoading(false);
  };

  const reloadAll = async () => {
    await Promise.all([loadSettings(), loadCounts(), loadQuickLists()]);
  };

  useEffect(() => {
    void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async () => {
    setSettingsSaving(true);
    setErrorTop(null);

    try {
      const payload = {
        title: (sTitle || '').trim() || 'Spiele',
        enabled: !!sEnabled,
        show_in_app: !!sShowInApp,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase.from('games_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        // Create first settings row
        const { error } = await supabase.from('games_settings').insert(payload);
        if (error) throw error;
      }

      setToastMsg('Einstellungen gespeichert');
      setToastOpen(true);
      await loadSettings();
    } catch (e: any) {
      setErrorTop(`Speichern fehlgeschlagen: ${safeErr(e)}`);
    } finally {
      setSettingsSaving(false);
    }
  };

  const addResult = async () => {
    if (!teamId || !discId) {
      setToastMsg('Bitte Team und Disziplin auswählen');
      setToastOpen(true);
      return;
    }

    const d = selectedDiscipline;
    if (!d) {
      setToastMsg('Ungültige Disziplin-Auswahl');
      setToastOpen(true);
      return;
    }

    // Build row depending on scoring mode
    let row: any = {
      team_id: teamId,
      discipline_id: discId,
      note: (note || '').trim() || null,
      created_at: new Date().toISOString(),
    };

    if (d.scoring_mode === 'points_only') {
      const p = Number((points || '').replace(',', '.'));
      if (!Number.isFinite(p)) {
        setToastMsg('Bitte Punkte als Zahl eingeben');
        setToastOpen(true);
        return;
      }
      row.points = p;
    }

    if (d.scoring_mode === 'time_best') {
      const ms = parseTimeToMs(timeInput);
      if (ms === null) {
        setToastMsg('Zeitformat: mm:ss oder ss (z.B. 1:23.450 oder 83.45)');
        setToastOpen(true);
        return;
      }
      row.time_ms = ms;

      // Optional points on time disciplines (manual override / overall scoring)
      if ((points || '').trim()) {
        const p = Number((points || '').replace(',', '.'));
        if (!Number.isFinite(p)) {
          setToastMsg('Punkte sind keine gültige Zahl');
          setToastOpen(true);
          return;
        }
        row.points = p;
      }
    }

    if (d.scoring_mode === 'distance_best') {
      const m = Number((distanceInput || '').replace(',', '.'));
      if (!Number.isFinite(m)) {
        setToastMsg('Bitte Distanz als Zahl eingeben (Meter, z.B. 12.34)');
        setToastOpen(true);
        return;
      }
      row.distance_mm = Math.round(m * 1000);

      if ((points || '').trim()) {
        const p = Number((points || '').replace(',', '.'));
        if (!Number.isFinite(p)) {
          setToastMsg('Punkte sind keine gültige Zahl');
          setToastOpen(true);
          return;
        }
        row.points = p;
      }
    }

    setSavingResult(true);
    setErrorTop(null);

    try {
      const { error } = await supabase.from('games_results').insert(row);
      if (error) throw error;

      setToastMsg('Ergebnis gespeichert');
      setToastOpen(true);

      // Reset small inputs
      setPoints('');
      setTimeInput('');
      setDistanceInput('');
      setNote('');

      await loadCounts();
    } catch (e: any) {
      setErrorTop(`Ergebnis speichern fehlgeschlagen: ${safeErr(e)}`);
    } finally {
      setSavingResult(false);
    }
  };

  const appVisibilityLabel = useMemo(() => {
    if (settingsLoading) return 'lädt…';
    if (!sEnabled) return 'deaktiviert';
    if (sEnabled && !sShowInApp) return 'aktiv, aber in App versteckt';
    return 'aktiv & sichtbar in App';
  }, [settingsLoading, sEnabled, sShowInApp]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>

          <IonTitle>Spiele</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={reloadAll} disabled={settingsLoading || countsLoading || quickLoading}>
              <IonIcon slot="start" icon={refreshOutline} />
              Refresh
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {errorTop ? (
            <IonCard>
              <IonCardContent style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <IonIcon icon={warningOutline} style={{ fontSize: 18, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950 }}>Hinweis / Fehler</div>
                  <div style={{ opacity: 0.75, marginTop: 4, wordBreak: 'break-word' }}>{errorTop}</div>
                  <div style={{ marginTop: 10, opacity: 0.75, fontWeight: 800 }}>
                    Wenn Tabellen/Policies noch nicht existieren, ist das normal. Wir bauen das jetzt Schritt für Schritt.
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          ) : null}

          {/* OVERVIEW */}
          <IonCard>
            <IonCardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
                  <IonIcon icon={trophyOutline} style={{ fontSize: 22 }} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sTitle || 'Spiele'}
                  </div>
                  <div style={{ marginTop: 4, opacity: 0.7, fontWeight: 800, fontSize: 13.5 }}>
                    Status: {appVisibilityLabel}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={pillStyle}>
                  <IonIcon icon={peopleOutline} />
                  {countsLoading ? 'Teams…' : `Teams: ${cntTeams ?? '—'}`}
                </div>
                <div style={pillStyle}>
                  <IonIcon icon={listOutline} />
                  {countsLoading ? 'Disziplinen…' : `Disziplinen: ${cntDisc ?? '—'}`}
                </div>
                <div style={pillStyle}>
                  <IonIcon icon={addCircleOutline} />
                  {countsLoading ? 'Ergebnisse…' : `Ergebnisse: ${cntResults ?? '—'}`}
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* SETTINGS */}
          <IonCard>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IonIcon icon={settingsOutline} style={{ fontSize: 18 }} />
                <div style={{ fontWeight: 950, fontSize: '1.05rem' }}>Einstellungen</div>
              </div>

              {settingsLoading ? (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IonSpinner />
                  <IonText style={{ opacity: 0.75, fontWeight: 800 }}>Lade Einstellungen…</IonText>
                </div>
              ) : (
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <IonItem lines="none">
                    <IonLabel position="stacked">Titel (Anzeige im Backend)</IonLabel>
                    <IonInput
                      value={sTitle}
                      placeholder="z.B. Sommerfest Spiele"
                      onIonInput={(e) => setSTitle(String(e.detail.value ?? ''))}
                    />
                  </IonItem>

                  <IonItem lines="none">
                    <IonLabel>
                      <div style={{ fontWeight: 900 }}>Aktiv</div>
                      <div style={{ opacity: 0.65, fontSize: 12.5, fontWeight: 700 }}>
                        Aktiv = Spiele-Modul ist in Betrieb.
                      </div>
                    </IonLabel>
                    <IonToggle checked={sEnabled} onIonChange={(e) => setSEnabled(!!e.detail.checked)} />
                  </IonItem>

                  <IonItem lines="none">
                    <IonLabel>
                      <div style={{ fontWeight: 900 }}>In Handy-App anzeigen</div>
                      <div style={{ opacity: 0.65, fontSize: 12.5, fontWeight: 700 }}>
                        Wenn aus: Backend bleibt sichtbar, App blendet aus.
                      </div>
                    </IonLabel>
                    <IonToggle checked={sShowInApp} onIonChange={(e) => setSShowInApp(!!e.detail.checked)} />
                  </IonItem>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                    <IonButton onClick={saveSettings} disabled={settingsSaving}>
                      {settingsSaving ? <IonSpinner /> : <IonIcon slot="start" icon={saveOutline} />}
                      Speichern
                    </IonButton>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* QUICK ADD RESULT */}
          <IonCard>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IonIcon icon={addCircleOutline} style={{ fontSize: 18 }} />
                  <div style={{ fontWeight: 950, fontSize: '1.05rem' }}>Quick Entry</div>
                </div>
                <IonButton fill="outline" size="small" onClick={loadQuickLists} disabled={quickLoading}>
                  <IonIcon slot="start" icon={refreshOutline} />
                  Listen neu laden
                </IonButton>
              </div>

              {quickLoading ? (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IonSpinner />
                  <IonText style={{ opacity: 0.75, fontWeight: 800 }}>Lade Teams/Disziplinen…</IonText>
                </div>
              ) : (
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <IonItem>
                    <IonLabel position="stacked">Team</IonLabel>
                    <IonSelect value={teamId} placeholder="Team wählen" onIonChange={(e) => setTeamId(String(e.detail.value))}>
                      {teams.map((t) => (
                        <IonSelectOption key={t.id} value={t.id}>
                          {t.name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Disziplin</IonLabel>
                    <IonSelect value={discId} placeholder="Disziplin wählen" onIonChange={(e) => setDiscId(String(e.detail.value))}>
                      {disciplines.map((d) => (
                        <IonSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  {/* Inputs depending on scoring mode */}
                  {selectedDiscipline?.scoring_mode === 'points_only' ? (
                    <IonItem>
                      <IonLabel position="stacked">Punkte</IonLabel>
                      <IonInput
                        inputmode="decimal"
                        value={points}
                        placeholder="z.B. 3"
                        onIonInput={(e) => setPoints(String(e.detail.value ?? ''))}
                      />
                    </IonItem>
                  ) : null}

                  {selectedDiscipline?.scoring_mode === 'time_best' ? (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Zeit</IonLabel>
                        <IonInput
                          value={timeInput}
                          placeholder="mm:ss.mmm oder Sekunden (z.B. 1:23.450 oder 83.45)"
                          onIonInput={(e) => setTimeInput(String(e.detail.value ?? ''))}
                        />
                      </IonItem>

                      <IonItem>
                        <IonLabel position="stacked">Punkte (optional)</IonLabel>
                        <IonInput
                          inputmode="decimal"
                          value={points}
                          placeholder="optional"
                          onIonInput={(e) => setPoints(String(e.detail.value ?? ''))}
                        />
                      </IonItem>
                    </>
                  ) : null}

                  {selectedDiscipline?.scoring_mode === 'distance_best' ? (
                    <>
                      <IonItem>
                        <IonLabel position="stacked">Distanz (Meter)</IonLabel>
                        <IonInput
                          inputmode="decimal"
                          value={distanceInput}
                          placeholder="z.B. 12.34"
                          onIonInput={(e) => setDistanceInput(String(e.detail.value ?? ''))}
                        />
                      </IonItem>

                      <IonItem>
                        <IonLabel position="stacked">Punkte (optional)</IonLabel>
                        <IonInput
                          inputmode="decimal"
                          value={points}
                          placeholder="optional"
                          onIonInput={(e) => setPoints(String(e.detail.value ?? ''))}
                        />
                      </IonItem>
                    </>
                  ) : null}

                  <IonItem>
                    <IonLabel position="stacked">Notiz (optional)</IonLabel>
                    <IonInput value={note} placeholder="z.B. Lauf 1" onIonInput={(e) => setNote(String(e.detail.value ?? ''))} />
                  </IonItem>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                    <IonButton onClick={addResult} disabled={savingResult}>
                      {savingResult ? <IonSpinner /> : <IonIcon slot="start" icon={saveOutline} />}
                      Ergebnis speichern
                    </IonButton>
                  </div>

                  <div style={{ opacity: 0.7, fontWeight: 750, fontSize: 12.5 }}>
                    Hinweis: Distanz wird intern in <b>mm</b> gespeichert (Meter × 1000). Zeit wird intern in <b>ms</b> gespeichert.
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* NEXT LINKS (optional navigation hooks for later) */}
          <IonCard>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: '1.05rem' }}>Nächste Schritte (UI)</div>
              <div style={{ marginTop: 8, opacity: 0.75, fontWeight: 800 }}>
                Wenn du willst, splitten wir das sauber in eigene Seiten:
              </div>

              <IonList lines="none" style={{ marginTop: 10 }}>
                <IonItem
                  button
                  detail={false}
                  onClick={() => history.push('/games/teams')}
                  style={{ borderRadius: 12 }}
                >
                  <IonIcon slot="start" icon={peopleOutline} />
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Teams verwalten</div>
                    <div style={{ opacity: 0.65, fontSize: 12.5, fontWeight: 700 }}>CRUD + Sortierung + Logo</div>
                  </IonLabel>
                </IonItem>

                <IonItem
                  button
                  detail={false}
                  onClick={() => history.push('/games/disciplines')}
                  style={{ borderRadius: 12 }}
                >
                  <IonIcon slot="start" icon={listOutline} />
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Disziplinen verwalten</div>
                    <div style={{ opacity: 0.65, fontSize: 12.5, fontWeight: 700 }}>Scoring Mode + Unit + Sort</div>
                  </IonLabel>
                </IonItem>

                <IonItem
                  button
                  detail={false}
                  onClick={() => history.push('/games/leaderboard')}
                  style={{ borderRadius: 12 }}
                >
                  <IonIcon slot="start" icon={trophyOutline} />
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Leaderboard</div>
                    <div style={{ opacity: 0.65, fontSize: 12.5, fontWeight: 700 }}>Gesamt + je Disziplin</div>
                  </IonLabel>
                </IonItem>
              </IonList>

              <div style={{ marginTop: 10, opacity: 0.7, fontWeight: 750, fontSize: 12.5 }}>
                Diese Routes sind noch nicht in App.tsx registriert – das ist nur als Vorbereitung gedacht.
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={toastOpen}
          message={toastMsg}
          duration={2200}
          onDidDismiss={() => setToastOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default GamesHome;
