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
import {
  addOutline,
  refreshOutline,
  trashOutline,
  flagOutline,
  checkmarkDoneOutline,
  saveOutline,
} from "ionicons/icons";
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

  status: string | null;
  sort_order: number | null;

  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type VmRun = {
  id: string;
  discipline_id: string;

  name: string;
  status: RunStatus;

  sort_order: string;

  scheduled_local: string; // datetime-local
  started_local: string;
  finished_local: string;

  busy: boolean;
};

function normalizeStatus(s?: string | null): RunStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "running") return "running";
  if (v === "done") return "done";
  return "planned";
}

function formatBerlin(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function isoToDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToISO(value: string): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

const SELECT_RUNS =
  "id,event_id,discipline_id,name,status,sort_order,scheduled_at,started_at,finished_at,created_at,updated_at";

const GamesRuns: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [vm, setVm] = useState<VmRun[]>([]);

  // Create form
  const [disciplineId, setDisciplineId] = useState("");
  const [runName, setRunName] = useState("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [statusNew, setStatusNew] = useState<RunStatus>("planned");
  const [sortOrderNew, setSortOrderNew] = useState("");

  // Delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // Toast
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

  const canCreate = useMemo(() => {
    return !!activeEvent?.id && !!disciplineId && !loading;
  }, [activeEvent?.id, disciplineId, loading]);

  const setBusy = (id: string, busy: boolean) => {
    setVm((prev) => prev.map((r) => (r.id === id ? { ...r, busy } : r)));
  };

  const patchVm = (id: string, patch: Partial<VmRun>) => {
    setVm((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // ---------- Load ----------
  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    // Prefer games_events.active
    const ev = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!ev.error && ev.data?.id) return ev.data as ActiveEventRow;

    // fallback view
    const v = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (v.error) throw v.error;
    return (v.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    const r = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode,sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (r.error) throw r.error;
    setDisciplines((r.data as DisciplineRow[]) ?? []);
  };

  const loadRuns = async (eventId: string) => {
    const r = await supabase
      .from("games_runs")
      .select(SELECT_RUNS)
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (r.error) throw r.error;

    const rows = (r.data as RunRow[]) ?? [];
    setRuns(rows);

    setVm(
      rows.map((x) => ({
        id: x.id,
        discipline_id: x.discipline_id,
        name: x.name ?? "",
        status: normalizeStatus(x.status),
        sort_order: x.sort_order != null ? String(x.sort_order) : "",
        scheduled_local: isoToDatetimeLocal(x.scheduled_at),
        started_local: isoToDatetimeLocal(x.started_at),
        finished_local: isoToDatetimeLocal(x.finished_at),
        busy: false,
      }))
    );
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const ev = await loadActiveEvent();
      setActiveEvent(ev);

      if (!ev?.id) {
        setDisciplines([]);
        setRuns([]);
        setVm([]);
        return;
      }

      await Promise.all([loadDisciplines(ev.id), loadRuns(ev.id)]);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
      setDisciplines([]);
      setRuns([]);
      setVm([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Create ----------
  const createRun = async () => {
    if (!activeEvent?.id) return toast("Kein aktives Event.");
    if (!disciplineId) return toast("Bitte Disziplin auswählen.");

    const scheduledIso = scheduledAtLocal ? datetimeLocalToISO(scheduledAtLocal) : null;
    if (scheduledAtLocal && !scheduledIso) return toast("scheduled_at konnte nicht geparst werden.");

    const parsedSort = sortOrderNew.trim().length ? Number(sortOrderNew) : null;
    if (sortOrderNew.trim().length && !Number.isFinite(parsedSort)) return toast("sort_order muss eine Zahl sein.");

    const payload = {
      event_id: activeEvent.id,
      discipline_id: disciplineId,
      name: runName.trim().length ? runName.trim() : null,
      status: statusNew,
      sort_order: parsedSort,
      scheduled_at: scheduledIso,
    };

    const res = await supabase.from("games_runs").insert(payload).select(SELECT_RUNS).single();
    if (res.error) return toast(`Create Fehler: ${res.error.message}`);

    toast("Lauf angelegt.");
    setDisciplineId("");
    setRunName("");
    setScheduledAtLocal("");
    setStatusNew("planned");
    setSortOrderNew("");

    await loadRuns(activeEvent.id);
  };

  // ---------- Update (single row) ----------
  const updateRun = async (id: string, patch: Partial<RunRow>) => {
    setBusy(id, true);
    const res = await supabase.from("games_runs").update(patch).eq("id", id).select(SELECT_RUNS).single();
    setBusy(id, false);

    if (res.error) {
      toast(`Update Fehler: ${res.error.message}`);
      // reload to sync / revert safely
      if (activeEvent?.id) await loadRuns(activeEvent.id);
      return null;
    }

    // apply returned row to local states
    const updated = res.data as RunRow;
    setRuns((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setVm((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              name: updated.name ?? "",
              status: normalizeStatus(updated.status),
              sort_order: updated.sort_order != null ? String(updated.sort_order) : "",
              scheduled_local: isoToDatetimeLocal(updated.scheduled_at),
              started_local: isoToDatetimeLocal(updated.started_at),
              finished_local: isoToDatetimeLocal(updated.finished_at),
            }
          : v
      )
    );

    return updated;
  };

  const saveRow = async (id: string) => {
    const row = vm.find((x) => x.id === id);
    if (!row) return;

    const parsedSort = row.sort_order.trim().length ? Number(row.sort_order) : null;
    if (row.sort_order.trim().length && !Number.isFinite(parsedSort)) return toast("sort_order muss eine Zahl sein.");

    const scheduledIso = row.scheduled_local ? datetimeLocalToISO(row.scheduled_local) : null;
    const startedIso = row.started_local ? datetimeLocalToISO(row.started_local) : null;
    const finishedIso = row.finished_local ? datetimeLocalToISO(row.finished_local) : null;

    if (row.scheduled_local && !scheduledIso) return toast("scheduled_at konnte nicht geparst werden.");
    if (row.started_local && !startedIso) return toast("started_at konnte nicht geparst werden.");
    if (row.finished_local && !finishedIso) return toast("finished_at konnte nicht geparst werden.");

    await updateRun(id, {
      name: row.name.trim().length ? row.name.trim() : null,
      status: row.status,
      sort_order: parsedSort,
      scheduled_at: scheduledIso,
      started_at: startedIso,
      finished_at: finishedIso,
      updated_at: new Date().toISOString(),
    } as any);

    toast("Gespeichert.");
  };

  // ---------- Buttons (NO state race) ----------
  const clickStart = async (id: string) => {
    const nowIso = new Date().toISOString();

    // if started_at already set, keep it
    const current = runs.find((r) => r.id === id);
    const started = current?.started_at ?? nowIso;

    await updateRun(id, {
      status: "running",
      started_at: started,
      updated_at: nowIso,
    } as any);
  };

  const clickDone = async (id: string) => {
    const nowIso = new Date().toISOString();
    const current = runs.find((r) => r.id === id);

    // ensure started_at exists when done
    const started = current?.started_at ?? nowIso;

    await updateRun(id, {
      status: "done",
      started_at: started,
      finished_at: current?.finished_at ?? nowIso,
      updated_at: nowIso,
    } as any);
  };

  // ---------- Delete ----------
  const askDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name?.trim().length ? name : "Unbenannter Lauf");
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!deleteId) return;

    const res = await supabase.from("games_runs").delete().eq("id", deleteId);
    setConfirmOpen(false);

    if (res.error) return toast(`Delete Fehler: ${res.error.message}`);

    toast("Lauf gelöscht.");
    setDeleteId(null);
    setDeleteName("");
    if (activeEvent?.id) await loadRuns(activeEvent.id);
  };

  const statusChip = (s: RunStatus) => (
    <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.9 }}>{s}</IonChip>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/games" />
          </IonButtons>

          <IonTitle>Games · Läufe</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={() => void loadAll()} disabled={loading}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {/* ACTIVE EVENT */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Aktives Event</div>
              {loading ? (
                <IonSpinner />
              ) : activeEvent ? (
                <>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>{activeEvent.name}</div>
                  <div style={{ marginTop: 6, opacity: 0.8, fontWeight: 850 }}>
                    Start: {formatBerlin(activeEvent.starts_at)}
                  </div>
                </>
              ) : (
                <IonNote>
                  Kein aktives Event gefunden. Bitte unter <b>/games/events</b> aktiv setzen.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>

          {/* CREATE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950, fontSize: 16 }}>
                <IonIcon icon={addOutline} />
                Neuen Lauf anlegen
              </div>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Disziplin</IonLabel>
                  <IonSelect
                    value={disciplineId}
                    interface="popover"
                    placeholder={disciplines.length ? "Disziplin auswählen" : "Keine Disziplinen"}
                    onIonChange={(e) => setDisciplineId(String(e.detail.value ?? ""))}
                    disabled={!activeEvent || disciplines.length === 0}
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
                  <IonInput value={runName} onIonInput={(e) => setRunName(String(e.detail.value ?? ""))} />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">scheduled_at (optional)</IonLabel>
                  <IonInput
                    value={scheduledAtLocal}
                    type="datetime-local"
                    onIonInput={(e) => setScheduledAtLocal(String(e.detail.value ?? ""))}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Status</IonLabel>
                  <IonSelect value={statusNew} interface="popover" onIonChange={(e) => setStatusNew(e.detail.value as RunStatus)}>
                    <IonSelectOption value="planned">planned</IonSelectOption>
                    <IonSelectOption value="running">running</IonSelectOption>
                    <IonSelectOption value="done">done</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">sort_order (optional)</IonLabel>
                  <IonInput
                    value={sortOrderNew}
                    inputmode="numeric"
                    onIonInput={(e) => setSortOrderNew(String(e.detail.value ?? ""))}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createRun()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Läufe</div>

              {loading ? (
                <IonSpinner />
              ) : !activeEvent ? (
                <IonText color="medium"><p>Bitte Event aktiv setzen.</p></IonText>
              ) : vm.length === 0 ? (
                <IonText color="medium"><p>Noch keine Läufe vorhanden.</p></IonText>
              ) : (
                <IonList lines="inset">
                  {vm.map((r) => {
                    const d = disciplineMap.get(r.discipline_id);
                    return (
                      <IonItem key={r.id} detail={false}>
                        <IonLabel style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950, fontSize: 16 }}>
                              {r.name?.trim().length ? r.name : "Unbenannter Lauf"}
                            </div>
                            {statusChip(r.status)}
                            <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.8 }}>
                              Disziplin: {d ? `${d.name} (${d.scoring_mode})` : r.discipline_id}
                            </span>
                          </div>

                          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Name</div>
                              <IonInput
                                value={r.name}
                                onIonInput={(e) => patchVm(r.id, { name: String(e.detail.value ?? "") })}
                                disabled={r.busy}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Status</div>
                              <IonSelect
                                value={r.status}
                                interface="popover"
                                onIonChange={(e) => patchVm(r.id, { status: e.detail.value as RunStatus })}
                                disabled={r.busy}
                              >
                                <IonSelectOption value="planned">planned</IonSelectOption>
                                <IonSelectOption value="running">running</IonSelectOption>
                                <IonSelectOption value="done">done</IonSelectOption>
                              </IonSelect>
                            </div>

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>scheduled_at</div>
                              <IonInput
                                value={r.scheduled_local}
                                type="datetime-local"
                                onIonInput={(e) => patchVm(r.id, { scheduled_local: String(e.detail.value ?? "") })}
                                disabled={r.busy}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>sort_order</div>
                              <IonInput
                                value={r.sort_order}
                                inputmode="numeric"
                                onIonInput={(e) => patchVm(r.id, { sort_order: String(e.detail.value ?? "") })}
                                disabled={r.busy}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>started_at</div>
                              <IonInput
                                value={r.started_local}
                                type="datetime-local"
                                onIonInput={(e) => patchVm(r.id, { started_local: String(e.detail.value ?? "") })}
                                disabled={r.busy}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>finished_at</div>
                              <IonInput
                                value={r.finished_local}
                                type="datetime-local"
                                onIonInput={(e) => patchVm(r.id, { finished_local: String(e.detail.value ?? "") })}
                                disabled={r.busy}
                              />
                            </div>
                          </div>

                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, fontWeight: 800 }}>
                            Vorschau: gepl.: {r.scheduled_local ? formatBerlin(datetimeLocalToISO(r.scheduled_local)) : "—"} |{" "}
                            start: {r.started_local ? formatBerlin(datetimeLocalToISO(r.started_local)) : "—"} |{" "}
                            ende: {r.finished_local ? formatBerlin(datetimeLocalToISO(r.finished_local)) : "—"}
                          </div>

                          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                            <IonButton
                              size="small"
                              fill="outline"
                              onClick={() => void clickStart(r.id)}
                              disabled={r.busy}
                            >
                              <IonIcon icon={flagOutline} slot="start" />
                              Starten
                            </IonButton>

                            <IonButton
                              size="small"
                              fill="outline"
                              onClick={() => void clickDone(r.id)}
                              disabled={r.busy}
                            >
                              <IonIcon icon={checkmarkDoneOutline} slot="start" />
                              Done
                            </IonButton>

                            <IonButton size="small" onClick={() => void saveRow(r.id)} disabled={r.busy}>
                              <IonIcon icon={saveOutline} slot="start" />
                              Speichern
                            </IonButton>

                            <IonButton
                              size="small"
                              color="danger"
                              fill="outline"
                              onClick={() => askDelete(r.id, r.name)}
                              disabled={r.busy}
                            >
                              <IonIcon icon={trashOutline} slot="start" />
                              Löschen
                            </IonButton>
                          </div>
                        </IonLabel>
                      </IonItem>
                    );
                  })}
                </IonList>
              )}

              <IonNote style={{ display: "block", marginTop: 12 }}>
                Wichtig: “Starten/Done” schreibt direkt in die DB (kein State-Race). Wenn es trotzdem zurückspringt, ist es RLS/Constraint.
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
            { text: "Löschen", role: "destructive", handler: () => void doDelete() },
          ]}
        />

        <IonToast isOpen={toastOpen} message={toastMsg} duration={3000} onDidDismiss={() => setToastOpen(false)} />
      </IonContent>
    </IonPage>
  );
};

export default GamesRuns;
