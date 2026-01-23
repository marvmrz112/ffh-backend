import React, { useEffect, useState } from "react";
import {
  IonButton,
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
} from "@ionic/react";
import {
  trophyOutline,
  settingsOutline,
  listOutline,
  peopleOutline,
  flagOutline,
  playOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { supabase } from "../lib/supabase";

type FeatureRow = {
  key: string;
  enabled: boolean | null;
  title: string | null;
  config: any | null;
};

const FEATURE_KEY = "games_leaderboard";

const GamesHome: React.FC = () => {
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [showTab, setShowTab] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_features")
      .select("key, enabled, title, config")
      .eq("key", FEATURE_KEY)
      .limit(1);

    if (error || !data || data.length === 0) {
      // Fallback: wenn der Eintrag fehlt, zeigen wir im Backend trotzdem alles an
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

  const save = async (nextEnabled: boolean, nextShowTab: boolean) => {
    setSaving(true);

    const payload = {
      key: FEATURE_KEY,
      enabled: nextEnabled,
      title: "Spiele & Tabelle",
      config: { show_tab: nextShowTab },
      updated_at: new Date().toISOString(),
    };

    // upsert: existiert -> update, sonst insert
    const { error } = await supabase
      .from("app_features")
      .upsert(payload, { onConflict: "key" });

    setSaving(false);

    if (!error) {
      setEnabled(nextEnabled);
      setShowTab(nextShowTab);
    } else {
      // wenn was schiefgeht -> wieder reload
      await load();
    }
  };

  useEffect(() => {
    void load();
  }, []);

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
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Spiele in der Handy-App anzeigen</div>
                  <IonNote style={{ display: "block", marginTop: 6 }}>
                    Steuert den Tab „Spiele“ in der Event-App über <b>app_features</b> ({FEATURE_KEY})
                  </IonNote>
                </div>

                {loading ? (
                  <IonSpinner />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>enabled</div>
                      <IonToggle
                        checked={enabled}
                        disabled={saving}
                        onIonChange={(e) => save(!!e.detail.checked, showTab)}
                      />
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>show_tab</div>
                      <IonToggle
                        checked={showTab}
                        disabled={saving}
                        onIonChange={(e) => save(enabled, !!e.detail.checked)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <IonButton
                  onClick={() => history.push("/games/events")}
                  fill="solid"
                >
                  <IonIcon slot="start" icon={flagOutline} />
                  Events
                </IonButton>

                <IonButton onClick={() => history.push("/games/disciplines")} fill="outline">
                  <IonIcon slot="start" icon={listOutline} />
                  Disziplinen
                </IonButton>

                <IonButton onClick={() => history.push("/games/teams")} fill="outline">
                  <IonIcon slot="start" icon={peopleOutline} />
                  Teams
                </IonButton>

                <IonButton onClick={() => history.push("/games/runs")} fill="outline">
                  <IonIcon slot="start" icon={playOutline} />
                  Läufe
                </IonButton>

                <IonButton onClick={() => history.push("/games/settings")} fill="clear">
                  <IonIcon slot="start" icon={settingsOutline} />
                  Einstellungen
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Status</div>
              <IonList lines="inset">
                <IonItem>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>enabled</div>
                    <IonNote>{String(enabled)}</IonNote>
                  </IonLabel>
                </IonItem>

                <IonItem>
                  <IonLabel>
                    <div style={{ fontWeight: 900 }}>config.show_tab</div>
                    <IonNote>{String(showTab)}</IonNote>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default GamesHome;
