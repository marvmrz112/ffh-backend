import React, { useEffect, useState } from "react";
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

type FeatureRow = {
  key: string;
  enabled: boolean | null;
  title: string | null;
  config: any | null;
};

const FEATURE_KEY = "games_leaderboard";

const GamesHome: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [showTab, setShowTab] = useState(true);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_features")
      .select("key, enabled, title, config")
      .eq("key", FEATURE_KEY)
      .limit(1);

    if (error) {
      toast(`Load Fehler: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setEnabled(true);
      setShowTab(true);
      setLoading(false);
      return;
    }

    const row = data[0] as FeatureRow;
    setEnabled(!!row.enabled);
    setShowTab(!!row?.config?.show_tab);

    setLoading(false);
  };

  const save = async (nextEnabled: boolean, nextShowTab: boolean, prev: { enabled: boolean; showTab: boolean }) => {
    setSaving(true);

    const payload = {
      key: FEATURE_KEY,
      enabled: nextEnabled,
      title: "Spiele & Tabelle",
      config: { show_tab: nextShowTab },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("app_features")
      .upsert(payload, { onConflict: "key" });

    setSaving(false);

    if (error) {
      // revert
      setEnabled(prev.enabled);
      setShowTab(prev.showTab);
      toast(`Save geblockt (RLS?): ${error.message}`);
      return;
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onToggleEnabled = async (checked: boolean) => {
    const prev = { enabled, showTab };
    setEnabled(checked); // optimistic UI
    await save(checked, showTab, prev);
  };

  const onToggleShowTab = async (checked: boolean) => {
    const prev = { enabled, showTab };
    setShowTab(checked); // optimistic UI
    await save(enabled, checked, prev);
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
                        checked={enabled}
                        disabled={saving}
                        onIonChange={(e) => onToggleEnabled(!!e.detail.checked)}
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel>
                        <div style={{ fontWeight: 900 }}>config.show_tab</div>
                        <IonNote>Ob der Tab in der App angezeigt wird</IonNote>
                      </IonLabel>
                      <IonToggle
                        checked={showTab}
                        disabled={saving}
                        onIonChange={(e) => onToggleShowTab(!!e.detail.checked)}
                      />
                    </IonItem>
                  </IonList>
                )}
              </div>

              <div style={{ marginTop: 10, fontSize: 12.5, opacity: 0.7, fontWeight: 800 }}>
                Aktuell: enabled={String(enabled)} | show_tab={String(showTab)}
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

export default GamesHome;
