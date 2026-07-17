// Receives new registrations from the external "Revenda MCI" landing page.
// Security:
//  - POST only.
//  - Origin must be in the RESELLER_LANDING_ORIGINS allowlist (comma-separated).
//  - Basic in-memory rate-limit per IP.
//  - Payload validated with zod.
//  - CNPJ/e-mail/phone/CEP normalized. CNPJ validated by check digit.
//  - Duplicate detection by CNPJ -> email -> phone.
//  - Consultant resolved through reseller_consultants; fallback to default admin.
//  - Never overwrites the salesperson_id of an existing client.
//  - service_role is used only server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const ALLOWED_ORIGINS = (Deno.env.get('RESELLER_LANDING_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsFor(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// --- Rate limit (in-memory, best-effort per instance) ---
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const rateBucket = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBucket.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBucket.set(ip, hits);
  return hits.length > RATE_MAX;
}

// --- Normalizers ---
const digits = (s: string) => (s ?? '').replace(/\D/g, '');
const normEmail = (s: string) => (s ?? '').trim().toLowerCase();

function validCnpj(raw: string): boolean {
  const c = digits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((a, d, i) => a + Number(d) * weights[i], 0);
    const m = sum % 11;
    return m < 2 ? 0 : 11 - m;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), w1);
  const d2 = calc(c.slice(0, 12) + d1, w2);
  return c.endsWith(`${d1}${d2}`);
}

