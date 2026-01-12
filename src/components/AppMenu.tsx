import React from 'react';
import {
  IonAvatar,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonText,
  IonToolbar,
} from '@ionic/react';
import { newspaperOutline, calendarOutline, restaurantOutline, logOutOutline } from 'ionicons/icons';
import { useAuth } from '../auth/AuthProvider';

const LOGO_URL =
  'https://sotpwnjubybpmorbnunm.supabase.co/storage/v1/object/public/public-assets/bilder/logo.png';

export const AdminMenu: React.FC = () => {
  const { userEmail, signOut } = useAuth() as any;

  return (
    <IonMenu contentId="main" type="overlay">
      <IonToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
          <IonAvatar style={{ width: 40, height: 40 }}>
            <img src={LOGO_URL} alt="FFH" />
          </IonAvatar>

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <IonText style={{ fontWeight: 900 }}>Event Backend</IonText>
            <IonText style={{ fontSize: 12, opacity: 0.7 }}>{userEmail ?? '—'}</IonText>
          </div>
        </div>
      </IonToolbar>

      <IonContent>
        <div style={{ padding: '0 14px 10px 14px' }}>
          <IonChip>
            <IonLabel>Admin</IonLabel>
          </IonChip>
        </div>

        <IonList>
          <IonListHeader>Module</IonListHeader>

          <IonMenuToggle autoHide={false}>
            <IonItem routerLink="/news" routerDirection="root" detail={false}>
              <IonIcon slot="start" icon={newspaperOutline} />
              <IonLabel>News</IonLabel>
            </IonItem>
          </IonMenuToggle>

          <IonMenuToggle autoHide={false}>
            <IonItem routerLink="/program" routerDirection="root" detail={false}>
              <IonIcon slot="start" icon={calendarOutline} />
              <IonLabel>Programm</IonLabel>
            </IonItem>
          </IonMenuToggle>

          <IonMenuToggle autoHide={false}>
            <IonItem routerLink="/food" routerDirection="root" detail={false}>
              <IonIcon slot="start" icon={restaurantOutline} />
              <IonLabel>Essen & Trinken</IonLabel>
            </IonItem>
          </IonMenuToggle>

          <IonItem
            button
            detail={false}
            onClick={async () => {
              await signOut();
            }}
          >
            <IonIcon slot="start" icon={logOutOutline} />
            <IonLabel>Logout</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonMenu>
  );
};
