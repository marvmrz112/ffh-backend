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
import { addOutline, refreshOutline, trashOutline, playOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

/**
 * Admin backend: DO NOT depend on games_active_event view.
 * Always read active event directly from games_events (active=true).
 */

type ActiveEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
};

type ScoringMode = "points_only" | "time_best" | "distance_best";

type DisciplineRow = {
  id: string;
  event_id: string;
  name: string;
  scoring_mode: ScoringMode;
  // optional in DB; we handle missing column gracefully
  sort_order?: number | null;
};

type RunStatus = "scheduled" | "running" | "done";

type RunRow = {
  id: string;
  event_id: string;
  discipline_id: string;
  name: string | null;
  starts_at: string | null;
  status: RunStatus | string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

function toIsoOrNull(datetimeLocal: string): string | null {
  const v = (datetimeLocal ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isRlsError(msg?: string) {
  const m = (msg ?? "").toLowerCase();
  return m.includes("row-level security") || m.includes("rls") || m.includes("policy");
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
  const [startsAtLocal, setStartsAtLocal] = useState<string>("");
  const [status, setStatus] = useState<RunStatus>("scheduled");

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
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

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const res = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at,updated_at,created_at")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res.error) throw res.error;
    return (res.data as any as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    // Try with sort_order; fallback if column not present
    const withSort = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode,sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (!withSort.error) {
      setDisciplines((withSort.data as DisciplineRow[]) ?? []);
      return;
    }

    const msg = withSort.error.message?.toLowerCase?.() ?? "";
    if (msg.includes("sort_order") || msg.includes("does not exist")) {
      const fallback = await supabase
        .from("games_disciplines")
        .select("id,event_id,name,scoring_mode")
        .eq("event_id", eventId)
        .order("name", { ascending: true });

      if (fallback.error) throw fallback.error;
      setDisciplines((fallback.data as DisciplineRow[]) ?? []);
      return;
    }

    throw withSort.error;
  };

  const loadRuns = async (eventId: string) => {
    const res = await supabase
      .from("games_runs")
      .select("id,event_id,discipline_id,name,starts_at,status,created_at,updated_at")
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
        setRuns([]);
        return;
      }

      await Promise.all([loadDisciplines(ev.id), loadRuns(ev.id)]);
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      toast(`Load Fehler: ${msg}`);
      setActiveEvent(null);
      setDisciplines([]);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const createRun = async () => {
    if (!activeEvent?.id) {
      toast("Kein aktives Event. Bitte zuerst unter /games/events ein Event aktiv setzen.");
      return;
    }
    if (!disciplineId) {
      toast("Bitte eine Disziplin auswählen.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        event_id: activeEvent.id,
        discipline_id: disciplineId,
        name: runName.trim().length ? runName.trim() : null,
        starts_at: toIsoOrNull(startsAtLocal),
        status: status ?? "scheduled",
        updated_at: new Date().toISOString(),
      };

      const res = await supabase
        .from("games_runs")
        .insert(payload)
        .select("id,event_id,discipline_id,name,starts_at,status,created_at,updated_at")
        .single();

      if (res.error) throw res.error;

      toast("Lauf angelegt.");
      resetForm();
      await loadRuns(activeEvent.id);
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      if (isRlsError(msg)) toast(`Create geblockt (RLS/Policy): ${msg}`);
      else toast(`Create Fehler: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const disciplineMap = useMemo(() => {
    const m = new Map<string, DisciplineRow>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

  const askDelete = (r: RunRow) => {
    setDeleteTarget({ id: r.id, name: r.name ?? "Unbenannter Lauf" });
    setConfirmOpen(true);
  };

  const deleteRun = async () => {
    if (!deleteTarget?.id) return;

    setSaving(true);
    setConfirmOpen(false);

    try {
      const res = await supabase.from("games_runs").delete().eq("id", deleteTarget.id);
      if (res.error) throw res.error;

      toast("Lauf gelöscht.");
      setDeleteTarget(null);

      if (activeEvent?.id) await loadRuns(activeEvent.id);
      else await loadAll();
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      if (isRlsError(msg)) toast(`Delete geblockt (RLS/Policy): ${msg}`);
      else if ((msg ?? "").toLowerCase().includes("foreign key"))
        toast("Delete nicht möglich: Es hängen noch Ergebnisse an diesem Lauf (FK). Erst Results löschen.");
      else toast(`Delete Fehler: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const statusChip = (s?: string | null) => {
    const val = (s ?? "").toLowerCase();
    const label = val === "running" ? "running" : val === "done" ? "done" : "scheduled";
    return <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.9 }}>{label}</IonChip>;
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
                      Start: {activeEvent.starts_at ? formatBerlin(activeEvent.starts_at) : "—"}
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
                  Hinweis: Keine Disziplinen gefunden. Lege zuerst Disziplinen an (<b>/games/disciplines</b>).
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
                              <div
                                style={{
                                  fontWeight: 950,
                                  fontSize: 16,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {r.name ?? "Unbenannter Lauf"}
                              </div>
                              {statusChip(r.status)}
                            </div>

                            <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.9 }}>
                              <span style={{ fontSize: 12, fontWeight: 850 }}>
                                Disziplin: {d ? `${d.name} (${d.scoring_mode})` : r.discipline_id}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.8 }}>
                                Start: {r.starts_at ? formatBerlin(r.starts_at) : "—"}
                              </span>
                            </div>
                          </IonLabel>

                          <IonButton size="small" color="danger" fill="outline" disabled={saving} onClick={() => askDelete(r)}>
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
          message={`Willst du "${deleteTarget?.name ?? ""}" wirklich löschen?`}
          buttons={[
            { text: "Abbrechen", role: "cancel" },
            { text: "Löschen", role: "destructive", handler: () => void deleteRun() },
          ]}
        />

        <IonToast isOpen={toastOpen} message={toastMsg} duration={3200} onDidDismiss={() => setToastOpen(false)} />
      </IonContent>
    </IonPage>
  );
};

export default GamesRuns;
