import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const firebaseConfig = {
  apiKey: "AIzaSyA7Xg9BQ4kzg6QqGnlxynbp92nSs2jtGeI",
  authDomain: "push-mci-crm.firebaseapp.com",
  projectId: "push-mci-crm",
  storageBucket: "push-mci-crm.firebasestorage.app",
  messagingSenderId: "741697309199",
  appId: "1:741697309199:web:aaf8751a1b31749eaa717a",
  measurementId: "G-39Q3MK7TX4",
};

const VAPID_KEY = "BMS4aQERHypWXmwrWRAvU3keQDe9u7M-tEdBinML8tf0HXf8Q4QAyKKJ2RXwTO8ZAk9gFw2esIuEp89UkGsUN6Q";

const app = initializeApp(firebaseConfig);

let _messaging: Messaging | null = null;
async function getMessagingSafe(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (!supported) { logger.debug("[Firebase] Messaging not supported"); return null; }
    const isPreview =
      window.location.hostname.includes("lovable.app") ||
      window.location.hostname.includes("lovableproject.com");
    if (isPreview) { logger.debug("[Firebase] Messaging skipped in preview"); return null; }
    _messaging = getMessaging(app);
    return _messaging;
  } catch (e) {
    logger.warn("[Firebase] Messaging init failed:", e);
    return null;
  }
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    logger.error("[Firebase] SW register failed:", e);
    return null;
  }
}

async function getCompanyId(userId: string): Promise<string | null> {
  try {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.company_id ?? null;
  } catch { return null; }
}

export async function requestNotificationPermission(): Promise<string | null> {
  const messaging = await getMessagingSafe();
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const swReg = await getOrRegisterSW();
    if (!swReg) return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return null;
    await saveTokenToDatabase(token);
    return token;
  } catch (error) {
    logger.error("Erro ao solicitar permissão de notificação:", error);
    return null;
  }
}

async function saveTokenToDatabase(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const company_id = await getCompanyId(user.id);
  const { error } = await (supabase as any)
    .from("user_push_tokens")
    .upsert({
      user_id: user.id,
      company_id,
      fcm_token: token,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      browser: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: "user_id,fcm_token" });
  if (error) logger.error("Erro ao salvar token FCM:", error);
}
