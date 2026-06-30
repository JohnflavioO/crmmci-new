import { initializeApp, type FirebaseApp } from "firebase/app";
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

const VAPID_KEY =
  "BMS4aQERHypWXmwrWRAvU3keQDe9u7M-tEdBinML8tf0HXf8Q4QAyKKJ2RXwTO8ZAk9gFw2esIuEp89UkGsUN6Q";

const DEVICE_ID_KEY = "mci_device_id";

let app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

export class FcmError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function ensureApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      (crypto as any)?.randomUUID?.() ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function getMessagingOrThrow(): Promise<Messaging> {
  if (_messaging) return _messaging;
  if (typeof window === "undefined")
    throw new FcmError("no_window", "Ambiente sem window (SSR).");
  const supported = await isSupported().catch(() => false);
  if (!supported)
    throw new FcmError(
      "unsupported",
      "Este navegador não suporta Firebase Messaging (Push API/Notification API ausente)."
    );
  try {
    _messaging = getMessaging(ensureApp());
    return _messaging;
  } catch (e: any) {
    throw new FcmError(
      "firebase_init_failed",
      `Falha ao inicializar Firebase Messaging: ${e?.message || e}`,
      e
    );
  }
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator))
    throw new FcmError(
      "no_sw_api",
      "Service Worker API indisponível neste navegador."
    );
  try {
    const existing = await navigator.serviceWorker.getRegistration(
      "/firebase-messaging-sw.js"
    );
    console.log("[FCM] serviceWorker.getRegistration ->", existing);
    if (existing) {
      const ready = await navigator.serviceWorker.ready;
      console.log("[FCM] serviceWorker.ready (existing) ->", {
        scope: ready.scope,
        active: ready.active?.state,
        installing: ready.installing?.state,
        waiting: ready.waiting?.state,
      });
      return existing;
    }
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    console.log("[FCM] serviceWorker.register OK ->", {
      scope: reg.scope,
      active: reg.active?.state,
      installing: reg.installing?.state,
      waiting: reg.waiting?.state,
    });
    const ready = await navigator.serviceWorker.ready;
    console.log("[FCM] serviceWorker.ready ->", {
      scope: ready.scope,
      active: ready.active?.state,
    });
    return reg;
  } catch (e: any) {
    console.error("[FCM] serviceWorker.register FAILED", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
      error: e,
    });
    throw new FcmError(
      "sw_register_failed",
      `Falha ao registrar /firebase-messaging-sw.js: ${e?.name || ""} ${e?.message || e}`,
      e
    );
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
  } catch {
    return null;
  }
}

export interface FcmDiagnostics {
  windowAvailable: boolean;
  isSecureContext: boolean;
  notificationApi: boolean;
  permission: NotificationPermission | "unavailable";
  serviceWorkerApi: boolean;
  serviceWorkerFileReachable: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerScope: string | null;
  serviceWorkerState: string | null;
  serviceWorkerRegisterError: string | null;
  firebaseInitialized: boolean;
  messagingSupported: boolean;
  vapidConfigured: boolean;
  tokenObtained: boolean;
  tokenSavedInDb: boolean;
  tokenPreview: string | null;
  deviceId: string;
  lastTestAt: string | null;
  errors: string[];
}

