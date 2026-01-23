import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { trophyOutline } from "ionicons/icons";
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

const FEATURE_KEY = "games_leaderboard";
const DEFAULT_TITLE = "Spiele & Tabelle";

function normalizeConfig(config: FeatureRow["config"]): FeatureConfig {
  if (!config) return { show_tab: true };

  // Sometimes config comes as a JSON string depending on how it was written
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

type FeatureState = {
  enabled: boolean;
  showTab: boolean;
  title: string;
};

const GamesHome: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [feature, setFeature] = useState<FeatureState>({
    enabled: true,
    showTab: true,
    title: DEFAULT_TITLE,
  });

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Used to avoid out-of-order saves (only the latest save should "win")
  const saveTokenRef = useRef(0);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const statusText = useMemo(() => {
    return `Aktuell: enabled=${String(feature.enabled)} | show_tab=${String(feature.showTab)}`;
  }, [feature.enabled, feature.showTab]);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_features")
      .select("key, enabled, title, config, updated_at")
      .eq("key", FEATURE_KEY)
      .maybeSingle();

    if (error) {
      toast(`Load Fehler: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      // Row doesn't exist yet -> sensible defaults
      setFeature({
        enabled: true,
        showTab: true,
        title: DEFAULT_TITLE,
      });
      setLoading(false);
      return;
    }

    const cfg = normalizeConfig((data as FeatureRow).config);
    setFeature({
      enabled: !!data.enabled,
      showTab: cfg.show_tab !== undefined ? !!cfg.show_tab : true,
      title: data.title ?? DEFAULT_TITLE,
    });

    setLoading(false);
  };

  const save = async (next: FeatureState, prev: FeatureState) => {
    setSaving(true);

    const token = ++saveTokenRef.current;

    const payload: FeatureRow = {
      key: FEATURE_KEY,
      enabled: next.enabled,
      title: next.title ?? DEFAULT_TITLE,
      config: { show_tab: next.showTab },
      // If you have a DB trigger for updated_at, remove this:
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("app_features")
      .upsert(payload, { onConflict: "key" })
      .select("key, enabled, title, config, updated_at")
      .maybeSingle();

    // If another save started after this one, ignore this response
    if (token !== saveTokenRef.current) return;

    setSaving(false);

    if (error) {
      setFeature(prev); // revert
      toast(`Save geblockt (RLS?): ${error.message}`);
      return;
    }

    // Trust DB response if present (prevents drift)
    if (data) {
      const cfg = normalizeConfig((data as FeatureRow).config);
      setFeature({
        enabled: !!data.enabled,
        showTab: cfg.show_tab !== undefined ? !!cfg.show_tab : next.showTab,
        title: data.title ?? DEFAULT_TITLE,
      });
    }

    toast("Gespeichert.");
  };

  useEffect(() => {
    void load();
  }, []);

  const setEnabled = async (checked: boolean) => {
    const prev = feature;

    // If disabling feature, we can keep showTab as-is, but UI should disable its toggle
    const next: FeatureState = { ...feature, enabled: checked };

    setFeature(next); // optimistic UI
    await save(next, prev);
  };

  const setShowTab = async (checked: boolean) => {
    const prev = feature;
    const next: FeatureState = { ...feature, showTab: checked };

    setFeature(next); // optimistic UI
    await save(next, prev);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <IonIcon icon={trophyOutline} />
              Spiele (Backend)
            </span>
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
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
                        // semantisch sinnvoll: show_tab nur änderbar, wenn Feature enabled
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
        </div>

        <IonToast
          isOpen={toastOpen}
          message={toastMsg}
          duration={2500}
          onDidDismiss={() => setToastOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default GamesHome;
