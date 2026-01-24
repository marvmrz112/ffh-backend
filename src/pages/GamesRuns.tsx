import React, { useEffect, useMemo, useState } from "react";
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonToast,
} from "@ionic/react";
import { addOutline, playOutline, refreshOutline, trashOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

type ScoringMode = "points_only" | "time_best" | "distance_best";
type RunStatus = "planned" | "running" | "done";

type ActiveEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
};

type DisciplineRow = {
  id: string;
  event_id: string;
  name: string;
  scoring_mode: ScoringMode;
  sort_order?: number | null;
};

type RunRow = {
  id: string;
  event_id: string;
  discipline_id: string;
  name: string | null;

  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;

  status: RunStatus | string | null;
  sort_order: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function formatBerlin(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

function datetimeLocalToISO(value: string): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

const GamesRuns: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  // Create form
  const [disciplineId, setDisciplineId] = useState<string>("");
  const [runName, setRunName] = useState<string>("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>("");
  const [status, setStatus] = useState<RunStatus>("planned");
  const [sortOrder, setSortOrder] = useState<string>("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const canCreate = useMemo(() => {
    return !!activeEvent?.id && !!disciplineId && !loading && !saving;
  }, [activeEvent?.id, disciplineId, loading, saving]);

  const resetForm = () => {
    setDisciplineId("");
    setRunName("");
    setScheduledAtLocal("");
    setStatus("planned");
    setSortOrder("");
  };

  // ---------- Loaders ----------

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    // bevorzugt: games_events.active
    const ev = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!ev.error && ev.data?.id) return ev.data as ActiveEventRow;

    // fallback: view
    const v = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (v.error) throw v.error;
    return (v.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    // sort_order existiert bei dir in disciplines evtl. – falls nicht, fällt es sauber zurück
    const q1 = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode,sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!q1.error) {
      setDisciplines((q1.data as DisciplineRow[]) ?? []);
      return;
    }

    // fallback ohne sort_order
    const q2 = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode")
      .eq("event_id", eventId)
      .order("name", { ascending: true });

    if (q2.error) throw q2.error;

    setDisciplines((q2.data as DisciplineRow[]) ?? []);
  };

  const loadRuns = async (eventId: string) => {
    const res = await supabase
      .from("games_runs")
      .select("id,event_id,discipline_id,name,scheduled_at,started_at,finished_at,status,sort_order,created_at,updated_at")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (res.error) throw res.error;
    setRuns((res.data as RunRow[]) ?? []);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const ev = await loadActiveEvent();
      setActiveEvent(ev);

      if (!ev?.id) {
        setDisciplines([]);
        setRuns([]);
        return;
      }

      await Promise.all([loadDisciplines(ev.id), loadRuns(ev.id)]);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
      setDisciplines([]);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Actions ----------

  const createRun = async () => {
    if (!activeEvent?.id) {
      toast("Kein aktives Event. Bitte zuerst unter /games/events aktiv setzen.");
      return;
    }
    if (!disciplineId) {
      toast("Bitte eine Disziplin auswählen.");
      return;
    }

    const iso = scheduledAtLocal ? datetimeLocalToISO(scheduledAtLocal) : null;
    if (scheduledAtLocal && !iso) {
      toast("Start-Datum konnte nicht geparst werden. Bitte erneut wählen.");
      return;
    }

    const parsedSort = sortOrder.trim().length ? Number(sortOrder) : null;
    if (sortOrder.trim().length && !Number.isFinite(parsedSort)) {
      toast("sort_order muss eine Zahl sein.");
      return;
    }

    setSaving(true);

    const payload = {
      event_id: activeEvent.id,
      discipline_id: disciplineId,
      name: runName.trim().length ? runName.trim() : null,

      // !!! passend zu deinem Schema !!!
      scheduled_at: iso,
      status: status ?? "planned",
      sort_order: parsedSort,
    };

    const res = await supabase
      .from("games_runs")
      .insert(payload)
      .select("id,event_id,discipline_id,name,scheduled_at,started_at,finished_at,status,sort_order,created_at,updated_at")
      .single();

    setSaving(false);

    if (res.error) {
      toast(`Create Fehler: ${res.error.message}`);
      return;
    }

    toast("Lauf angelegt.");
    resetForm();
    await loadRuns(activeEvent.id);
  };

  const askDelete = (r: RunRow) => {
    setDeleteId(r.id);
    setDeleteName(r.name ?? "Unbenannter Lauf");
    setConfirmOpen(true);
  };

  const deleteRun = async () => {
    if (!deleteId) return;

    setSaving(true);
    const res = await supabase.from("games_runs").delete().eq("id", deleteId);
    setSaving(false);
    setConfirmOpen(false);

    if (res.error) {
      toast(`Delete Fehler: ${res.error.message}`);
      return;
    }

    toast("Lauf gelöscht.");
    setDeleteId(null);
    setDeleteName("");

    if (activeEvent?.id) await loadRuns(activeEvent.id);
  };

  const disciplineMap = useMemo(() => {
    const m = new Map<string, DisciplineRow>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

  const statusChip = (s?: string | null) => {
    const val = (s ?? "").toLowerCase();
    const label = val === "running" ? "running" : val === "done" ? "done" : "planned";
    return <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.9 }}>{label}</IonChip>;
  };

  const bestTimeText = (r: RunRow) => {
    // Anzeige: scheduled_at bevorzugt, sonst started/finished
    const main =
      r.scheduled_at ? `geplant: ${formatBerlin(r.scheduled_at)}` :
      r.started_at ? `start: ${formatBerlin(r.started_at)}` :
      r.finished_at ? `ende: ${formatBerlin(r.finished_at)}` :
      "—";

    return main;
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/games" />
          </IonButtons>

          <IonTitle>Games · Läufe</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={() => void loadAll()} disabled={loading || saving}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          {/* ACTIVE EVENT */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950, fontSize: 16 }}>
                <IonIcon icon={playOutline} />
                Aktives Event
              </div>

              <div style={{ marginTop: 10 }}>
                {loading ? (
                  <IonSpinner />
                ) : activeEvent ? (
                  <>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{activeEvent.name}</div>
                    {activeEvent.subtitle ? (
                      <div style={{ marginTop: 4, opacity: 0.85, fontWeight: 750 }}>{activeEvent.subtitle}</div>
                    ) : null}
                    <div style={{ marginTop: 8, opacity: 0.8, fontWeight: 850 }}>
                      Event-Start: {formatBerlin(activeEvent.starts_at)}
                    </div>
                  </>
                ) : (
                  <IonNote style={{ display: "block" }}>
                    Kein aktives Event gefunden. Bitte unter <b>/games/events</b> ein Event aktiv setzen.
                  </IonNote>
                )}
              </div>

              {activeEvent && disciplines.length === 0 && !loading ? (
                <IonNote style={{ display: "block", marginTop: 10 }}>
                  Keine Disziplinen für dieses Event gefunden. Prüfe: Disziplinen müssen <b>event_id = {activeEvent.id}</b> haben.
                </IonNote>
              ) : null}
            </IonCardContent>
          </IonCard>

          {/* CREATE RUN */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950, fontSize: 16 }}>
                <IonIcon icon={addOutline} />
                Neuen Lauf anlegen
              </div>

              <IonNote style={{ display: "block", marginTop: 6 }}>
                Läufe werden dem aktiven Event und einer Disziplin zugeordnet. (Spalte in DB: <b>scheduled_at</b>)
              </IonNote>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Disziplin</IonLabel>
                  <IonSelect
                    value={disciplineId}
                    interface="popover"
                    placeholder={disciplines.length ? "Disziplin auswählen" : "Keine Disziplinen"}
                    onIonChange={(e) => setDisciplineId(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent || disciplines.length === 0}
                  >
                    {disciplines.map((d) => (
                      <IonSelectOption key={d.id} value={d.id}>
                        {d.name} ({d.scoring_mode})
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Name (optional)</IonLabel>
                  <IonInput
                    value={runName}
                    placeholder="z. B. Lauf 1"
                    onIonInput={(e) => setRunName(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Geplanter Start (optional)</IonLabel>
                  <IonInput
                    value={scheduledAtLocal}
                    type="datetime-local"
                    onIonInput={(e) => setScheduledAtLocal(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Status</IonLabel>
                  <IonSelect
                    value={status}
                    interface="popover"
                    onIonChange={(e) => setStatus(e.detail.value as RunStatus)}
                    disabled={saving || !activeEvent}
                  >
                    <IonSelectOption value="planned">planned</IonSelectOption>
                    <IonSelectOption value="running">running</IonSelectOption>
                    <IonSelectOption value="done">done</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">sort_order (optional)</IonLabel>
                  <IonInput
                    value={sortOrder}
                    inputmode="numeric"
                    placeholder="z. B. 1"
                    onIonInput={(e) => setSortOrder(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createRun()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={saving || !activeEvent}>
                    Zurücksetzen
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* RUNS LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Läufe</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                {activeEvent ? `${runs.length} Läufe im aktiven Event.` : "Kein aktives Event."}
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : !activeEvent ? (
                  <IonText color="medium">
                    <p>Bitte zuerst ein Event aktiv setzen.</p>
                  </IonText>
                ) : runs.length === 0 ? (
                  <IonText color="medium">
                    <p>Noch keine Läufe vorhanden. Lege oben einen an.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {runs.map((r) => {
                      const d = disciplineMap.get(r.discipline_id);
                      return (
                        <IonItem key={r.id} detail={false}>
                          <IonLabel style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {r.name ?? "Unbenannter Lauf"}
                              </div>
                              {statusChip(r.status)}
                            </div>

                            <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.9 }}>
                              <span style={{ fontSize: 12, fontWeight: 850 }}>
                                Disziplin: {d ? `${d.name} (${d.scoring_mode})` : r.discipline_id}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.8 }}>
                                {bestTimeText(r)}
                              </span>
                              {r.sort_order != null ? (
                                <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.8 }}>
                                  sort_order: {r.sort_order}
                                </span>
                              ) : null}
                            </div>
                          </IonLabel>

                          <IonButton
                            size="small"
                            color="danger"
                            fill="outline"
                            disabled={saving}
                            onClick={() => askDelete(r)}
                          >
                            <IonIcon icon={trashOutline} slot="icon-only" />
                          </IonButton>
                        </IonItem>
                      );
                    })}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Wenn Delete fehlschlägt: häufig hängen Results an Runs (FK Constraint) oder RLS.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={confirmOpen}
          onDidDismiss={() => setConfirmOpen(false)}
          header="Lauf löschen?"
          message={`Willst du "${deleteName}" wirklich löschen?`}
          buttons={[
            { text: "Abbrechen", role: "cancel" },
            { text: "Löschen", role: "destructive", handler: () => void deleteRun() },
          ]}
        />

        <IonToast isOpen={toastOpen} message={toastMsg} duration={3000} onDidDismiss={() => setToastOpen(false)} />
      </IonContent>
    </IonPage>
  );
};

export default GamesRuns;
