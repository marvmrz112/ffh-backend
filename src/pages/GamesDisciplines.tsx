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
} from "@ionic/react";
import {
  addOutline,
  refreshOutline,
  trashOutline,
  listOutline,
} from "ionicons/icons";
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
  event_id: string;
  name: string;
  scoring_mode: ScoringMode;
  sort_order?: number | null;
  created_at?: string | null;
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

const GamesDisciplines: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("points_only");
  const [sortOrder, setSortOrder] = useState<string>("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const canCreate = useMemo(() => {
    return !!activeEvent?.id && name.trim().length >= 2 && !saving && !loading;
  }, [activeEvent?.id, name, saving, loading]);

  const resetForm = () => {
    setName("");
    setScoringMode("points_only");
    setSortOrder("");
  };

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const res = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (res.error) throw res.error;
    return (res.data as ActiveEventRow) ?? null;
  };

  const loadDisciplines = async (eventId: string) => {
    // sort_order may or may not exist in your schema; if it doesn't, remove it here.
    const res = await supabase
      .from("games_disciplines")
      .select("id,event_id,name,scoring_mode,sort_order,created_at")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (res.error) throw res.error;
    setDisciplines((res.data as DisciplineRow[]) ?? []);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const ev = await loadActiveEvent();
      setActiveEvent(ev);

      if (!ev?.id) {
        setDisciplines([]);
        return;
      }

      await loadDisciplines(ev.id);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setDisciplines([]);
      setActiveEvent(null);
    } finally {
      setLoading(false);
    }
  };

  const createDiscipline = async () => {
    if (!activeEvent?.id) {
      toast("Kein aktives Event. Bitte zuerst unter Events ein Event aktiv setzen.");
      return;
    }

    const n = name.trim();
    if (n.length < 2) {
      toast("Disziplin-Name ist zu kurz.");
      return;
    }

    // sort_order optional
    const soRaw = sortOrder.trim();
    const so =
      soRaw.length === 0
        ? null
        : Number.isFinite(Number(soRaw))
        ? Number(soRaw)
        : NaN;

    if (soRaw.length > 0 && Number.isNaN(so)) {
      toast("sort_order muss eine Zahl sein (oder leer lassen).");
      return;
    }

    setSaving(true);

    const payload: any = {
      event_id: activeEvent.id,
      name: n,
      scoring_mode: scoringMode, // MUST be points_only | time_best | distance_best
    };

    // Only include sort_order if user provided it (and column exists)
    if (soRaw.length > 0) payload.sort_order = so;

    const res = await supabase
      .from("games_disciplines")
      .insert(payload)
      // If your table doesn't have sort_order, remove it from select()
      .select("id,event_id,name,scoring_mode,sort_order,created_at")
      .single();

    setSaving(false);

    if (res.error) {
      toast(`Create Fehler: ${res.error.message}`);
      return;
    }

    toast("Disziplin angelegt.");
    resetForm();
    await loadDisciplines(activeEvent.id);
  };

  const askDelete = (d: DisciplineRow) => {
    setDeleteId(d.id);
    setDeleteName(d.name);
    setConfirmOpen(true);
  };

  const deleteDiscipline = async () => {
    if (!deleteId) return;

    setSaving(true);

    const res = await supabase.from("games_disciplines").delete().eq("id", deleteId);

    setSaving(false);
    setConfirmOpen(false);

    if (res.error) {
      toast(`Delete Fehler: ${res.error.message}`);
      return;
    }

    toast("Disziplin gelöscht.");
    setDeleteId(null);
    setDeleteName("");

    if (activeEvent?.id) {
      await loadDisciplines(activeEvent.id);
    } else {
      await loadAll();
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

          <IonTitle>Games · Disziplinen</IonTitle>

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
                <IonIcon icon={listOutline} />
                Aktives Event
              </div>

              <div style={{ marginTop: 10 }}>
                {loading ? (
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

              <IonNote style={{ display: "block", marginTop: 10 }}>
                scoring_mode ist strikt: <b>points_only</b>, <b>time_best</b>, <b>distance_best</b>.
              </IonNote>
            </IonCardContent>
          </IonCard>

          {/* CREATE DISCIPLINE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950, fontSize: 16 }}>
                <IonIcon icon={addOutline} />
                Neue Disziplin anlegen
              </div>

              <IonNote style={{ display: "block", marginTop: 6 }}>
                Disziplinen werden dem aktiven Event zugeordnet (event_id).
              </IonNote>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Name</IonLabel>
                  <IonInput
                    value={name}
                    placeholder="z. B. Schlauchrollen"
                    onIonInput={(e) => setName(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Scoring Mode</IonLabel>
                  <IonSelect
                    value={scoringMode}
                    interface="popover"
                    onIonChange={(e) => setScoringMode(e.detail.value as ScoringMode)}
                    disabled={saving || !activeEvent}
                  >
                    <IonSelectOption value="points_only">points_only (nur Punkte)</IonSelectOption>
                    <IonSelectOption value="time_best">time_best (Bestzeit gewinnt)</IonSelectOption>
                    <IonSelectOption value="distance_best">distance_best (Bestweite gewinnt)</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Sort Order (optional)</IonLabel>
                  <IonInput
                    value={sortOrder}
                    inputmode="numeric"
                    placeholder="z. B. 10"
                    onIonInput={(e) => setSortOrder(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createDiscipline()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={saving || !activeEvent}>
                    Zurücksetzen
                  </IonButton>
                </div>

                {!activeEvent && (
                  <IonNote style={{ display: "block", marginTop: 10 }}>
                    Hinweis: Erst ein Event aktiv setzen, dann Disziplinen anlegen.
                  </IonNote>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Disziplinen</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                {activeEvent ? `${disciplines.length} Disziplinen im aktiven Event.` : "Kein aktives Event."}
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : !activeEvent ? (
                  <IonText color="medium">
                    <p>Bitte zuerst ein Event aktiv setzen.</p>
                  </IonText>
                ) : disciplines.length === 0 ? (
                  <IonText color="medium">
                    <p>Noch keine Disziplinen vorhanden. Lege oben eine an.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {disciplines.map((d) => (
                      <IonItem key={d.id} detail={false}>
                        <IonLabel style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {d.name}
                            </div>

                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.08)",
                              }}
                              title="scoring_mode"
                            >
                              {d.scoring_mode}
                            </span>

                            {d.sort_order != null ? (
                              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
                                sort: {d.sort_order}
                              </span>
                            ) : null}
                          </div>
                        </IonLabel>

                        <IonButton
                          size="small"
                          color="danger"
                          fill="outline"
                          disabled={saving}
                          onClick={() => askDelete(d)}
                        >
                          <IonIcon icon={trashOutline} slot="icon-only" />
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Wenn Create/Delete fehlschlägt: häufig RLS/Policy oder FK Constraints (Runs/Results hängen dran).
              </IonNote>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Falls du den Fehler <b>disc.sort_order does not exist</b> bekommst: irgendwo (View/SQL) wird auf eine
                Spalte referenziert, die in eurer Tabelle nicht existiert oder anders heißt.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={confirmOpen}
          onDidDismiss={() => setConfirmOpen(false)}
          header="Disziplin löschen?"
          message={`Willst du "${deleteName}" wirklich löschen?`}
          buttons={[
            { text: "Abbrechen", role: "cancel" },
            { text: "Löschen", role: "destructive", handler: () => void deleteDiscipline() },
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

export default GamesDisciplines;
