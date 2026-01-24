import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  IonToast,
} from "@ionic/react";
import { trophyOutline, chevronForwardOutline, refreshOutline } from "ionicons/icons";
import { useIonRouter } from "@ionic/react";
import { supabase } from "../lib/supabase";

type FeatureConfig = {
  show_tab?: boolean;
  [key: string]: any;
};

type FeatureRow = {
  key: string;
  enabled: boolean | null;
  title: string | null;
  config: FeatureConfig | string | null;
  updated_at?: string | null;
};

type FeatureState = {
  enabled: boolean;
  showTab: boolean;
  title: string;
};

type ActiveEventRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
};

const FEATURE_KEY = "games_leaderboard";
const DEFAULT_TITLE = "Spiele & Tabelle";

function normalizeConfig(config: FeatureRow["config"]): FeatureConfig {
  if (!config) return { show_tab: true };

  if (typeof config === "string") {
    try {
      const parsed = JSON.parse(config);
      if (parsed && typeof parsed === "object") return parsed as FeatureConfig;
    } catch {
      return { show_tab: true };
    }
  }

  if (typeof config === "object") {
    return config as FeatureConfig;
  }

  return { show_tab: true };
}

function formatBerlin(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

const GamesHome: React.FC = () => {
  const router = useIonRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [feature, setFeature] = useState<FeatureState>({
    enabled: false,
    showTab: true,
    title: DEFAULT_TITLE,
  });

  const [activeEvent, setActiveEvent] = useState<ActiveEventRow | null>(null);
  const [activeEventLoading, setActiveEventLoading] = useState(true);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Avoid out-of-order saves: only latest save response may update state
  const saveTokenRef = useRef(0);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const statusText = useMemo(() => {
    return `Aktuell: enabled=${String(feature.enabled)} | show_tab=${String(feature.showTab)}`;
  }, [feature.enabled, feature.showTab]);

  const ensureFeatureRow = async () => {
    const payload: FeatureRow = {
      key: FEATURE_KEY,
      enabled: false, // default off
      title: DEFAULT_TITLE,
      config: { show_tab: true },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("app_features").upsert(payload, { onConflict: "key" });
    if (error) throw error;
  };

  const loadFeature = async () => {
    setLoading(true);

    try {
      const first = await supabase
        .from("app_features")
        .select("key, enabled, title, config, updated_at")
        .eq("key", FEATURE_KEY)
        .maybeSingle();

      if (first.error) throw first.error;

      if (!first.data) {
        await ensureFeatureRow();

        const second = await supabase
          .from("app_features")
          .select("key, enabled, title, config, updated_at")
          .eq("key", FEATURE_KEY)
          .maybeSingle();

        if (second.error) throw second.error;
        if (!second.data) throw new Error("Konnte Feature-Row nicht anlegen (Row weiterhin null).");

        const row = second.data as FeatureRow;
        const cfg = normalizeConfig(row.config);

        setFeature({
          enabled: !!row.enabled,
          showTab: cfg.show_tab !== undefined ? !!cfg.show_tab : true,
          title: row.title ?? DEFAULT_TITLE,
        });

        return;
      }

      const row = first.data as FeatureRow;
      const cfg = normalizeConfig(row.config);

      setFeature({
        enabled: !!row.enabled,
        showTab: cfg.show_tab !== undefined ? !!cfg.show_tab : true,
        title: row.title ?? DEFAULT_TITLE,
      });
    } catch (e: any) {
      toast(`Load/Init Fehler: ${e?.message ?? "Unbekannt"}`);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveEvent = async () => {
    setActiveEventLoading(true);

    try {
      const res = await supabase
        .from("games_active_event")
        .select("id,name,subtitle,starts_at")
        .maybeSingle();

      if (res.error) throw res.error;
      setActiveEvent((res.data as ActiveEventRow) ?? null);
    } catch (e: any) {
      // Do not block page; just show toast and leave card empty
      toast(`Active Event Fehler: ${e?.message ?? "Unbekannt"}`);
      setActiveEvent(null);
    } finally {
      setActiveEventLoading(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadFeature(), loadActiveEvent()]);
  };

  const saveFeature = async (next: FeatureState, prev: FeatureState) => {
    setSaving(true);

    const token = ++saveTokenRef.current;

    const payload: FeatureRow = {
      key: FEATURE_KEY,
      enabled: next.enabled,
      title: next.title ?? DEFAULT_TITLE,
      config: { show_tab: next.showTab },
      updated_at: new Date().toISOString(), // remove if DB trigger manages this
    };

    const res = await supabase
      .from("app_features")
      .upsert(payload, { onConflict: "key" })
      .select("key, enabled, title, config, updated_at")
      .maybeSingle();

    // Ignore stale responses if newer save started
    if (token !== saveTokenRef.current) return;

    setSaving(false);

    if (res.error) {
      setFeature(prev); // revert

      const lower = (res.error.message ?? "").toLowerCase();
      const msg =
        lower.includes("row-level security") || lower.includes("policy")
          ? "Save geblockt: RLS/Policy verhindert UPDATE/UPSERT."
          : `Save Fehler: ${res.error.message}`;

      toast(msg);
      return;
    }

    if (res.data) {
      const row = res.data as FeatureRow;
      const cfg = normalizeConfig(row.config);

      setFeature({
        enabled: !!row.enabled,
        showTab: cfg.show_tab !== undefined ? !!cfg.show_tab : next.showTab,
        title: row.title ?? DEFAULT_TITLE,
      });
    }

    toast("Gespeichert.");
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEnabled = async (checked: boolean) => {
    const prev = feature;
    const next: FeatureState = { ...feature, enabled: checked };

    setFeature(next); // optimistic UI
    await saveFeature(next, prev);
  };

  const setShowTab = async (checked: boolean) => {
    const prev = feature;
    const next: FeatureState = { ...feature, showTab: checked };

    setFeature(next); // optimistic UI
    await saveFeature(next, prev);
  };

  const go = (path: string) => router.push(path, "forward");

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <IonIcon icon={trophyOutline} />
              Spiele
            </span>
          </IonTitle>

          <IonButtons slot="end">
            <IonButton
              onClick={() => void loadAll()}
              disabled={loading || saving || activeEventLoading}
              aria-label="Refresh"
            >
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          {/* FEATURE TOGGLE */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Feature Toggle</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Steuert den Spiele-Tab in der Handy-App (app_features / {FEATURE_KEY})
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <IonSpinner />
                ) : (
                  <IonList lines="inset">
                    <IonItem>
                      <IonLabel>
                        <div style={{ fontWeight: 900 }}>enabled</div>
                        <IonNote>Schaltet Feature grundsätzlich an/aus</IonNote>
                      </IonLabel>
                      <IonToggle
                        checked={feature.enabled}
                        disabled={saving}
                        onIonChange={(e) => void setEnabled(!!e.detail.checked)}
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel>
                        <div style={{ fontWeight: 900 }}>config.show_tab</div>
                        <IonNote>Ob der Tab in der App angezeigt wird</IonNote>
                      </IonLabel>
                      <IonToggle
                        checked={feature.showTab}
                        disabled={saving || !feature.enabled}
                        onIonChange={(e) => void setShowTab(!!e.detail.checked)}
                      />
                    </IonItem>
                  </IonList>
                )}
              </div>

              <div style={{ marginTop: 10, fontSize: 12.5, opacity: 0.7, fontWeight: 800 }}>
                {statusText}
              </div>

              {!feature.enabled && (
                <IonNote style={{ display: "block", marginTop: 8 }}>
                  Hinweis: Solange enabled=false ist, ist show_tab irrelevant (Tab wird nicht angezeigt).
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>

          {/* ACTIVE EVENT OVERVIEW */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Aktives Event</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Quelle: View <b>games_active_event</b> (0–1 Zeile)
              </IonNote>

              <div style={{ marginTop: 12 }}>
                {activeEventLoading ? (
                  <IonSpinner />
                ) : activeEvent ? (
                  <>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{activeEvent.name}</div>
                    {activeEvent.subtitle ? (
                      <div style={{ marginTop: 6, opacity: 0.85, fontWeight: 750 }}>
                        {activeEvent.subtitle}
                      </div>
                    ) : null}
                    {activeEvent.starts_at ? (
                      <div style={{ marginTop: 10, opacity: 0.8, fontWeight: 850 }}>
                        Start: {formatBerlin(activeEvent.starts_at)}
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, opacity: 0.8, fontWeight: 850 }}>
                        Start: —
                      </div>
                    )}
                  </>
                ) : (
                  <IonNote style={{ display: "block" }}>
                    Kein aktives Event gefunden. Lege ein Event an und setze es aktiv.
                  </IonNote>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <IonButton size="small" fill="outline" onClick={() => go("/games/events")}>
                  Events verwalten
                  <IonIcon icon={chevronForwardOutline} slot="end" />
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {/* ADMIN NAV */}
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Games Admin</div>
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Pflege die Daten, die Supabase-Views für die Handy-App füttern.
              </IonNote>

              <IonList lines="inset" style={{ marginTop: 12 }}>
                <IonItem button detail onClick={() => go("/games/events")}>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Events</div>
                    <IonNote>Event anlegen & aktiv setzen</IonNote>
                  </IonLabel>
                </IonItem>

                <IonItem button detail onClick={() => go("/games/teams")}>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Teams</div>
                    <IonNote>Teams pro Event pflegen</IonNote>
                  </IonLabel>
                </IonItem>

                <IonItem button detail onClick={() => go("/games/disciplines")}>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Disziplinen</div>
                    <IonNote>scoring_mode: points_only / time_best / distance_best</IonNote>
                  </IonLabel>
                </IonItem>

                <IonItem button detail onClick={() => go("/games/runs")}>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Läufe</div>
                    <IonNote>Läufe pro Disziplin anlegen</IonNote>
                  </IonLabel>
                </IonItem>

                <IonItem button detail onClick={() => go("/games/results")}>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>Ergebnisse</div>
                    <IonNote>Run Results erfassen (Punkte / Zeit / Distanz)</IonNote>
                  </IonLabel>
                </IonItem>
              </IonList>

              <div style={{ marginTop: 10, fontSize: 12.5, opacity: 0.7, fontWeight: 800 }}>
                Tipp: Erst Event aktiv setzen → Teams/Disziplinen → Läufe → Ergebnisse.
              </div>
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

export default GamesHome;
