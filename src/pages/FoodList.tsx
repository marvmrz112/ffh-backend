import React, { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
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
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { addOutline, refreshOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
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

const FoodList: React.FC = () => {
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MenuRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id,created_at,category,name,price,unit,sort_order')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      setErr(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as MenuRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('menu-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuRow[]>();
    for (const it of items) {
      const key = (it.category ?? '').trim() || 'Sonstiges';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>
          <IonTitle>Essen & Trinken</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <IonCard style={{ margin: 0, borderRadius: 18 }}>
            <IonCardContent style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Menü</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <IonButton fill="outline" size="small" onClick={load} disabled={loading}>
                    <IonIcon slot="icon-only" icon={refreshOutline} />
                  </IonButton>

                  <IonButton size="small" onClick={() => history.push('/food/create')}>
                    <IonIcon slot="start" icon={addOutline} />
                    Neu
                  </IonButton>
                </div>
              </div>

              {loading && <IonSpinner />}

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{err}</p>
                </IonText>
              )}

              {!loading && !err && items.length === 0 && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: '1px dashed rgba(255,255,255,0.15)',
                    opacity: 0.85,
                    textAlign: 'center',
                  }}
                >
                  <strong>Noch keine Einträge</strong>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    Sobald du etwas anlegst, erscheint es hier.
                  </div>

                  <IonButton style={{ marginTop: 12 }} onClick={() => history.push('/food/create')}>
                    <IonIcon slot="start" icon={addOutline} />
                    Ersten Eintrag anlegen
                  </IonButton>
                </div>
              )}

              {grouped.map(([cat, rows]) => (
                <div key={cat} style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.9, margin: '6px 4px' }}>
                    {cat}
                  </div>

                  <IonList inset style={{ marginTop: 6 }}>
                    {rows.map((m) => (
                      <IonItem key={m.id} routerLink={`/food/${m.id}`} detail>
                        <IonLabel>
                          <strong>{m.name}</strong>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            {formatPrice(m.price, m.unit)}
                          </div>
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </div>
              ))}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default FoodList;
