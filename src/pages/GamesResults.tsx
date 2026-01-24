import React, { useEffect, useMemo, useState } from "react";
import {
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
import { refreshOutline, saveOutline, createOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

type ActiveEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
};

type ScoringMode = "points_only" | "time_best" | "distance_best";

type DisciplineRow = {
  id: string;
  name: string;
  scoring_mode: ScoringMode;
};

type TeamRow = {
  id: string;
  name: string;
};

type RunRow = {
  id: string;
  discipline_id: string;
  name: string | null;
  status: string | null;
  created_at?: string | null;
};

type RunResultRow = {
  id: string;
  event_id: string;
  discipline_id: string;
  run_id: string;
  team_id: string;

  points_manual: number | null;
  time_ms: number | null;
  distance: number | null;

  achieved_at: string | null;
  note: string | null;

  place: number | null;
  points_awarded: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type RowVM = {
  team: TeamRow;

  pointsManualStr: string;
  timeStr: string;
  distanceStr: string;
  noteStr: string;
  achievedAtLocal: string;

  place: number | null;
  pointsAwarded: number | null;

  dirty: boolean;
  saving: boolean;
};

function formatBerlin(ts?: string | null) {
  if (!ts) return "";
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

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** points_manual: integer */
function parseIntOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** distance: float */
function parseFloatOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * time input formats:
 * - "m:ss.SSS" (preferred)
 * - "m:ss" or "mm:ss"
 * - "ss.SSS" (seconds)
 * - integer >= 1000 treated as ms
 */
function parseTimeToMs(v: string): number | null {
  const s = v.trim();
  if (!s) return null;

  if (s.includes(":")) {
    const [mStr, secStrRaw] = s.split(":");
    const m = Number(mStr);
    if (!Number.isFinite(m)) return null;

    const secStr = secStrRaw.replace(",", ".");
    const sec = Number(secStr);
    if (!Number.isFinite(sec)) return null;

    return Math.round((m * 60 + sec) * 1000);
  }

  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;

  // if user types "83456" assume ms
  if (Number.isInteger(n) && n >= 1000) return Math.trunc(n);

  // otherwise seconds
  return Math.round(n * 1000);
}

/** format ms as m:ss.SSS */
function formatMs(ms?: number | null): string {
  if (ms == null) return "";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(msPart).padStart(3, "0")}`;
}

function isRlsError(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("row level security") ||
    m.includes("rls") ||
    m.includes("policy") ||
    m.includes("permission denied")
  );
}

const GamesResults: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [globalSaving, setGlobalSaving] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const [selectedRunId, setSelectedRunId] = useState<string>("");

  const [resultsByTeam, setResultsByTeam] = useState<Map<string, RunResultRow>>(new Map());
  const [vmRows, setVmRows] = useState<RowVM[]>([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const disciplineMap = useMemo(() => {
    const m = new Map<string, DisciplineRow>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

  const selectedRun = useMemo(() => runs.find((r) => r.id === selectedRunId) ?? null, [runs, selectedRunId]);

  const scoringMode: ScoringMode | null = useMemo(() => {
    if (!selectedRun) return null;
    return disciplineMap.get(selectedRun.discipline_id)?.scoring_mode ?? null;
  }, [selectedRun, disciplineMap]);

  const hasDirty = useMemo(() => vmRows.some((r) => r.dirty), [vmRows]);

  const showTime = scoringMode === "time_best";
  const showDist = scoringMode === "distance_best";

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const res = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (res.error) throw res.error;
    return (res.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    const res = await supabase
      .from("games_disciplines")
      .select("id,name,scoring_mode")
      .eq("event_id", eventId)
      .order("name", { ascending: true });

    if (res.error) throw res.error;
    setDisciplines((res.data as DisciplineRow[]) ?? []);
  };

  const loadTeams = async (eventId: string) => {
    const res = await supabase
      .from("games_teams")
      .select("id,name")
      .eq("event_id", eventId)
      .order("name", { ascending: true });

    if (res.error) throw res.error;
    setTeams((res.data as TeamRow[]) ?? []);
  };

  const loadRuns = async (eventId: string) => {
    const res = await supabase
      .from("games_runs")
      .select("id,discipline_id,name,status,created_at")
      .eq("event_id", eventId)
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
        setTeams([]);
        setRuns([]);
        setSelectedRunId("");
        setResultsByTeam(new Map());
        setVmRows([]);
        return;
      }

      await Promise.all([loadDisciplines(ev.id), loadTeams(ev.id), loadRuns(ev.id)]);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
      setDisciplines([]);
      setTeams([]);
      setRuns([]);
      setSelectedRunId("");
      setResultsByTeam(new Map());
      setVmRows([]);
    } finally {
      setLoading(false);
    }
  };

  const buildVmRows = (map: Map<string, RunResultRow>) => {
    const vms: RowVM[] = teams.map((t) => {
      const r = map.get(t.id);
      return {
        team: t,
        pointsManualStr: r?.points_manual != null ? String(r.points_manual) : "",
        timeStr: r?.time_ms != null ? formatMs(r.time_ms) : "",
        distanceStr: r?.distance != null ? String(r.distance) : "",
        noteStr: r?.note ?? "",
        achievedAtLocal: toDatetimeLocalValue(r?.achieved_at ?? null),
        place: r?.place ?? null,
        pointsAwarded: r?.points_awarded ?? null,
        dirty: false,
        saving: false,
      };
    });
    setVmRows(vms);
  };

  const loadResultsForRun = async (runId: string) => {
    if (!runId || !activeEvent?.id) {
      setResultsByTeam(new Map());
      setVmRows([]);
      return;
    }

    setLoading(true);
    try {
      const res = await supabase
        .from("games_run_results")
        .select(
          "id,event_id,discipline_id,run_id,team_id,points_manual,time_ms,distance,achieved_at,note,place,points_awarded,created_at,updated_at"
        )
        .eq("run_id", runId);

      if (res.error) throw res.error;

      const map = new Map<string, RunResultRow>();
      ((res.data as RunResultRow[]) ?? []).forEach((r) => map.set(r.team_id, r));

      setResultsByTeam(map);
      buildVmRows(map);
    } catch (e: any) {
      toast(`Results Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setResultsByTeam(new Map());
      setVmRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setResultsByTeam(new Map());
      setVmRows([]);
      return;
    }
    if (!activeEvent?.id) return;
    if (teams.length === 0) return;

    void loadResultsForRun(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, teams.length, activeEvent?.id]);

  const updateVmField = (
    teamId: string,
    field: "pointsManualStr" | "timeStr" | "distanceStr" | "noteStr" | "achievedAtLocal",
    value: string
  ) => {
    setVmRows((prev) => prev.map((r) => (r.team.id === teamId ? { ...r, [field]: value, dirty: true } : r)));
  };

  const buildPayload = (row: RowVM) => {
    if (!activeEvent?.id) return { ok: false as const, error: "Kein aktives Event." };
    if (!selectedRun) return { ok: false as const, error: "Bitte zuerst einen Lauf auswählen." };
    if (!scoringMode) return { ok: false as const, error: "Disziplin/ScoringMode nicht gefunden." };

    // points_manual always allowed (optional)
    const points_manual = parseIntOrNull(row.pointsManualStr);

    // time_ms only for time_best
    let time_ms: number | null = null;
    if (scoringMode === "time_best") {
      if (row.timeStr.trim().length) {
        time_ms = parseTimeToMs(row.timeStr);
        if (time_ms == null) {
          return { ok: false as const, error: 'Zeit ungültig. Format z.B. "1:23.456" oder "83.456".' };
        }
      }
    }

    // distance only for distance_best
    let distance: number | null = null;
    if (scoringMode === "distance_best") {
      if (row.distanceStr.trim().length) {
        distance = parseFloatOrNull(row.distanceStr);
        if (distance == null) {
          return { ok: false as const, error: "Distanz ungültig. Format z.B. 12.34" };
        }
      }
    }

    const note = row.noteStr.trim().length ? row.noteStr.trim() : null;
    const achieved_at = row.achievedAtLocal ? new Date(row.achievedAtLocal).toISOString() : null;

    return {
      ok: true as const,
      data: {
        event_id: activeEvent.id,
        discipline_id: selectedRun.discipline_id,
        run_id: selectedRun.id,
        team_id: row.team.id,
        points_manual,
        time_ms,
        distance,
        achieved_at,
        note,
        updated_at: new Date().toISOString(),
      },
    };
  };

  const saveRow = async (teamId: string) => {
    if (!activeEvent?.id) return toast("Kein aktives Event.");
    if (!selectedRun) return toast("Bitte zuerst einen Lauf auswählen.");

    const row = vmRows.find((x) => x.team.id === teamId);
    if (!row) return;

    const built = buildPayload(row);
    if (!built.ok) {
      toast(built.error);
      return;
    }

    setVmRows((prev) => prev.map((x) => (x.team.id === teamId ? { ...x, saving: true } : x)));

    try {
      const existing = resultsByTeam.get(teamId);

      if (existing?.id) {
        const upd = await supabase
          .from("games_run_results")
          .update(built.data)
          .eq("id", existing.id);

        if (upd.error) throw upd.error;
      } else {
        const ins = await supabase.from("games_run_results").insert(built.data);
        if (ins.error) throw ins.error;
      }

      // IMPORTANT: Ranking/points are calculated in DB -> reload and show place/awarded
      await loadResultsForRun(selectedRun.id);
      toast("Gespeichert (Ranking aktualisiert).");
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      if (isRlsError(msg)) toast("Save geblockt: RLS/Policy verhindert Write auf games_run_results.");
      else toast(`Save Fehler: ${msg}`);
    } finally {
      setVmRows((prev) => prev.map((x) => (x.team.id === teamId ? { ...x, saving: false } : x)));
    }
  };

  const saveAllDirty = async () => {
    if (!activeEvent?.id) return toast("Kein aktives Event.");
    if (!selectedRun) return toast("Bitte zuerst einen Lauf auswählen.");
    if (!hasDirty) return toast("Nichts zu speichern.");

    setGlobalSaving(true);
    try {
      // Sequenziell speichern (debug-freundlich)
      for (const r of vmRows.filter((x) => x.dirty)) {
        const built = buildPayload(r);
        if (!built.ok) {
          toast(`Team "${r.team.name}": ${built.error}`);
          continue;
        }

        const existing = resultsByTeam.get(r.team.id);

        if (existing?.id) {
          const upd = await supabase.from("games_run_results").update(built.data).eq("id", existing.id);
          if (upd.error) throw upd.error;
        } else {
          const ins = await supabase.from("games_run_results").insert(built.data);
          if (ins.error) throw ins.error;
        }
      }

      // IMPORTANT: after batch -> reload to show final ranking
      await loadResultsForRun(selectedRun.id);
      toast("Alle Änderungen gespeichert (Ranking aktualisiert).");
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      if (isRlsError(msg)) toast("Save geblockt: RLS/Policy verhindert Write auf games_run_results.");
      else toast(`SaveAll Fehler: ${msg}`);
    } finally {
      setGlobalSaving(false);
    }
  };

  const scoringHint = useMemo(() => {
    if (!scoringMode) return "Bitte Lauf auswählen.";
    if (scoringMode === "points_only") return "Modus: points_only. Ranking nach points_manual (DESC).";
    if (scoringMode === "time_best") return 'Modus: time_best. Ranking nach time_ms (ASC). Eingabe z.B. "1:23.456".';
    return "Modus: distance_best. Ranking nach distance (DESC).";
  }, [scoringMode]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/games" />
          </IonButtons>

          <IonTitle>Games · Ergebnisse</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={() => void loadAll()} disabled={loading || globalSaving}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* CONTEXT */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Kontext</div>

              <div style={{ marginTop: 10 }}>
                {loading && !activeEvent ? (
                  <IonSpinner />
                ) : activeEvent ? (
                  <>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{activeEvent.name}</div>
                    {activeEvent.subtitle ? (
                      <div style={{ marginTop: 4, opacity: 0.85, fontWeight: 750 }}>{activeEvent.subtitle}</div>
                    ) : null}
                    <div style={{ marginTop: 8, opacity: 0.8, fontWeight: 850 }}>
                      Start: {activeEvent.starts_at ? formatBerlin(activeEvent.starts_at) : "—"}
                    </div>
                  </>
                ) : (
                  <IonNote style={{ display: "block" }}>
                    Kein aktives Event gefunden. Bitte unter <b>/games/events</b> ein Event aktiv setzen.
                  </IonNote>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>{scoringHint}</IonNote>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <IonItem style={{ flex: "1 1 560px" }}>
                  <IonLabel position="stacked">Lauf auswählen</IonLabel>
                  <IonSelect
                    value={selectedRunId}
                    interface="popover"
                    placeholder={runs.length ? "Lauf auswählen" : "Keine Läufe"}
                    onIonChange={(e) => setSelectedRunId(String(e.detail.value ?? ""))}
                    disabled={!activeEvent || runs.length === 0 || globalSaving}
                  >
                    {runs.map((r) => {
                      const d = disciplineMap.get(r.discipline_id);
                      const label = `${r.name ?? "Unbenannter Lauf"} · ${d ? `${d.name} (${d.scoring_mode})` : r.discipline_id}`;
                      return (
                        <IonSelectOption key={r.id} value={r.id}>
                          {label}
                        </IonSelectOption>
                      );
                    })}
                  </IonSelect>
                </IonItem>

                <IonButton onClick={() => void saveAllDirty()} disabled={!selectedRunId || !hasDirty || globalSaving}>
                  <IonIcon icon={saveOutline} slot="start" />
                  Alles speichern
                </IonButton>

                {hasDirty ? (
                  <IonChip style={{ height: 24, fontWeight: 900 }}>Änderungen offen</IonChip>
                ) : (
                  <IonChip style={{ height: 24, fontWeight: 900, opacity: 0.75 }}>Alles gespeichert</IonChip>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* TABLE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ergebnisse pro Team</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Schreibt in <b>games_run_results</b>. Ranking/Punkte werden in der DB berechnet (Trigger) und nach Save neu geladen.
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : !activeEvent ? (
                  <IonText color="medium">
                    <p>Bitte zuerst ein Event aktiv setzen.</p>
                  </IonText>
                ) : teams.length === 0 ? (
                  <IonText color="medium">
                    <p>Keine Teams vorhanden. Lege zuerst Teams an.</p>
                  </IonText>
                ) : runs.length === 0 ? (
                  <IonText color="medium">
                    <p>Keine Läufe vorhanden. Lege zuerst Läufe an.</p>
                  </IonText>
                ) : !selectedRunId ? (
                  <IonText color="medium">
                    <p>Bitte oben einen Lauf auswählen.</p>
                  </IonText>
                ) : vmRows.length === 0 ? (
                  <IonText color="medium">
                    <p>Keine Teams geladen.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {vmRows.map((r) => (
                      <IonItem key={r.team.id} detail={false}>
                        <IonLabel style={{ minWidth: 220 }}>
                          <div style={{ fontWeight: 950 }}>{r.team.name}</div>

                          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {r.dirty ? (
                              <IonChip style={{ height: 22, fontWeight: 900 }}>dirty</IonChip>
                            ) : (
                              <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.7 }}>ok</IonChip>
                            )}
                            {r.saving ? <IonChip style={{ height: 22, fontWeight: 900 }}>saving…</IonChip> : null}
                            {r.place != null ? <IonChip style={{ height: 22, fontWeight: 900 }}>Platz {r.place}</IonChip> : null}
                            {r.pointsAwarded != null ? (
                              <IonChip style={{ height: 22, fontWeight: 900 }}>awarded {r.pointsAwarded}</IonChip>
                            ) : null}
                          </div>
                        </IonLabel>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <IonItem style={{ width: 150 }} lines="none">
                            <IonLabel position="stacked">points_manual</IonLabel>
                            <IonInput
                              value={r.pointsManualStr}
                              inputmode="numeric"
                              placeholder="z.B. 10"
                              onIonInput={(e) => updateVmField(r.team.id, "pointsManualStr", String(e.detail.value ?? ""))}
                              disabled={globalSaving || r.saving}
                            />
                          </IonItem>

                          {showTime ? (
                            <IonItem style={{ width: 180 }} lines="none">
                              <IonLabel position="stacked">time_ms</IonLabel>
                              <IonInput
                                value={r.timeStr}
                                placeholder='z.B. "1:23.456"'
                                onIonInput={(e) => updateVmField(r.team.id, "timeStr", String(e.detail.value ?? ""))}
                                disabled={globalSaving || r.saving}
                              />
                            </IonItem>
                          ) : null}

                          {showDist ? (
                            <IonItem style={{ width: 170 }} lines="none">
                              <IonLabel position="stacked">distance</IonLabel>
                              <IonInput
                                value={r.distanceStr}
                                inputmode="decimal"
                                placeholder="z.B. 12.34"
                                onIonInput={(e) => updateVmField(r.team.id, "distanceStr", String(e.detail.value ?? ""))}
                                disabled={globalSaving || r.saving}
                              />
                            </IonItem>
                          ) : null}

                          <IonItem style={{ width: 220 }} lines="none">
                            <IonLabel position="stacked">achieved_at (opt.)</IonLabel>
                            <IonInput
                              value={r.achievedAtLocal}
                              type="datetime-local"
                              onIonInput={(e) => updateVmField(r.team.id, "achievedAtLocal", String(e.detail.value ?? ""))}
                              disabled={globalSaving || r.saving}
                            />
                          </IonItem>

                          <IonItem style={{ width: 240 }} lines="none">
                            <IonLabel position="stacked">note (opt.)</IonLabel>
                            <IonInput
                              value={r.noteStr}
                              placeholder="Notiz…"
                              onIonInput={(e) => updateVmField(r.team.id, "noteStr", String(e.detail.value ?? ""))}
                              disabled={globalSaving || r.saving}
                            />
                          </IonItem>

                          <IonButton
                            size="small"
                            onClick={() => void saveRow(r.team.id)}
                            disabled={globalSaving || r.saving || !r.dirty}
                          >
                            <IonIcon icon={createOutline} slot="start" />
                            Speichern
                          </IonButton>
                        </div>
                      </IonItem>
                    ))}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Wenn bei Zeit/Distanz kein Platz erscheint: DB-Trigger/Funktion für Ranking fehlt oder points_rules Join passt nicht.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast isOpen={toastOpen} message={toastMsg} duration={3000} onDidDismiss={() => setToastOpen(false)} />
      </IonContent>
    </IonPage>
  );
};

export default GamesResults;
