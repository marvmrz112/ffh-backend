import React, { useEffect, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type MenuRow = {
  id: number;
  created_at: string;
  category: string;
  name: string;
  price: number;
  unit: string | null;
  sort_order: number | null;
};

const TABLE = 'menu_items';

function formatPrice(price: number, unit?: string | null) {
  const p = Number(price).toFixed(2).replace('.', ',');
  return unit ? `${p} € · ${unit}` : `${p} €`;
}

const FoodDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<MenuRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      setErr('Ungültige ID.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,created_at,category,name,price,unit,sort_order')
      .eq('id', numericId)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setItem(null);
      setLoading(false);
      return;
    }

    setItem((data as MenuRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const remove = async () => {
    if (!item) return;

    const ok = window.confirm('Eintrag wirklich löschen?');
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const { error } = await supabase.from(TABLE).delete().eq('id', item.id);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    history.replace('/food');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/food" />
          </IonButtons>
          <IonTitle>Essen & Trinken</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{err}</p>
                </IonText>
              )}

              {!loading && !err && !item && (
                <IonText>
                  <p>Nicht gefunden.</p>
                </IonText>
              )}

              {!loading && item && (
                <>
                  <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
                    {item.name}
                  </div>

                  <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 12 }}>
                    {item.category} · {formatPrice(item.price, item.unit)}
                    {item.sort_order != null ? ` · Sort: ${item.sort_order}` : ''}
                  </div>

                  <IonButton expand="block" color="danger" onClick={remove} disabled={busy}>
                    {busy ? (
                      <IonSpinner />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={trashOutline} />
                        Löschen
                      </>
                    )}
                  </IonButton>
                </>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default FoodDetail;
