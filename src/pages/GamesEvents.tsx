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
} from "@ionic/react";
import {
  addOutline,
  checkmarkCircleOutline,
  refreshOutline,
  timeOutline,
} from "ionicons/icons";
import { supabase } from "../lib/supabase";

type GamesEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
  is_active: boolean | null;
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

const GamesEvents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const [rows, setRows] = useState<GamesEventRow[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [startsAt, setStartsAt] = useState<string>("");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const canCreate = useMemo(() => {
    return name.trim().length >= 3 && !saving && !loading;
  }, [name, saving, loading]);

  const resetForm = () => {
    setName("");
    setSubtitle("");
    setStartsAt("");
  };

  const load = async () => {
    setLoading(true);

    const res = await supabase
      .from("games_events")
      .select("id,name,subtitle,starts_at,is_active,created_at")
      .order("starts_at", { ascending: true, nullsFirst: false });

    if (res.error) {
      toast(`Load Fehler: ${res.error.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((res.data as GamesEventRow[]) ?? []);
    setLoading(false);
  };

  const createEvent = async () => {
    const n = name.trim();
    const s = subtitle.trim();
    if (n.length < 3) {
      toast("Name ist zu kurz (mind. 3 Zeichen).");
      return;
    }

    setSaving(true);

    // starts_at: if user entered empty -> null
    const payload = {
      name: n,
      subtitle: s.length ? s : null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      is_active: false,
    };

    const res = await supabase
      .from("games_events")
      .insert(payload)
      .select("id,name,subtitle,starts_at,is_active,created_at")
      .single();

    setSaving(false);

    if (res.error) {
      toast(`Create Fehler: ${res.error.message}`);
      return;
    }

    toast("Event angelegt.");
    resetForm();
    await load();
  };

  const setActive = async (eventId: string) => {
    setActivatingId(eventId);

    // 1) deactivate all others
    const off = await supabase
      .from("games_events")
      .update({ is_active: false })
      .neq("id", eventId);

    if (off.error) {
      setActivatingId(null);
      toast(`Aktivieren fehlgeschlagen (Step 1): ${off.error.message}`);
      return;
    }

    // 2) activate selected
    const on = await supabase
      .from("games_events")
      .update({ is_active: true })
      .eq("id", eventId);

    setActivatingId(null);

    if (on.error) {
      toast(`Aktivieren fehlgeschlagen (Step 2): ${on.error.message}`);
      return;
    }

    toast("Aktives Event gesetzt.");
    await load();
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/games" />
          </IonButtons>

          <IonTitle>Games · Events</IonTitle>

          <IonButtons slot="end">
            <IonButton onClick={() => void load()} disabled={loading || saving}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          {/* CREATE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <IonIcon icon={addOutline} />
                Neues Event anlegen
              </div>

              <div style={{ marginTop: 12 }}>
                <IonItem>
                  <IonLabel position="stacked">Name</IonLabel>
                  <IonInput
                    value={name}
                    placeholder="z. B. Feuerwehrspiele 2026"
                    onIonInput={(e) => setName(String(e.detail.value ?? ""))}
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Untertitel (optional)</IonLabel>
                  <IonInput
                    value={subtitle}
                    placeholder="z. B. Live-Tabelle & Platzierungen"
                    onIonInput={(e) => setSubtitle(String(e.detail.value ?? ""))}
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">
                    Start (optional){" "}
                    <IonNote style={{ display: "inline" }}>
                      (wird als ISO gespeichert)
                    </IonNote>
                  </IonLabel>
                  <IonInput
                    value={startsAt}
                    type="datetime-local"
                    onIonInput={(e) => setStartsAt(String(e.detail.value ?? ""))}
                    disabled={saving}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <IonButton onClick={() => void createEvent()} disabled={!canCreate}>
                    Anlegen
                  </IonButton>
                  <IonButton fill="outline" onClick={resetForm} disabled={saving}>
                    Zurücksetzen
                  </IonButton>
                </div>

                <IonNote style={{ display: "block", marginTop: 10 }}>
                  Tipp: Danach „Aktiv setzen“, damit <b>games_active_event</b> eine Zeile liefert.
                </IonNote>
              </div>
            </IonCardContent>
          </IonCard>

          {/* LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Events</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Setze genau ein Event aktiv (is_active=true).
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : rows.length === 0 ? (
                  <IonText color="medium">
                    <p>Keine Events vorhanden. Lege oben eins an.</p>
                  </IonText>
                ) : (
                  <IonList lines="inset">
                    {rows.map((e) => {
                      const isActive = !!e.is_active;
                      const busy = activatingId === e.id;

                      return (
                        <IonItem key={e.id} detail={false}>
                          <IonLabel style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {e.name}
                              </div>

                              {isActive ? (
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 900,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    background: "rgba(46, 204, 113, 0.15)",
                                  }}
                                >
                                  AKTIV
                                </span>
                              ) : null}
                            </div>

                            {e.subtitle ? (
                              <div style={{ marginTop: 4, opacity: 0.8, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {e.subtitle}
                              </div>
                            ) : null}

                            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, opacity: 0.85 }}>
                              <IonIcon icon={timeOutline} />
                              <IonNote>
                                {e.starts_at ? formatBerlin(e.starts_at) : "kein Startdatum"}
                              </IonNote>
                            </div>
                          </IonLabel>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <IonButton
                              size="small"
                              fill={isActive ? "solid" : "outline"}
                              color={isActive ? "success" : undefined}
                              disabled={saving || loading || isActive || busy}
                              onClick={() => void setActive(e.id)}
                            >
                              {busy ? (
                                <>
                                  <IonSpinner name="dots" />
                                </>
                              ) : (
                                <>
                                  <IonIcon icon={checkmarkCircleOutline} slot="start" />
                                  Aktiv setzen
                                </>
                              )}
                            </IonButton>
                          </div>
                        </IonItem>
                      );
                    })}
                  </IonList>
                )}
              </div>

              <IonNote style={{ display: "block", marginTop: 10 }}>
                Falls „Aktiv setzen“ fehlschlägt: sehr wahrscheinlich RLS/Policy auf <b>games_events</b>.
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

export default GamesEvents;
