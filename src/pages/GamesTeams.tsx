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
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonToast,
  IonAlert,
} from "@ionic/react";
import { addOutline, refreshOutline, trashOutline, peopleOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

type ActiveEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
};

type TeamRow = {
  id: string;
  event_id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
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

const GamesTeams: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

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
    setColor("");
    setLogoUrl("");
  };

  const loadActiveEvent = async (): Promise<ActiveEventRow | null> => {
    const res = await supabase
      .from("games_active_event")
      .select("id,name,subtitle,starts_at")
      .maybeSingle();

    if (res.error) throw res.error;
    return (res.data as ActiveEventRow) ?? null;
  };

  const loadTeams = async (eventId: string) => {
    const res = await supabase
      .from("games_teams")
      .select("id,event_id,name,color,logo_url,created_at")
      .eq("event_id", eventId)
      .order("name", { ascending: true });

    if (res.error) throw res.error;
    setTeams((res.data as TeamRow[]) ?? []);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const ev = await loadActiveEvent();
      setActiveEvent(ev);

      if (!ev?.id) {
        setTeams([]);
        return;
      }

      await loadTeams(ev.id);
    } catch (e: any) {
      toast(`Load Fehler: ${e?.message ?? "Unbekannt"}`);
      setTeams([]);
      setActiveEvent(null);
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async () => {
    if (!activeEvent?.id) {
      toast("Kein aktives Event. Bitte zuerst unter Events ein Event aktiv setzen.");
      return;
    }

    const n = name.trim();
    if (n.length < 2) {
      toast("Teamname ist zu kurz.");
      return;
    }

    setSaving(true);

    const payload = {
      event_id: activeEvent.id,
      name: n,
      color: color.trim().length ? color.trim() : null,
      logo_url: logoUrl.trim().length ? logoUrl.trim() : null,
    };

    const res = await supabase
      .from("games_teams")
      .insert(payload)
      .select("id,event_id,name,color,logo_url,created_at")
      .single();

    setSaving(false);

    if (res.error) {
      toast(`Create Fehler: ${res.error.message}`);
      return;
    }

    toast("Team angelegt.");
    resetForm();
    await loadTeams(activeEvent.id);
  };

  const askDelete = (t: TeamRow) => {
    setDeleteId(t.id);
    setDeleteName(t.name);
    setConfirmOpen(true);
  };

  const deleteTeam = async () => {
    if (!deleteId) return;

    setSaving(true);

    const res = await supabase.from("games_teams").delete().eq("id", deleteId);

    setSaving(false);
    setConfirmOpen(false);

    if (res.error) {
      toast(`Delete Fehler: ${res.error.message}`);
      return;
    }

    toast("Team gelöscht.");
    setDeleteId(null);
    setDeleteName("");

    if (activeEvent?.id) {
      await loadTeams(activeEvent.id);
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

          <IonTitle>Games · Teams</IonTitle>

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
                <IonIcon icon={peopleOutline} />
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
            </IonCardContent>
          </IonCard>

          {/* CREATE TEAM */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 950, fontSize: 16 }}>
                <IonIcon icon={addOutline} />
                Neues Team anlegen
              </div>

              <IonNote style={{ display: "block", marginTop: 6 }}>
                Teams werden dem aktiven Event zugeordnet (event_id).
              </IonNote>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Teamname</IonLabel>
                  <IonInput
                    value={name}
                    placeholder="z. B. Staffel 1"
                    onIonInput={(e) => setName(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Farbe (optional)</IonLabel>
                  <IonInput
                    value={color}
                    placeholder='z. B. "#FF2D2D" oder "red"'
                    onIonInput={(e) => setColor(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Logo URL (optional)</IonLabel>
                  <IonInput
                    value={logoUrl}
                    placeholder="https://..."
                    onIonInput={(e) => setLogoUrl(String(e.detail.value ?? ""))}
                    disabled={saving || !activeEvent}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createTeam()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={saving || !activeEvent}>
                    Zurücksetzen
                  </IonButton>
                </div>

                {!activeEvent && (
                  <IonNote style={{ display: "block", marginTop: 10 }}>
                    Hinweis: Erst ein Event aktiv setzen, dann Teams anlegen.
                  </IonNote>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* TEAMS LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Teams</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                {activeEvent ? `${teams.length} Teams im aktiven Event.` : "Kein aktives Event."}
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
                    <p>Noch keine Teams vorhanden. Lege oben eins an.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {teams.map((t) => (
                      <IonItem key={t.id} detail={false}>
                        <IonLabel style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {t.name}
                            </div>
                            {t.color ? (
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 999,
                                  background: t.color,
                                  display: "inline-block",
                                  border: "1px solid rgba(255,255,255,0.25)",
                                }}
                                title={t.color}
                              />
                            ) : null}
                          </div>

                          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {t.logo_url ? (
                              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
                                logo: {t.logo_url}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>logo: —</span>
                            )}
                          </div>
                        </IonLabel>

                        <IonButton
                          size="small"
                          color="danger"
                          fill="outline"
                          disabled={saving}
                          onClick={() => askDelete(t)}
                        >
                          <IonIcon icon={trashOutline} slot="icon-only" />
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
              
              </IonNote>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={confirmOpen}
          onDidDismiss={() => setConfirmOpen(false)}
          header="Team löschen?"
          message={`Willst du "${deleteName}" wirklich löschen?`}
          buttons={[
            { text: "Abbrechen", role: "cancel" },
            { text: "Löschen", role: "destructive", handler: () => void deleteTeam() },
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

export default GamesTeams;
