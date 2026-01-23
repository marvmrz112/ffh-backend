import React, { useEffect, useMemo, useState } from "react";
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
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonToast,
  IonInput,
  IonChip,
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
  starts_at: string | null;
  status: string | null;
};

type RunResultRow = {
  run_id: string;
  team_id: string;
  points: number | null;
  time_ms: number | null;
  distance_mm: number | null;
};

type RowVM = {
  team: TeamRow;
  pointsStr: string;
  timeStr: string;
  distStr: string;
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

function parseIntOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseMsFromMSS(v: string): number | null {
  // accepts "m:ss", "mm:ss", "ss", "ss.sss" (treated as seconds), or plain ms if big
  const s = v.trim();
  if (!s) return null;

  if (s.includes(":")) {
    const [mStr, secStr] = s.split(":");
    const m = Number(mStr);
    const sec = Number(secStr.replace(",", "."));
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
    const ms = Math.round((m * 60 + sec) * 1000);
    return ms;
  }

  // If it's a large integer (>= 1000), assume ms
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;

  if (n >= 1000 && Number.isInteger(n)) return Math.trunc(n);

  // otherwise assume seconds
  return Math.round(n * 1000);
}

function msToMSS(ms?: number | null): string {
  if (ms == null) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const res = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (res.error) throw res.error;
    return (res.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    // sort_order may exist; if not, remove order below
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
      .select("id,discipline_id,name,starts_at,status,created_at")
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

  const loadResultsForRun = async (runId: string) => {
    if (!runId) {
      setResultsByTeam(new Map());
      setVmRows([]);
      return;
    }

    setLoading(true);
    try {
      const res = await supabase
        .from("games_run_results")
        .select("run_id,team_id,points,time_ms,distance_mm")
        .eq("run_id", runId);

      if (res.error) throw res.error;

      const map = new Map<string, RunResultRow>();
      (res.data as RunResultRow[] | null)?.forEach((r) => map.set(r.team_id, r));
      setResultsByTeam(map);

      // Build VM rows for all teams (even without result yet)
      const vms: RowVM[] = teams.map((t) => {
        const r = map.get(t.id);
        return {
          team: t,
          pointsStr: r?.points != null ? String(r.points) : "",
          timeStr: r?.time_ms != null ? msToMSS(r.time_ms) : "",
          distStr: r?.distance_mm != null ? String(r.distance_mm) : "",
          dirty: false,
          saving: false,
        };
      });

      setVmRows(vms);
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

  // Reload results when run changes (and teams already loaded)
  useEffect(() => {
    if (!selectedRunId) {
      setResultsByTeam(new Map());
      setVmRows([]);
      return;
    }
    // Only load if teams are present (VM relies on teams)
    if (teams.length === 0) return;
    void loadResultsForRun(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, teams.length]);

  const updateVmField = (teamId: string, field: "pointsStr" | "timeStr" | "distStr", value: string) => {
    setVmRows((prev) =>
      prev.map((r) => {
        if (r.team.id !== teamId) return r;
        return { ...r, [field]: value, dirty: true };
      })
    );
  };

  const buildUpsertPayload = (r: RowVM): RunResultRow | null => {
    if (!selectedRunId) return null;

    const points = parseIntOrNull(r.pointsStr);
    const time_ms = scoringMode === "time_best" ? parseMsFromMSS(r.timeStr) : null;
    const distance_mm = scoringMode === "distance_best" ? parseIntOrNull(r.distStr) : null;

    // If user typed something invalid (e.g., time parse fails)
    if (scoringMode === "time_best" && r.timeStr.trim().length > 0 && time_ms == null) return null;
    if (scoringMode === "distance_best" && r.distStr.trim().length > 0 && distance_mm == null) return null;

    // Save even if all are null? That would create empty rows. Better: if all are null -> return null and delete instead.
    const allNull = points == null && time_ms == null && distance_mm == null;
    if (allNull) return null;

    return {
      run_id: selectedRunId,
      team_id: r.team.id,
      points,
      time_ms,
      distance_mm,
    };
  };

  const saveRow = async (teamId: string) => {
    if (!selectedRunId) {
      toast("Bitte zuerst einen Lauf auswählen.");
      return;
    }

    const row = vmRows.find((x) => x.team.id === teamId);
    if (!row) return;

    const payload = buildUpsertPayload(row);

    // If payload null -> delete existing row (if any)
    setVmRows((prev) => prev.map((x) => (x.team.id === teamId ? { ...x, saving: true } : x)));

    try {
      if (!payload) {
        const del = await supabase
          .from("games_run_results")
          .delete()
          .eq("run_id", selectedRunId)
          .eq("team_id", teamId);

        if (del.error) throw del.error;

        setVmRows((prev) =>
          prev.map((x) =>
            x.team.id === teamId ? { ...x, dirty: false, saving: false, pointsStr: x.pointsStr, timeStr: x.timeStr, distStr: x.distStr } : x
          )
        );

        toast("Eintrag gelöscht (leer gespeichert).");
        // refresh results to stay aligned
        await loadResultsForRun(selectedRunId);
        return;
      }

      // Requires unique constraint on (run_id, team_id) for onConflict to work reliably
      const up = await supabase
        .from("games_run_results")
        .upsert(payload, { onConflict: "run_id,team_id" })
        .select("run_id,team_id,points,time_ms,distance_mm")
        .maybeSingle();

      if (up.error) throw up.error;

      setVmRows((prev) =>
        prev.map((x) => (x.team.id === teamId ? { ...x, dirty: false, saving: false } : x))
      );

      toast("Gespeichert.");
      await loadResultsForRun(selectedRunId);
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      const lower = String(msg).toLowerCase();
      if (lower.includes("row-level security") || lower.includes("policy")) {
        toast("Save geblockt: RLS/Policy verhindert Write auf games_run_results.");
      } else {
        toast(`Save Fehler: ${msg}`);
      }
      setVmRows((prev) => prev.map((x) => (x.team.id === teamId ? { ...x, saving: false } : x)));
    }
  };

  const saveAllDirty = async () => {
    if (!selectedRunId) {
      toast("Bitte zuerst einen Lauf auswählen.");
      return;
    }
    if (!hasDirty) {
      toast("Nichts zu speichern.");
      return;
    }

    setGlobalSaving(true);
    try {
      // Build payloads for dirty rows only
      const dirty = vmRows.filter((r) => r.dirty);

      // Upserts to perform
      const upserts: RunResultRow[] = [];
      const deletes: { team_id: string }[] = [];

      for (const r of dirty) {
        const payload = buildUpsertPayload(r);
        if (!payload) {
          deletes.push({ team_id: r.team.id });
        } else {
          upserts.push(payload);
        }
      }

      if (upserts.length) {
        const up = await supabase
          .from("games_run_results")
          .upsert(upserts, { onConflict: "run_id,team_id" });

        if (up.error) throw up.error;
      }

      // deletes one-by-one (simpler and safe)
      for (const d of deletes) {
        const del = await supabase
          .from("games_run_results")
          .delete()
          .eq("run_id", selectedRunId)
          .eq("team_id", d.team_id);

        if (del.error) throw del.error;
      }

      toast("Alle Änderungen gespeichert.");
      await loadResultsForRun(selectedRunId);
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      const lower = String(msg).toLowerCase();
      if (lower.includes("row-level security") || lower.includes("policy")) {
        toast("Save geblockt: RLS/Policy verhindert Write auf games_run_results.");
      } else {
        toast(`SaveAll Fehler: ${msg}`);
      }
    } finally {
      setGlobalSaving(false);
    }
  };

  const scoringHint = useMemo(() => {
    if (!scoringMode) return "Bitte Lauf auswählen.";
    if (scoringMode === "points_only") return "Modus: points_only (nur Punkte).";
    if (scoringMode === "time_best") return 'Modus: time_best (Zeit). Format z. B. "1:23" oder "83.5".';
    return "Modus: distance_best (Distanz). Einheit: distance_mm (Integer).";
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
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
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
                      <div style={{ marginTop: 4, opacity: 0.85, fontWeight: 750 }}>
                        {activeEvent.subtitle}
                      </div>
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
                <IonItem style={{ flex: "1 1 420px" }}>
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
                      const label = `${r.name ?? "Unbenannter Lauf"} · ${d ? d.name : r.discipline_id}${
                        r.starts_at ? ` · ${formatBerlin(r.starts_at)}` : ""
                      }`;
                      return (
                        <IonSelectOption key={r.id} value={r.id}>
                          {label}
                        </IonSelectOption>
                      );
                    })}
                  </IonSelect>
                </IonItem>

                <IonButton
                  onClick={() => void saveAllDirty()}
                  disabled={!selectedRunId || !hasDirty || globalSaving}
                >
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
                Speichert in <b>games_run_results</b> (upsert per run_id + team_id).
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
                    {vmRows.map((r) => {
                      const showTime = scoringMode === "time_best";
                      const showDist = scoringMode === "distance_best";
                      return (
                        <IonItem key={r.team.id} detail={false}>
                          <IonLabel style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 950 }}>{r.team.name}</div>
                            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                              {r.dirty ? (
                                <IonChip style={{ height: 22, fontWeight: 900 }}>dirty</IonChip>
                              ) : (
                                <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.7 }}>ok</IonChip>
                              )}
                              {r.saving ? (
                                <IonChip style={{ height: 22, fontWeight: 900 }}>saving…</IonChip>
                              ) : null}
                            </div>
                          </IonLabel>

                          {/* Points (always possible) */}
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <IonItem style={{ width: 140 }} lines="none">
                              <IonLabel position="stacked">Punkte</IonLabel>
                              <IonInput
                                value={r.pointsStr}
                                inputmode="numeric"
                                placeholder="z. B. 10"
                                onIonInput={(e) =>
                                  updateVmField(r.team.id, "pointsStr", String(e.detail.value ?? ""))
                                }
                                disabled={globalSaving || r.saving}
                              />
                            </IonItem>

                            {showTime ? (
                              <IonItem style={{ width: 170 }} lines="none">
                                <IonLabel position="stacked">Zeit</IonLabel>
                                <IonInput
                                  value={r.timeStr}
                                  placeholder='z. B. "1:23"'
                                  onIonInput={(e) =>
                                    updateVmField(r.team.id, "timeStr", String(e.detail.value ?? ""))
                                  }
                                  disabled={globalSaving || r.saving}
                                />
                              </IonItem>
                            ) : null}

                            {showDist ? (
                              <IonItem style={{ width: 190 }} lines="none">
                                <IonLabel position="stacked">Distanz (mm)</IonLabel>
                                <IonInput
                                  value={r.distStr}
                                  inputmode="numeric"
                                  placeholder="z. B. 12345"
                                  onIonInput={(e) =>
                                    updateVmField(r.team.id, "distStr", String(e.detail.value ?? ""))
                                  }
                                  disabled={globalSaving || r.saving}
                                />
                              </IonItem>
                            ) : null}

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
                      );
                    })}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Hinweis: Für Upsert braucht ihr in Supabase einen Unique Constraint auf <b>(run_id, team_id)</b>.
              </IonNote>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Wenn Save „RLS/Policy“ meldet: Policies für <b>games_run_results</b> (INSERT/UPDATE/DELETE) für
                authenticated fehlen.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={toastOpen}
          message={toastMsg}
          duration={3000}
          onDidDismiss={() => setToastOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default GamesResults;
