import React, { useEffect, useMemo, useRef, useState } from "react";
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
  IonAlert,
  IonChip,
} from "@ionic/react";
import { addOutline, refreshOutline, trashOutline, playOutline, bugOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

const BUILD_ID = "runs-v6-debug-2026-01-24";

type ScoringMode = "points_only" | "time_best" | "distance_best";
type RunStatus = "scheduled" | "running" | "done";

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
  created_at?: string | null;
};

type RunRow = {
  id: string;
  event_id: string;
  discipline_id: string;
  name: string | null;
  starts_at: string | null;
  status: RunStatus | string | null;
  created_at?: string | null;
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

function safeToISOStringFromDatetimeLocal(value: string): string | null {
  if (!value?.trim()) return null;

  // Typical datetime-local gives: "2026-01-24T01:54"
  // Create local date and convert to ISO
  if (value.includes("T")) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }

  // Fallback: try parse whatever browser gave (rare)
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

type DebugState = {
  supabaseUrl?: string;
  userId?: string | null;
  sessionPresent?: boolean;
  activeEventFrom?: "games_events.active" | "games_active_event" | "none";
  activeEventId?: string | null;
  disciplinesForActive?: number;
  disciplinesProbeTotal?: number;
  disciplinesGrouped?: Array<{ event_id: string; cnt: number }>;
  lastErrors?: Record<string, string | null>;
};

const GamesRuns: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  // Create form
  const [disciplineId, setDisciplineId] = useState<string>("");
  const [runName, setRunName] = useState<string>("");
  const [startsAtLocal, setStartsAtLocal] = useState<string>("");
  const [status, setStatus] = useState<RunStatus>("scheduled");

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

  const [debug, setDebug] = useState<DebugState>({
    lastErrors: {},
  });

  const lastErrorsRef = useRef<Record<string, string | null>>({});

  const setErr = (key: string, msg: string | null) => {
    lastErrorsRef.current = { ...lastErrorsRef.current, [key]: msg };
    setDebug((d) => ({ ...d, lastErrors: lastErrorsRef.current }));
  };

  const canCreate = useMemo(() => {
    return !!activeEvent?.id && disciplineId.length > 0 && !saving && !loading;
  }, [activeEvent?.id, disciplineId, saving, loading]);

  const resetForm = () => {
    setDisciplineId("");
    setRunName("");
    setStartsAtLocal("");
    setStatus("scheduled");
  };

  // ---- DATA LOADERS ----

  const loadAuthDebug = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id ?? null;

      // @ts-ignore: supabase has internal url on some builds
      const supabaseUrl = (supabase as any)?.supabaseUrl ?? (supabase as any)?.url ?? undefined;

      setDebug((d) => ({
        ...d,
        supabaseUrl,
        userId,
        sessionPresent: !!data?.session,
      }));
      setErr("auth", null);
    } catch (e: any) {
      setErr("auth", e?.message ?? "auth.getSession failed");
    }
  };

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    // Preferred: real table (active=true)
    const ev1 = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!ev1.error && ev1.data?.id) {
      setDebug((d) => ({
        ...d,
        activeEventFrom: "games_events.active",
        activeEventId: (ev1.data as any)?.id ?? null,
      }));
      setErr("activeEvent", null);
      return ev1.data as ActiveEventRow;
    }

    // Fallback: view
    const ev2 = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (ev2.error) {
      setErr("activeEvent", ev2.error.message);
      setDebug((d) => ({ ...d, activeEventFrom: "none", activeEventId: null }));
      return null;
    }

    setDebug((d) => ({
      ...d,
      activeEventFrom: ev2.data?.id ? "games_active_event" : "none",
      activeEventId: (ev2.data as any)?.id ?? null,
    }));
    setErr("activeEvent", null);
    return (ev2.data as ActiveEventRow) ?? null;
  };

  const loadDisciplinesForEvent = async (eventId: string) => {
    // First try with sort_order (if column exists)
    const q1 = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode,sort_order,created_at")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (q1.error) {
      // If it fails because sort_order doesn't exist, fallback without it
      const msg = q1.error.message ?? "";
      if (msg.toLowerCase().includes("sort_order")) {
        const q2 = await supabase
          .from("games_disciplines")
          .select("id,event_id,name,scoring_mode,created_at")
          .eq("event_id", eventId)
          .order("name", { ascending: true });

        if (q2.error) {
          setErr("disciplines", q2.error.message);
          setDisciplines([]);
          return;
        }

        setErr("disciplines", null);
        const rows = (q2.data as DisciplineRow[]) ?? [];
        setDisciplines(rows);
        setDebug((d) => ({ ...d, disciplinesForActive: rows.length }));
        return;
      }

      // Any other error
      setErr("disciplines", q1.error.message);
      setDisciplines([]);
      return;
    }

    setErr("disciplines", null);
    const rows = (q1.data as DisciplineRow[]) ?? [];
    setDisciplines(rows);
    setDebug((d) => ({ ...d, disciplinesForActive: rows.length }));
  };

  const loadRuns = async (eventId: string) => {
    const res = await supabase
      .from("games_runs")
      .select("id,event_id,discipline_id,name,starts_at,status,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (res.error) {
      setErr("runs", res.error.message);
      setRuns([]);
      return;
    }

    setErr("runs", null);
    setRuns((res.data as RunRow[]) ?? []);
  };

  // Probe queries to detect RLS / env mismatch
  const probeDisciplines = async () => {
    try {
      // Total probe (if this returns 0 while SQL editor shows rows -> RLS/ENV mismatch)
      const total = await supabase.from("games_disciplines").select("id", { count: "exact", head: true });
      if (total.error) {
        setErr("probeTotal", total.error.message);
      } else {
        setErr("probeTotal", null);
        setDebug((d) => ({ ...d, disciplinesProbeTotal: total.count ?? undefined }));
      }

      // Grouped by event_id (helps spot wrong event_id without needing SQL editor)
      const grouped = await supabase
        .from("games_disciplines")
        .select("event_id")
        .limit(500);

      if (grouped.error) {
        setErr("probeGrouped", grouped.error.message);
        return;
      }

      const counts = new Map<string, number>();
      (grouped.data as any[]).forEach((r) => {
        const k = String(r?.event_id ?? "");
        if (!k) return;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });

      const arr = Array.from(counts.entries())
        .map(([event_id, cnt]) => ({ event_id, cnt }))
        .sort((a, b) => b.cnt - a.cnt);

      setErr("probeGrouped", null);
      setDebug((d) => ({ ...d, disciplinesGrouped: arr.slice(0, 10) }));
    } catch (e: any) {
      setErr("probe", e?.message ?? "probe failed");
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await loadAuthDebug();

    try {
      const ev = await loadActiveEvent();
      setActiveEvent(ev);

      if (!ev?.id) {
        setDisciplines([]);
        setRuns([]);
        await probeDisciplines();
        return;
      }

      await Promise.all([loadDisciplinesForEvent(ev.id), loadRuns(ev.id)]);
      // If disciplines appear empty, probe to show why
      // (This is the key: if probeTotal shows 0 -> RLS/ENV)
      await probeDisciplines();
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
      setDisciplines([]);
      setRuns([]);
      await probeDisciplines();
    } finally {
      setLoading(false);
    }
  };

  // ---- ACTIONS ----

  const createRun = async () => {
    if (!activeEvent?.id) {
      toast("Kein aktives Event. Bitte zuerst unter Events ein Event aktiv setzen.");
      return;
    }
    if (!disciplineId) {
      toast("Bitte eine Disziplin auswählen.");
      return;
    }

    const iso = startsAtLocal ? safeToISOStringFromDatetimeLocal(startsAtLocal) : null;
    if (startsAtLocal && !iso) {
      toast("Start-Datum konnte nicht geparst werden. Bitte erneut wählen.");
      return;
    }

    setSaving(true);

    const payload = {
      event_id: activeEvent.id,
      discipline_id: disciplineId,
      name: runName.trim().length ? runName.trim() : null,
      starts_at: iso,
      status: status ?? "scheduled",
    };

    const res = await supabase
      .from("games_runs")
      .insert(payload)
      .select("id,event_id,discipline_id,name,starts_at,status,created_at")
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

  const disciplineMap = useMemo(() => {
    const m = new Map<string, DisciplineRow>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

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

    if (activeEvent?.id) {
      await loadRuns(activeEvent.id);
    } else {
      await loadAll();
    }
  };

  const statusChip = (s?: string | null) => {
    const val = (s ?? "").toLowerCase();
    const label = val === "running" ? "running" : val === "done" ? "done" : "scheduled";
    return <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.9 }}>{label}</IonChip>;
  };

  const debugText = useMemo(() => {
    const d = debug;
    return [
      `BUILD_ID=${BUILD_ID}`,
      `supabaseUrl=${d.supabaseUrl ?? "?"}`,
      `session=${d.sessionPresent ? "yes" : "no"} userId=${d.userId ?? "null"}`,
      `activeEventFrom=${d.activeEventFrom ?? "?"} activeEventId=${d.activeEventId ?? "null"}`,
      `disciplinesForActive=${d.disciplinesForActive ?? "?"}`,
      `disciplinesProbeTotal=${d.disciplinesProbeTotal ?? "?"}`,
      `disciplinesGroupedTop=${JSON.stringify(d.disciplinesGrouped ?? [])}`,
      `errors=${JSON.stringify(d.lastErrors ?? {})}`,
    ].join("\n");
  }, [debug]);

  const copyDebug = async () => {
    try {
      await navigator.clipboard.writeText(debugText);
      toast("Debug kopiert.");
    } catch {
      toast("Clipboard nicht verfügbar.");
    }
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
          {/* DEBUG CARD */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950 }}>
                <IonIcon icon={bugOutline} />
                Build
              </div>
              <IonNote style={{ display: "block", marginTop: 6 }}>{BUILD_ID}</IonNote>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <IonButton size="small" fill="outline" onClick={() => void copyDebug()}>
                  Debug kopieren
                </IonButton>
                <IonButton size="small" fill="outline" onClick={() => void probeDisciplines()} disabled={loading || saving}>
                  Probe
                </IonButton>
              </div>

              <pre
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#f6f6f6",
                  borderRadius: 10,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {debugText}
              </pre>

              {debug.disciplinesProbeTotal === 0 && (
                <IonNote style={{ display: "block", marginTop: 8 }}>
                  Hinweis: ProbeTotal=0 bedeutet: Client sieht keine Disziplinen. Das ist fast sicher RLS/Grants oder ENV-Mismatch
                  (Admin-App zeigt anderes Supabase Projekt als dein SQL Editor).
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>

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
                      Start: {formatBerlin(activeEvent.starts_at)}
                    </div>
                  </>
                ) : (
                  <IonNote style={{ display: "block" }}>
                    Kein aktives Event gefunden. Bitte unter <b>/games/events</b> ein Event aktiv setzen.
                  </IonNote>
                )}
              </div>
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
                Läufe werden dem aktiven Event und einer Disziplin zugeordnet.
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

                {activeEvent && !loading && disciplines.length === 0 && (
                  <IonNote style={{ display: "block", marginTop: 8 }}>
                    Disziplinen sind für das aktive Event leer <b>aus Sicht des Clients</b>.
                    Wenn du sie im SQL Editor siehst, ist das sehr wahrscheinlich <b>RLS/Grants</b> oder <b>ENV-Mismatch</b>.
                    Schau in der Debug-Box: <b>disciplinesProbeTotal</b> und <b>supabaseUrl</b>.
                  </IonNote>
                )}

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
                  <IonLabel position="stacked">Start (optional)</IonLabel>
                  <IonInput
                    value={startsAtLocal}
                    type="datetime-local"
                    onIonInput={(e) => setStartsAtLocal(String(e.detail.value ?? ""))}
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
                    <IonSelectOption value="scheduled">scheduled</IonSelectOption>
                    <IonSelectOption value="running">running</IonSelectOption>
                    <IonSelectOption value="done">done</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createRun()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={saving || !activeEvent}>
                    Zurücksetzen
                  </IonButton>
                </div>

                {!activeEvent && (
                  <IonNote style={{ display: "block", marginTop: 10 }}>
                    Hinweis: Erst ein Event aktiv setzen, dann Läufe anlegen.
                  </IonNote>
                )}
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
                                Start: {formatBerlin(r.starts_at)}
                              </span>
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
