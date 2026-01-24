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
  playOutline,
  refreshOutline,
  trashOutline,
  saveOutline,
  flagOutline,
  checkmarkDoneOutline,
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

// Convert ISO -> yyyy-MM-ddTHH:mm (for datetime-local)
function isoToDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  // local time representation
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

function normalizeStatus(s?: string | null): RunStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "running") return "running";
  if (v === "done") return "done";
  return "planned";
}

type VmRun = {
  id: string;
  discipline_id: string;

  name: string;
  status: RunStatus;

  scheduled_local: string; // datetime-local
  started_local: string;
  finished_local: string;

  sort_order: string; // input string

  saving?: boolean;
};

const GamesRuns: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [vmRuns, setVmRuns] = useState<VmRun[]>([]);

  // Create form
  const [disciplineId, setDisciplineId] = useState<string>("");
  const [runName, setRunName] = useState<string>("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>("");
  const [statusNew, setStatusNew] = useState<RunStatus>("planned");
  const [sortOrderNew, setSortOrderNew] = useState<string>("");

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

  const disciplineMap = useMemo(() => {
    const m = new Map<string, DisciplineRow>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

  const canCreate = useMemo(() => {
    return !!activeEvent?.id && !!disciplineId && !loading && !savingGlobal;
  }, [activeEvent?.id, disciplineId, loading, savingGlobal]);

  const resetForm = () => {
    setDisciplineId("");
    setRunName("");
    setScheduledAtLocal("");
    setStatusNew("planned");
    setSortOrderNew("");
  };

  // ---------- Loaders ----------

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const ev = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!ev.error && ev.data?.id) return ev.data as ActiveEventRow;

    const v = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (v.error) throw v.error;
    return (v.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
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
      .select(
        "id,event_id,discipline_id,name,scheduled_at,started_at,finished_at,status,sort_order,created_at,updated_at"
      )
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (res.error) throw res.error;

    const r = ((res.data as RunRow[]) ?? []);
    setRuns(r);

    // Build VM
    setVmRuns(
      r.map((x) => ({
        id: x.id,
        discipline_id: x.discipline_id,
        name: x.name ?? "",
        status: normalizeStatus(x.status),
        scheduled_local: isoToDatetimeLocal(x.scheduled_at),
        started_local: isoToDatetimeLocal(x.started_at),
        finished_local: isoToDatetimeLocal(x.finished_at),
        sort_order: x.sort_order != null ? String(x.sort_order) : "",
        saving: false,
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
        setVmRuns([]);
        return;
      }

      await Promise.all([loadDisciplines(ev.id), loadRuns(ev.id)]);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
      setDisciplines([]);
      setRuns([]);
      setVmRuns([]);
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
      toast("Geplanter Start konnte nicht geparst werden.");
      return;
    }

    const parsedSort = sortOrderNew.trim().length ? Number(sortOrderNew) : null;
    if (sortOrderNew.trim().length && !Number.isFinite(parsedSort)) {
      toast("sort_order muss eine Zahl sein.");
      return;
    }

    setSavingGlobal(true);

    const payload = {
      event_id: activeEvent.id,
      discipline_id: disciplineId,
      name: runName.trim().length ? runName.trim() : null,
      scheduled_at: iso,
      status: statusNew ?? "planned",
      sort_order: parsedSort,
    };

    const res = await supabase
      .from("games_runs")
      .insert(payload)
      .select(
        "id,event_id,discipline_id,name,scheduled_at,started_at,finished_at,status,sort_order,created_at,updated_at"
      )
      .single();

    setSavingGlobal(false);

    if (res.error) {
      toast(`Create Fehler: ${res.error.message}`);
      return;
    }

    toast("Lauf angelegt.");
    resetForm();
    await loadRuns(activeEvent.id);
  };

  const askDelete = (r: VmRun) => {
    setDeleteId(r.id);
    setDeleteName(r.name?.trim().length ? r.name : "Unbenannter Lauf");
    setConfirmOpen(true);
  };

  const deleteRun = async () => {
    if (!deleteId) return;

    setSavingGlobal(true);
    const res = await supabase.from("games_runs").delete().eq("id", deleteId);
    setSavingGlobal(false);
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

  const updateVm = (id: string, patch: Partial<VmRun>) => {
    setVmRuns((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const saveRun = async (id: string) => {
    const vm = vmRuns.find((x) => x.id === id);
    const original = runs.find((x) => x.id === id);
    if (!vm || !original) return;

    // Validate
    const parsedSort = vm.sort_order.trim().length ? Number(vm.sort_order) : null;
    if (vm.sort_order.trim().length && !Number.isFinite(parsedSort)) {
      toast("sort_order muss eine Zahl sein.");
      return;
    }

    const scheduledIso = vm.scheduled_local ? datetimeLocalToISO(vm.scheduled_local) : null;
    const startedIso = vm.started_local ? datetimeLocalToISO(vm.started_local) : null;
    const finishedIso = vm.finished_local ? datetimeLocalToISO(vm.finished_local) : null;

    if (vm.scheduled_local && !scheduledIso) {
      toast("scheduled_at konnte nicht geparst werden.");
      return;
    }
    if (vm.started_local && !startedIso) {
      toast("started_at konnte nicht geparst werden.");
      return;
    }
    if (vm.finished_local && !finishedIso) {
      toast("finished_at konnte nicht geparst werden.");
      return;
    }

    updateVm(id, { saving: true });

    const payload: any = {
      name: vm.name.trim().length ? vm.name.trim() : null,
      status: vm.status,
      scheduled_at: scheduledIso,
      started_at: startedIso,
      finished_at: finishedIso,
      sort_order: parsedSort,
      updated_at: new Date().toISOString(),
    };

    const res = await supabase
      .from("games_runs")
      .update(payload)
      .eq("id", id)
      .select(
        "id,event_id,discipline_id,name,scheduled_at,started_at,finished_at,status,sort_order,created_at,updated_at"
      )
      .single();

    updateVm(id, { saving: false });

    if (res.error) {
      toast(`Update Fehler: ${res.error.message}`);
      // revert UI to original
      updateVm(id, {
        name: original.name ?? "",
        status: normalizeStatus(original.status),
        scheduled_local: isoToDatetimeLocal(original.scheduled_at),
        started_local: isoToDatetimeLocal(original.started_at),
        finished_local: isoToDatetimeLocal(original.finished_at),
        sort_order: original.sort_order != null ? String(original.sort_order) : "",
      });
      return;
    }

    toast("Gespeichert.");
    // reload to sync
    if (activeEvent?.id) await loadRuns(activeEvent.id);
  };

  const quickStart = async (id: string) => {
    const vm = vmRuns.find((x) => x.id === id);
    if (!vm) return;

    // status=running + started_at if empty
    const nowIso = new Date().toISOString();
    updateVm(id, {
      status: "running",
      started_local: vm.started_local || isoToDatetimeLocal(nowIso),
    });

    await saveRun(id);
  };

  const quickDone = async (id: string) => {
    const vm = vmRuns.find((x) => x.id === id);
    if (!vm) return;

    const nowIso = new Date().toISOString();
    updateVm(id, {
      status: "done",
      finished_local: vm.finished_local || isoToDatetimeLocal(nowIso),
      started_local: vm.started_local || isoToDatetimeLocal(nowIso),
    });

    await saveRun(id);
  };

  const statusChip = (s?: string | null) => {
    const val = normalizeStatus(s);
    return <IonChip style={{ height: 22, fontWeight: 900, opacity: 0.9 }}>{val}</IonChip>;
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
            <IonButton onClick={() => void loadAll()} disabled={loading || savingGlobal}>
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
                Läufe hängen am aktiven Event + Disziplin. Spalten: <b>scheduled_at / started_at / finished_at</b>.
              </IonNote>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Disziplin</IonLabel>
                  <IonSelect
                    value={disciplineId}
                    interface="popover"
                    placeholder={disciplines.length ? "Disziplin auswählen" : "Keine Disziplinen"}
                    onIonChange={(e) => setDisciplineId(String(e.detail.value ?? ""))}
                    disabled={savingGlobal || !activeEvent || disciplines.length === 0}
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
                    disabled={savingGlobal || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Geplant (scheduled_at, optional)</IonLabel>
                  <IonInput
                    value={scheduledAtLocal}
                    type="datetime-local"
                    onIonInput={(e) => setScheduledAtLocal(String(e.detail.value ?? ""))}
                    disabled={savingGlobal || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Status</IonLabel>
                  <IonSelect
                    value={statusNew}
                    interface="popover"
                    onIonChange={(e) => setStatusNew(e.detail.value as RunStatus)}
                    disabled={savingGlobal || !activeEvent}
                  >
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
                    placeholder="z. B. 1"
                    onIonInput={(e) => setSortOrderNew(String(e.detail.value ?? ""))}
                    disabled={savingGlobal || !activeEvent}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createRun()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={savingGlobal || !activeEvent}>
                    Zurücksetzen
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* RUNS LIST + EDIT */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Läufe (bearbeitbar)</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Status & Zeiten können angepasst werden. Empfehlung: <b>running</b> setzt started_at, <b>done</b> setzt finished_at.
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : !activeEvent ? (
                  <IonText color="medium">
                    <p>Bitte zuerst ein Event aktiv setzen.</p>
                  </IonText>
                ) : vmRuns.length === 0 ? (
                  <IonText color="medium">
                    <p>Noch keine Läufe vorhanden.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {vmRuns.map((r) => {
                      const d = disciplineMap.get(r.discipline_id);
                      const isSaving = !!r.saving || savingGlobal;

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

                            {/* Editable fields */}
                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Name</div>
                                <IonInput
                                  value={r.name}
                                  placeholder="Name"
                                  onIonInput={(e) => updateVm(r.id, { name: String(e.detail.value ?? "") })}
                                  disabled={isSaving}
                                />
                              </div>

                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Status</div>
                                <IonSelect
                                  value={r.status}
                                  interface="popover"
                                  onIonChange={(e) => updateVm(r.id, { status: e.detail.value as RunStatus })}
                                  disabled={isSaving}
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
                                  onIonInput={(e) => updateVm(r.id, { scheduled_local: String(e.detail.value ?? "") })}
                                  disabled={isSaving}
                                />
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                                  Aktuell: {r.scheduled_local ? formatBerlin(datetimeLocalToISO(r.scheduled_local)) : "—"}
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>sort_order</div>
                                <IonInput
                                  value={r.sort_order}
                                  inputmode="numeric"
                                  placeholder="z. B. 1"
                                  onIonInput={(e) => updateVm(r.id, { sort_order: String(e.detail.value ?? "") })}
                                  disabled={isSaving}
                                />
                              </div>

                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>started_at</div>
                                <IonInput
                                  value={r.started_local}
                                  type="datetime-local"
                                  onIonInput={(e) => updateVm(r.id, { started_local: String(e.detail.value ?? "") })}
                                  disabled={isSaving}
                                />
                              </div>

                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>finished_at</div>
                                <IonInput
                                  value={r.finished_local}
                                  type="datetime-local"
                                  onIonInput={(e) => updateVm(r.id, { finished_local: String(e.detail.value ?? "") })}
                                  disabled={isSaving}
                                />
                              </div>
                            </div>

                            {/* Quick actions */}
                            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                              <IonButton
                                size="small"
                                fill="outline"
                                onClick={() => void quickStart(r.id)}
                                disabled={isSaving}
                              >
                                <IonIcon icon={flagOutline} slot="start" />
                                Starten
                              </IonButton>

                              <IonButton
                                size="small"
                                fill="outline"
                                onClick={() => void quickDone(r.id)}
                                disabled={isSaving}
                              >
                                <IonIcon icon={checkmarkDoneOutline} slot="start" />
                                Done
                              </IonButton>

                              <IonButton
                                size="small"
                                onClick={() => void saveRun(r.id)}
                                disabled={isSaving}
                              >
                                <IonIcon icon={saveOutline} slot="start" />
                                Speichern
                              </IonButton>

                              <IonButton
                                size="small"
                                color="danger"
                                fill="outline"
                                disabled={isSaving}
                                onClick={() => askDelete(r)}
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
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Wenn Update/Delete fehlschlägt: häufig RLS oder FK (Results hängen an Run).
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

export default GamesRuns;
