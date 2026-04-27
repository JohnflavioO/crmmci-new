const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  const calc = (base: string, weights: number[]) =>
    weights.reduce((sum, weight, index) => sum + Number(base[index]) * weight, 0);

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstMod = calc(digits, firstWeights) % 11;
  const firstDigit = firstMod < 2 ? 0 : 11 - firstMod;
  const secondMod = calc(digits, secondWeights) % 11;
  const secondDigit = secondMod < 2 ? 0 : 11 - secondMod;

  return Number(digits[12]) === firstDigit && Number(digits[13]) === secondDigit;
}

function formatPhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return phone || '';
}

function normalizeBrasilApi(data: Record<string, unknown>) {
  const phone = typeof data.ddd_telefone_1 === 'string' ? data.ddd_telefone_1 : '';

  return {
    company_name: String(data.razao_social || data.nome_fantasia || ''),
    phone: formatPhone(phone),
    email: String(data.email || '').toLowerCase(),
    cep: String(data.cep || '').replace(/(\d{5})(\d{3})/, '$1-$2'),
    address: String(data.logradouro || ''),
    address_number: String(data.numero || ''),
    complement: String(data.complemento || ''),
    neighborhood: String(data.bairro || ''),
    city: String(data.municipio || ''),
    state: String(data.uf || ''),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método não permitido.' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cnpj = String(body?.cnpj || '').replace(/\D/g, '');

    if (!isValidCnpj(cnpj)) {
      return jsonResponse({ success: false, error: 'CNPJ inválido.' }, 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Lovable-CNPJ-Lookup/1.0',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      return jsonResponse({ success: false, error: 'CNPJ não encontrado.' }, 404);
    }

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('[lookup-cnpj] BrasilAPI error', response.status, details.slice(0, 300));
      return jsonResponse({ success: false, error: 'Serviço de CNPJ indisponível no momento.' }, 502);
    }

    const data = await response.json();
    return jsonResponse({ success: true, data: normalizeBrasilApi(data) });
  } catch (error) {
    console.error('[lookup-cnpj] Unexpected error', error);
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    return jsonResponse({
      success: false,
      error: isTimeout ? 'A consulta demorou muito. Tente novamente.' : 'Erro ao consultar CNPJ.',
    }, isTimeout ? 504 : 500);
  }
});