export async function getFcmDiagnostics(): Promise<FcmDiagnostics> {
  const errors: string[] = [];
  const windowAvailable = typeof window !== "undefined";
  const isSecureContext = windowAvailable ? !!window.isSecureContext : false;
  const notificationApi = windowAvailable && "Notification" in window;
  const permission: NotificationPermission | "unavailable" = notificationApi
    ? Notification.permission
    : "unavailable";
  const serviceWorkerApi = windowAvailable && "serviceWorker" in navigator;

  let serviceWorkerRegistered = false;
  let serviceWorkerScope: string | null = null;
  let serviceWorkerState: string | null = null;
  let serviceWorkerFileReachable = false;
  let serviceWorkerRegisterError: string | null = null;

  if (serviceWorkerApi) {
    // 1) Confere que o arquivo é servido na raiz do domínio
    try {
      const resp = await fetch("/firebase-messaging-sw.js", { cache: "no-store" });
      serviceWorkerFileReachable = resp.ok;
      if (!resp.ok) {
        errors.push(`SW file HTTP ${resp.status} em /firebase-messaging-sw.js`);
      } else {
        const ct = resp.headers.get("content-type") || "";
        if (!/javascript/i.test(ct)) {
          errors.push(`SW file servido com content-type inesperado: ${ct}`);
        }
      }
    } catch (e: any) {
      errors.push(`SW fetch: ${e?.message || e}`);
    }

    // 2) Verifica registro existente; se não houver, tenta registrar e captura o erro real
    try {
      let reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (!reg && serviceWorkerFileReachable) {
        try {
          reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
          });
          await navigator.serviceWorker.ready;
        } catch (e: any) {
          serviceWorkerRegisterError = `${e?.name || "Error"}: ${e?.message || e}`;
          errors.push(`SW register: ${serviceWorkerRegisterError}`);
        }
      }
      serviceWorkerRegistered = !!reg;
      serviceWorkerScope = reg?.scope ?? null;
      const sw = reg?.active || reg?.installing || reg?.waiting;
      serviceWorkerState = sw?.state ?? null;
    } catch (e: any) {
      errors.push(`SW lookup: ${e?.message || e}`);
    }
  } else {
    errors.push("navigator.serviceWorker indisponível (contexto não-seguro ou navegador sem suporte).");
  }

  let firebaseInitialized = false;
  let messagingSupported = false;
  try {
    ensureApp();
    firebaseInitialized = true;
    messagingSupported = await isSupported().catch(() => false);
  } catch (e: any) {
    errors.push(`Firebase init: ${e?.message || e}`);
  }

  const vapidConfigured = !!VAPID_KEY && VAPID_KEY.length > 20;

  const deviceId = getDeviceId();
  let tokenSavedInDb = false;
  let tokenPreview: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await (supabase as any)
        .from("user_push_tokens")
        .select("fcm_token, is_active, device_info, last_seen_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .contains("device_info", { device_id: deviceId })
        .maybeSingle();
      if (data?.fcm_token) {
        tokenSavedInDb = true;
        tokenPreview = `${data.fcm_token.slice(0, 16)}…${data.fcm_token.slice(-6)}`;
      }
    }
  } catch (e: any) {
    errors.push(`DB lookup: ${e?.message || e}`);
  }

  const lastTestAt = windowAvailable
    ? localStorage.getItem("mci_fcm_last_test_at")
    : null;

  return {
    windowAvailable,
    isSecureContext,
    notificationApi,
    permission,
    serviceWorkerApi,
    serviceWorkerFileReachable,
    serviceWorkerRegistered,
    serviceWorkerScope,
    serviceWorkerState,
    serviceWorkerRegisterError,
    firebaseInitialized,
    messagingSupported,
    vapidConfigured,
    tokenObtained: tokenSavedInDb,
    tokenSavedInDb,
    tokenPreview,
    deviceId,
    lastTestAt,
    errors,
  };
}

export function markFcmTestPerformed() {
  if (typeof window !== "undefined") {
    localStorage.setItem("mci_fcm_last_test_at", new Date().toISOString());
  }
}

/**
 * Solicita permissão, registra SW, obtém token FCM e salva em user_push_tokens.
 * Lança FcmError com código específico em qualquer falha — sem mensagens genéricas.
 */
