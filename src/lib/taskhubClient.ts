/**
 * Generic TaskHub bridge client — product-agnostic.
 *
 * Any Lovable product (MCI CRM, FlowChat, ProCRM, Kontas, MCI Radar, ...)
 * uses this same module. The only thing that changes per product is:
 *   - The `sourceApp` identifier passed in
 *   - The `module` resolver (optional)
 *   - Backend secrets TASKHUB_API_URL / TASKHUB_API_KEY
 *
 * No business logic from any specific product should leak into this file.
 */
import { supabase } from "@/integrations/supabase/client";

export type ReportType = "bug" | "improvement" | "idea" | "request";
export type ReportPriority = "low" | "medium" | "high" | "critical";

export interface ReportAttachment {
  name: string;
  mime: string;
  data_base64: string;
}

export interface ReportContext {
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  company_id?: string | null;
  app_version?: string | null;
  page_url?: string | null;
  page_path?: string | null;
  module?: string | null;
  user_agent?: string | null;
  submitted_at?: string;
  [k: string]: unknown;
}

export interface ReportPayload {
  type: ReportType;
  title: string;
  description: string;
  priority?: ReportPriority;
  module?: string;
  source_app: string;
  context?: ReportContext;
  attachments?: ReportAttachment[];
}

export interface ReportResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

const AUDIT_KEY = "taskhub_report_audit_log";
const AUDIT_LIMIT = 50;

function appendAudit(entry: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const list: unknown[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ts: new Date().toISOString(), ...entry });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, AUDIT_LIMIT)));
  } catch {
    /* storage may be unavailable */
  }
}

export function getAuditLog(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog() {
  try { localStorage.removeItem(AUDIT_KEY); } catch { /* ignore */ }
}

export async function sendReportToTaskHub(payload: ReportPayload): Promise<ReportResult> {
  const enriched: ReportPayload = {
    ...payload,
    context: {
      page_url: typeof window !== "undefined" ? window.location.href : null,
      page_path: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      submitted_at: new Date().toISOString(),
      ...payload.context,
    },
  };

  try {
    const { data, error } = await supabase.functions.invoke("report-to-taskhub", {
      body: enriched,
    });

    if (error) {
      // Try to read the JSON body returned by the function on non-2xx.
      let upstream: any = null;
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === "function") upstream = await ctx.json();
        else if (ctx && typeof ctx.text === "function") {
          const t = await ctx.text();
          try { upstream = JSON.parse(t); } catch { upstream = { message: t }; }
        }
      } catch { /* ignore */ }
      appendAudit({
        status: "error",
        type: payload.type,
        title: payload.title,
        error: error.message,
        upstream,
      });
      return { ok: false, status: 0, data: upstream, error: upstream?.message || error.message };
    }

    const ok = (data as any)?.ok === true;
    appendAudit({
      status: ok ? "sent" : "error",
      type: payload.type,
      title: payload.title,
      response: data,
    });
    return { ok, status: ok ? 200 : 502, data };
  } catch (e) {
    const message = (e as Error).message;
    appendAudit({ status: "error", type: payload.type, title: payload.title, error: message });
    return { ok: false, status: 0, data: null, error: message };
  }
}

export async function fileToAttachment(file: File): Promise<ReportAttachment> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return {
    name: file.name,
    mime: file.type || "application/octet-stream",
    data_base64: btoa(binary),
  };
}
