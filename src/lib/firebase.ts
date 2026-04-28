import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const firebaseConfig = {
  apiKey: "AIzaSyA7Xg9BQ4kzg6QqGnlxynbp92nSs2jtGeI",
  authDomain: "push-mci-crm.firebaseapp.com",
  projectId: "push-mci-crm",
  storageBucket: "push-mci-crm.firebasestorage.app",
  messagingSenderId: "741697309199",
  appId: "1:741697309199:web:aaf8751a1b31749eaa717a",
  measurementId: "G-39Q3MK7TX4"
};

const app = initializeApp(firebaseConfig);

const messaging = (() => {
  try {
    if (typeof window === 'undefined') return null;
    
    const isSupported = 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
    const isPreview = window.location.hostname.includes('lovable.app') || 
                      window.location.hostname.includes('lovableproject.com') ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
    
    if (isSupported && !isPreview) {
      console.log('[Firebase] Initializing messaging for production');
      return getMessaging(app);
    } else {
      console.log('[Firebase] Messaging skipped:', { isSupported, isPreview });
      return null;
    }
  } catch (e) {
    console.warn('[Firebase] Messaging initialization error (non-critical):', e);
    return null;
  }
})();

export const requestNotificationPermission = async () => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: "BMS4aQERHypWXmwrWRAvU3keQDe9u7M-tEdBinML8tf0HXf8Q4QAyKKJ2RXwTO8ZAk9gFw2esIuEp89UkGsUN6Q"
      });
      
      if (token) {
        await saveTokenToDatabase(token);
        return token;
      }
    }
  } catch (error) {
    console.error("Erro ao solicitar permissão de notificação:", error);
  }
};

const saveTokenToDatabase = async (token: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_push_tokens')
    .upsert({
      user_id: user.id,
      fcm_token: token,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      browser: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
      is_active: true
    }, {
      onConflict: 'user_id,fcm_token'
    });

  if (error) {
    console.error("Erro ao salvar token FCM:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export { messaging };