export async function requestNotificationPermission(): Promise<string> {
  if (typeof window === "undefined")
    throw new FcmError("no_window", "Ambiente sem window.");

  if (!("Notification" in window))
    throw new FcmError(
      "no_notification_api",
      "Este navegador não expõe a Notification API."
    );

  if (!window.isSecureContext)
    throw new FcmError(
      "insecure_context",
      "Push exige contexto seguro (HTTPS ou localhost)."
    );

  if (!VAPID_KEY)
    throw new FcmError("vapid_missing", "VAPID Key não configurada no cliente.");

  const messaging = await getMessagingOrThrow();
  console.log("[FCM] Firebase Messaging inicializado.");

  let permission: NotificationPermission;
  try {
    console.log("[FCM] Chamando Notification.requestPermission()…");
    permission = await Notification.requestPermission();
    console.log("[FCM] Notification.requestPermission() ->", permission);
  } catch (e: any) {
    console.error("[FCM] Notification.requestPermission() THREW", {
      name: e?.name,
      message: e?.message,
      error: e,
    });
    throw new FcmError(
      "permission_request_failed",
      `Falha ao solicitar permissão: ${e?.name || ""} ${e?.message || e}`,
      e
    );
  }

  if (permission === "denied")
    throw new FcmError(
      "permission_denied",
      "Permissão bloqueada pelo usuário/navegador. Libere notificações nas permissões do site."
    );
  if (permission !== "granted")
    throw new FcmError(
      "permission_dismissed",
      "Permissão não concedida (usuário fechou o prompt)."
    );

  console.log("[FCM] Registrando Service Worker…");
  const swReg = await registerSW();

  let token: string | null = null;

  // Diagnóstico pré-getToken
  let readyReg: ServiceWorkerRegistration | null = null;
  try {
    readyReg = await navigator.serviceWorker.ready;
  } catch (e: any) {
    console.error("[FCM] navigator.serviceWorker.ready FAILED", {
      name: e?.name, message: e?.message, stack: e?.stack,
    });
  }

  const pushSub = await swReg.pushManager.getSubscription().catch((e) => {
    console.error("[FCM] pushManager.getSubscription FAILED", {
      name: e?.name, message: e?.message,
    });
    return null;
  });

  console.log("[FCM] Pré-getToken diagnostics:", {
    messagingInitialized: !!messaging,
    vapidKeyPreview: `${VAPID_KEY.slice(0, 10)}…${VAPID_KEY.slice(-6)}`,
    vapidKeyLength: VAPID_KEY.length,
    swRegPassedToGetToken: {
      scope: swReg.scope,
      active: swReg.active?.state,
      installing: swReg.installing?.state,
      waiting: swReg.waiting?.state,
      scriptURL: swReg.active?.scriptURL,
    },
    swReady: readyReg
      ? {
          scope: readyReg.scope,
          active: readyReg.active?.state,
          scriptURL: readyReg.active?.scriptURL,
          sameAsPassed: readyReg === swReg,
        }
      : null,
    existingPushSubscription: pushSub
      ? { endpoint: pushSub.endpoint, expirationTime: pushSub.expirationTime }
      : null,
    notificationPermission: Notification.permission,
    isSecureContext: window.isSecureContext,
    location: window.location.origin,
  });

  try {
    console.log("[FCM] Chamando getToken()…");
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    console.log("[FCM] getToken() retornou:", {
      hasToken: !!token,
      length: token?.length ?? 0,
      preview: token ? `${token.slice(0, 16)}…${token.slice(-6)}` : null,
      raw: token, // token completo no console para auditoria
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    let code = "get_token_failed";
    if (/permission/i.test(msg)) code = "permission_denied";
    else if (/applicationServerKey|vapid/i.test(msg)) code = "vapid_invalid";
    else if (/push service|registration/i.test(msg)) code = "push_service_failed";
    console.error("[FCM] getToken() THREW EXCEPTION", {
      mappedCode: code,
      errorName: e?.name,
      errorCode: e?.code,
      errorMessage: msg,
      errorStack: e?.stack,
      errorCause: e?.cause,
      errorCustomData: e?.customData,
      errorServerResponse: e?.serverResponse,
      errorJSON: (() => { try { return JSON.stringify(e, Object.getOwnPropertyNames(e)); } catch { return null; } })(),
      rawError: e,
    });
    throw new FcmError(
      code,
      `getToken() falhou: ${e?.name || ""} ${e?.code ? `[${e.code}] ` : ""}${msg}`,
      e
    );
  }

  if (!token) {
    console.error("[FCM] getToken() retornou string VAZIA (sem exceção)", {
      messaging: !!messaging,
      vapidKeyPreview: `${VAPID_KEY.slice(0, 10)}…${VAPID_KEY.slice(-6)}`,
      swScope: swReg.scope,
      swActiveState: swReg.active?.state,
      readyScope: readyReg?.scope,
      permission: Notification.permission,
      hint: "Provável VAPID Key incompatível com o Sender ID do Firebase project, ou bloqueio do push service.",
    });
    throw new FcmError(
      "empty_token",
      "getToken() retornou vazio (sem exceção). Verifique VAPID Key vs Sender ID e se o push service do navegador está acessível."
    );
  }

  console.log("[FCM] Salvando token no banco…");
  await saveTokenToDatabase(token);
  console.log("[FCM] Token salvo com sucesso.");
  return token;
}

async function saveTokenToDatabase(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    throw new FcmError("not_authenticated", "Usuário não autenticado.");

  const company_id = await getCompanyId(user.id);
  const device_id = getDeviceId();
  const device_type = /Mobi|Android/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop";

  const payload = {
    user_id: user.id,
    company_id,
    fcm_token: token,
    device_type,
    browser: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
    is_active: true,
    device_info: {
      device_id,
      platform: navigator.platform,
      language: navigator.language,
      user_agent: navigator.userAgent,
    },
  };

  const { error } = await (supabase as any)
    .from("user_push_tokens")
    .upsert(payload, { onConflict: "user_id,fcm_token" });

  if (error) {
    logger.error("Erro ao salvar token FCM:", error);
    throw new FcmError(
      "db_save_failed",
      `Falha ao salvar token no banco: ${error.message}`,
      error
    );
  }
}
