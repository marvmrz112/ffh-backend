import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
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
import { addOutline, refreshOutline, starOutline } from "ionicons/icons";
import { supabase } from "../lib/supabase";

type GamesEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean | null;
  public_visible: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreateForm = {
  name: string;
  subtitle: string;
  location: string;
  startsAt: string; // datetime-local
  endsAt: string; // datetime-local
  publicVisible: boolean;
};

const TZ = "Europe/Berlin";

function formatBerlin(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: TZ,
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

const GamesEvents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<GamesEventRow[]>([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const [form, setForm] = useState<CreateForm>({
    name: "",
    subtitle: "",
    location: "",
    startsAt: "",
    endsAt: "",
    publicVisible: true,
  });

  const canCreate = useMemo(() => form.name.trim().length > 0, [form.name]);

  const load = async () => {
    setLoading(true);

    const res = await supabase
      .from("games_events")
      .select(
        "id,name,subtitle,location,starts_at,ends_at,active,public_visible,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    setLoading(false);

    if (res.error) {
      toast(`Load Fehler: ${res.error.message}`);
      setRows([]);
      return;
    }

    setRows((res.data as GamesEventRow[]) ?? []);
  };

  const resetForm = () => {
    setForm({
      name: "",
      subtitle: "",
      location: "",
      startsAt: "",
      endsAt: "",
      publicVisible: true,
    });
  };

  const createEvent = async () => {
    if (!canCreate) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        subtitle: form.subtitle.trim() ? form.subtitle.trim() : null,
        location: form.location.trim() ? form.location.trim() : null,
        starts_at: toIsoOrNull(form.startsAt),
        ends_at: toIsoOrNull(form.endsAt),
        public_visible: !!form.publicVisible,
        active: false,
        updated_at: new Date().toISOString(),
      };

      const ins = await supabase
        .from("games_events")
        .insert(payload)
        .select(
          "id,name,subtitle,location,starts_at,ends_at,active,public_visible,created_at,updated_at"
        )
        .single();

      if (ins.error) throw ins.error;

      toast("Event angelegt.");
      resetForm();
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      const lower = String(msg).toLowerCase();
      if (lower.includes("row-level security") || lower.includes("policy")) {
        toast("Create geblockt: RLS/Policy verhindert INSERT auf games_events.");
      } else {
        toast(`Create Fehler: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (eventId: string) => {
    setSaving(true);
    try {
      // 1) alle deaktivieren
      const off = await supabase
        .from("games_events")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("active", true);

      if (off.error) throw off.error;

      // 2) gewünschtes aktivieren
      const on = await supabase
        .from("games_events")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", eventId);

      if (on.error) throw on.error;

      toast("Event aktiv gesetzt.");
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannt";
      const lower = String(msg).toLowerCase();
      if (lower.includes("row-level security") || lower.includes("policy")) {
        toast("Aktiv setzen geblockt: RLS/Policy verhindert UPDATE auf games_events.");
      } else if (lower.includes("schema cache") || lower.includes("could not find")) {
        toast("Schema-Cache: `notify pgrst, 'reload schema';` ausführen und hart neu laden.");
      } else {
        toast(`Aktiv setzen Fehler: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Games · Events</IonTitle>

          <IonButton
            slot="end"
            fill="clear"
            onClick={() => void load()}
            disabled={loading || saving}
            aria-label="Reload"
          >
            <IonIcon icon={refreshOutline} slot="icon-only" />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* CREATE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Neues Event</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Tipp: Danach „Aktiv setzen“, damit <b>games_active_event</b> eine Zeile liefert.
              </IonNote>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <IonItem>
                  <IonLabel position="stacked">Name</IonLabel>
                  <IonInput
                    value={form.name}
                    placeholder="z.B. FFH Spiele 2026"
                    onIonInput={(e) =>
                      setForm((p) => ({ ...p, name: String(e.detail.value ?? "") }))
                    }
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Untertitel (optional)</IonLabel>
                  <IonInput
                    value={form.subtitle}
                    placeholder="z.B. Live-Tabelle & Platzierungen"
                    onIonInput={(e) =>
                      setForm((p) => ({ ...p, subtitle: String(e.detail.value ?? "") }))
                    }
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Ort (optional)</IonLabel>
                  <IonInput
                    value={form.location}
                    placeholder="z.B. Hornau"
                    onIonInput={(e) =>
                      setForm((p) => ({ ...p, location: String(e.detail.value ?? "") }))
                    }
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Start (optional) (ISO)</IonLabel>
                  <IonInput
                    type="datetime-local"
                    value={form.startsAt}
                    onIonInput={(e) =>
                      setForm((p) => ({ ...p, startsAt: String(e.detail.value ?? "") }))
                    }
                    disabled={saving}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Ende (optional) (ISO)</IonLabel>
                  <IonInput
                    type="datetime-local"
                    value={form.endsAt}
                    onIonInput={(e) =>
                      setForm((p) => ({ ...p, endsAt: String(e.detail.value ?? "") }))
                    }
                    disabled={saving}
                  />
                </IonItem>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <IonButton onClick={() => void createEvent()} disabled={!canCreate || saving}>
                    <IonIcon icon={addOutline} slot="start" />
                    Anlegen
                  </IonButton>

                  <IonButton fill="outline" onClick={resetForm} disabled={saving}>
                    Zurücksetzen
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* LIST */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Events</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Setze genau ein Event aktiv (<b>active=true</b>).
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
                    {rows.map((r) => (
                      <IonItem key={r.id} detail={false}>
                        <IonLabel>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950 }}>{r.name}</div>

                            {r.active ? (
                              <IonNote style={{ fontWeight: 900 }}>AKTIV</IonNote>
                            ) : (
                              <IonNote style={{ opacity: 0.7 }}>inaktiv</IonNote>
                            )}

                            {r.public_visible ? (
                              <IonNote style={{ fontWeight: 900 }}>public</IonNote>
                            ) : (
                              <IonNote style={{ opacity: 0.7 }}>hidden</IonNote>
                            )}
                          </div>

                          {r.subtitle ? (
                            <div style={{ marginTop: 4, opacity: 0.85 }}>{r.subtitle}</div>
                          ) : null}

                          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12.5 }}>
                            Start: {r.starts_at ? formatBerlin(r.starts_at) : "—"} · Ende:{" "}
                            {r.ends_at ? formatBerlin(r.ends_at) : "—"} · Ort: {r.location ?? "—"}
                          </div>
                        </IonLabel>

                        <IonButton
                          size="small"
                          onClick={() => void setActive(r.id)}
                          disabled={saving}
                          style={{ marginLeft: 10 }}
                        >
                          <IonIcon icon={starOutline} slot="start" />
                          Aktiv setzen
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                )}

                <IonNote style={{ display: "block", marginTop: 10 }}>
                  Wenn „Aktiv setzen“ fehlschlägt: sehr wahrscheinlich RLS/Policy auf <b>games_events</b>.
                </IonNote>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonToast
          isOpen={toastOpen}
          message={toastMsg}
          duration={3500}
          onDidDismiss={() => setToastOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default GamesEvents;
