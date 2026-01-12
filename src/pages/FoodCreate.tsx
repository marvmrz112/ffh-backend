import React, { useMemo, useState } from 'react';
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
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { saveOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TABLE = 'menu_items';

const FoodCreate: React.FC = () => {
  const history = useHistory();

  const [category, setCategory] = useState<'Getränke' | 'Essen'>('Getränke');
  const [name, setName] = useState('');
  const [price, setPrice] = useState<string>('3.00');
  const [unit, setUnit] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('10');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => {
    return {
      n: name.trim(),
      u: unit.trim(),
      so: sortOrder.trim(),
      p: price.trim(),
    };
  }, [name, unit, sortOrder, price]);

  const validate = () => {
    if (trimmed.n.length < 2) return 'Bitte einen Namen eingeben (mind. 2 Zeichen).';

    const p = Number(trimmed.p.replace(',', '.'));
    if (!Number.isFinite(p) || p <= 0) return 'Bitte einen gültigen Preis eingeben (z.B. 3,50).';

    const so = trimmed.so ? Number(trimmed.so) : 10;
    if (!Number.isFinite(so)) return 'Sortierung muss eine Zahl sein.';

    return null;
  };

  const save = async () => {
    setErr(null);
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const p = Number(trimmed.p.replace(',', '.'));
    const so = trimmed.so ? Number(trimmed.so) : 10;

    setBusy(true);
    try {
      const { error } = await supabase.from(TABLE).insert([
        {
          category,
          name: trimmed.n,
          price: p,
          unit: trimmed.u || null,
          sort_order: so,
        },
      ]);

      if (error) {
        const hint =
          /row-level security/i.test(error.message) ? '\n\nHinweis: RLS/Policy blockt INSERT.' : '';
        setErr(error.message + hint);
        return;
      }

      history.replace('/food');
    } catch (e: any) {
      setErr(e?.message ?? 'Unbekannter Fehler beim Speichern.');
    } finally {
      setBusy(false);
    }
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Neuer Eintrag</div>

                <IonButton size="small" onClick={save} disabled={busy}>
                  {busy ? (
                    <IonSpinner />
                  ) : (
                    <>
                      <IonIcon slot="start" icon={saveOutline} />
                      Speichern
                    </>
                  )}
                </IonButton>
              </div>

              {err && (
                <IonText color="danger">
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{err}</p>
                </IonText>
              )}

              <IonItem>
                <IonLabel position="stacked">Kategorie</IonLabel>
                <IonSelect value={category} onIonChange={(e) => setCategory(e.detail.value)} disabled={busy}>
                  <IonSelectOption value="Getränke">Getränke</IonSelectOption>
                  <IonSelectOption value="Essen">Essen</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Name</IonLabel>
                <IonInput
                  value={name}
                  placeholder="z.B. Bier, Wasser, Bratwurst"
                  onIonChange={(e) => setName(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Preis (€)</IonLabel>
                <IonInput
                  value={price}
                  inputMode="decimal"
                  placeholder="z.B. 3,50"
                  onIonChange={(e) => setPrice(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Einheit (optional)</IonLabel>
                <IonInput
                  value={unit}
                  placeholder="z.B. 0,3l / 0,25l"
                  onIonChange={(e) => setUnit(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Sortierung</IonLabel>
                <IonInput
                  value={sortOrder}
                  inputMode="numeric"
                  placeholder="z.B. 10"
                  onIonChange={(e) => setSortOrder(e.detail.value ?? '')}
                  disabled={busy}
                />
              </IonItem>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Tipp: Über „Sortierung“ steuerst du die Reihenfolge innerhalb der Kategorie.
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default FoodCreate;