// --- Schema ---
const Payload = z.object({
  responsible_name: z.string().trim().min(2).max(200),
  company_name: z.string().trim().min(2).max(255),
  trade_name: z.string().trim().max(255).optional().nullable(),
  cnpj: z.string().min(11).max(20),
  state_registration: z.string().trim().max(30).optional().nullable(),
  cep: z.string().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  street: z.string().trim().max(255).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  address_number: z.string().trim().max(20).optional().nullable(),
  complement: z.string().trim().max(120).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  years_in_market: z.string().trim().max(40).optional().nullable(),
  email: z.string().email().max(255),
  phone: z.string().min(8).max(30),
  how_did_you_know: z.string().trim().max(255).optional().nullable(),
  consultant_code: z.string().trim().max(80).optional().nullable(),
  interests: z.array(z.string().max(120)).max(30).optional().default([]),
  message: z.string().trim().max(5000).optional().nullable(),
  privacy_consent: z.boolean(),
  form_url: z.string().max(500).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(120).optional().nullable(),
  utm_term: z.string().max(120).optional().nullable(),
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsFor(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Origin allowlist. Reject missing/invalid origins.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Parse and validate
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  const parsed = Payload.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'validation_failed', details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
  const body = parsed.data;

  // Normalize
  const cnpj = digits(body.cnpj);
  const email = normEmail(body.email);
  const phone = digits(body.phone);
  const cep = digits(body.cep ?? '');

  if (!validCnpj(cnpj)) {
    return new Response(JSON.stringify({ error: 'invalid_cnpj' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!body.privacy_consent) {
    return new Response(JSON.stringify({ error: 'privacy_consent_required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resolve consultant selection
  const selectedCode = (body.consultant_code ?? '').trim().toLowerCase();
  let assignmentReason: string;
  let assignedUserId: string | null = null;
  let selectedLabel: string | null = null;
  let selectedCodeStored: string | null = selectedCode || null;

  const { data: consultantRow } = selectedCode
    ? await supabase
        .from('reseller_consultants')
        .select('consultant_code, display_name, crm_user_id, is_none_option, active')
        .eq('consultant_code', selectedCode)
        .maybeSingle()
    : { data: null } as const;

  if (!selectedCode) {
    assignmentReason = 'missing_selection';
  } else if (!consultantRow) {
    assignmentReason = 'invalid_consultant';
  } else if (!consultantRow.active) {
    selectedLabel = consultantRow.display_name;
    assignmentReason = 'inactive_consultant';
  } else if (consultantRow.is_none_option) {
    selectedLabel = consultantRow.display_name;
    assignmentReason = 'default_none';
  } else {
    selectedLabel = consultantRow.display_name;
    assignedUserId = consultantRow.crm_user_id;
    assignmentReason = 'consultant_selected';
  }

  // Fallback to default consultant if no assignment yet
  if (!assignedUserId) {
    const { data: fallback } = await supabase
      .from('reseller_consultants')
      .select('crm_user_id, display_name, consultant_code')
      .eq('is_default_fallback', true)
      .eq('active', true)
      .maybeSingle();
    if (fallback?.crm_user_id) {
      assignedUserId = fallback.crm_user_id;
    } else {
      assignmentReason = 'pending_distribution';
    }
  }

  // Duplicate detection (CNPJ -> email -> phone)
  let dupClient:
    | { id: string; salesperson_id: string | null; assigned_user_id: string | null; company_id: string | null }
    | null = null;
  let dupReason: string | null = null;
  for (const [field, value] of [
    ['cpf_cnpj', cnpj],
    ['email', email],
    ['phone', phone],
  ] as const) {
    if (!value) continue;
    const { data } = await supabase
      .from('clients')
      .select('id, salesperson_id, assigned_user_id, company_id')
      .eq(field, value)
      .limit(1)
      .maybeSingle();
    if (data) {
      dupClient = data;
      dupReason = field;
      break;
    }
  }

  const nowIso = new Date().toISOString();
  const ipHash = await sha256(ip);
  const status = assignmentReason === 'pending_distribution' ? 'pendente_distribuicao' : 'novo';

  // Create the client only when there is no duplicate. Never overwrite an existing client.
  let clientId: string | null = dupClient?.id ?? null;
  if (!dupClient) {
    const { data: newClient, error: insErr } = await supabase
      .from('clients')
      .insert({
        name: body.responsible_name,
        company_name: body.company_name,
        contact_name: body.responsible_name,
        cpf_cnpj: cnpj,
        email,
        phone,
        contact_phone: phone,
        cep,
        city: body.city,
        state: body.state,
        address: body.street,
        address_number: body.address_number,
        neighborhood: body.neighborhood,
        complement: body.complement,
        pipeline_stage: 'lead',
        is_revenda: true,
        salesperson_id: assignedUserId,
        assigned_user_id: assignedUserId,
        assigned_at: assignedUserId ? nowIso : null,
        received_at: nowIso,
        is_new_registration: true,
        source: 'landing_revenda_mci',
        source_label: 'Landing Page — Revenda MCI',
        registration_status: status,
        notes: body.message ?? null,
      })
      .select('id')
      .single();
    if (insErr) {
      console.error('client_insert_failed', insErr.message);
      return new Response(JSON.stringify({ error: 'client_insert_failed' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    clientId = newClient.id;
  }

  // Always store the raw registration.
  const { data: reg, error: regErr } = await supabase
    .from('reseller_registrations')
    .insert({
      client_id: clientId,
      is_duplicate: !!dupClient,
      duplicate_reason: dupReason,
      registration_status: status,
      responsible_name: body.responsible_name,
      company_name: body.company_name,
      trade_name: body.trade_name,
      cnpj,
      state_registration: body.state_registration,
      cep,
      city: body.city,
      street: body.street,
      state: body.state,
      neighborhood: body.neighborhood,
      address_number: body.address_number,
      complement: body.complement,
      website: body.website,
      years_in_market: body.years_in_market,
      email,
      phone,
      how_did_you_know: body.how_did_you_know,
      interests: body.interests ?? [],
      message: body.message,
      privacy_consent: body.privacy_consent,
      consultant_selected_code: selectedCodeStored,
      consultant_selected_label: selectedLabel,
      assigned_user_id: assignedUserId,
      assignment_reason: assignmentReason,
      submitted_at: nowIso,
      form_url: body.form_url,
      origin,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
      utm_content: body.utm_content,
      utm_term: body.utm_term,
      ip_hash: ipHash,
      raw_payload: raw,
    })
    .select('id')
    .single();
  if (regErr) {
    console.error('registration_insert_failed', regErr.message);
    return new Response(JSON.stringify({ error: 'registration_insert_failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Link external id back to client if newly created
  if (!dupClient && clientId) {
    await supabase.from('clients').update({ external_registration_id: reg.id }).eq('id', clientId);
  }

  // Audit
  await supabase.from('reseller_registration_history').insert({
    registration_id: reg.id,
    action: 'received',
    new_status: status,
    new_assigned_user_id: assignedUserId,
    metadata: { assignment_reason: assignmentReason, duplicate: !!dupClient, duplicate_reason: dupReason },
  });

  // Bump consultant received_count
  if (assignmentReason === 'consultant_selected' && selectedCodeStored) {
    await supabase.rpc('increment_reseller_consultant_count', { p_code: selectedCodeStored }).then(
      () => {},
      async () => {
        // Fallback: direct update if RPC not present
        const { data: c } = await supabase
          .from('reseller_consultants')
          .select('id, received_count')
          .eq('consultant_code', selectedCodeStored!)
          .maybeSingle();
        if (c) await supabase.from('reseller_consultants').update({ received_count: (c.received_count ?? 0) + 1 }).eq('id', c.id);
      },
    );
  }

  // Notify the assigned consultant, or the super admins if pending distribution
  if (assignedUserId) {
    await supabase.from('notifications').insert({
      user_id: assignedUserId,
      title: 'Novo cadastro de revenda recebido',
      message: `Novo cadastro de revenda recebido: ${body.company_name}. O cliente foi adicionado à sua carteira.`,
      type: 'reseller_registration',
      related_client_id: clientId,
    });
  } else {
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    for (const a of admins ?? []) {
      await supabase.from('notifications').insert({
        user_id: a.user_id,
        title: 'Cadastro pendente de distribuição',
        message: `Um cadastro da Landing Revenda MCI (${body.company_name}) não pôde ser atribuído automaticamente e aguarda distribuição.`,
        type: 'reseller_registration_pending',
        related_client_id: clientId,
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      registration_id: reg.id,
      client_id: clientId,
      duplicate: !!dupClient,
      duplicate_reason: dupReason,
      assignment_reason: assignmentReason,
      status,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
