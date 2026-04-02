import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(current.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(header: string, aliases: string[]): boolean {
  const h = normalize(header);
  return aliases.some(a => {
    const na = normalize(a);
    return h === na || h.includes(na) || na.includes(h);
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || !url.includes('docs.google.com/spreadsheets')) {
      return new Response(JSON.stringify({ success: false, error: 'URL inválida. Use um link de planilha Google.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return new Response(JSON.stringify({ success: false, error: 'Não foi possível extrair o ID da planilha.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetId = match[1];
    const gidMatch = url.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Não foi possível acessar a planilha. Verifique se ela está compartilhada como "Qualquer pessoa com o link".' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    if (rows.length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'Planilha vazia ou sem dados.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = rows[0];

    // Extended aliases for better matching
    const fieldMap: Record<string, string[]> = {
      company_name: ['razão social', 'razao social', 'empresa', 'company_name', 'nome da empresa', 'nome empresa', 'cliente', 'name', 'company', 'nome fantasia', 'nome', 'razao', 'razão'],
      cpf_cnpj: ['cpf/cnpj', 'cpf_cnpj', 'cnpj', 'cpf', 'documento', 'cnpj/cpf', 'doc'],
      city: ['cidade', 'city', 'municipio', 'município', 'mun'],
      state: ['uf', 'estado', 'state', 'sigla uf', 'sigla estado'],
      phone: ['telefone', 'phone', 'tel', 'fone', 'celular', 'whatsapp', 'wpp', 'tel comercial', 'telefone comercial', 'tel.'],
      email: ['email', 'e-mail', 'e_mail', 'mail', 'correio eletronico'],
      contact_name: ['contato', 'contact_name', 'responsável', 'responsavel', 'nome do contato', 'pessoa contato', 'nome contato', 'representante'],
      address: ['endereço', 'endereco', 'address', 'rua', 'logradouro', 'av', 'avenida', 'end'],
      address_number: ['número', 'numero', 'nº', 'n°', 'address_number', 'num', 'no'],
      complement: ['complemento', 'complement', 'comp', 'compl'],
      neighborhood: ['bairro', 'neighborhood', 'setor', 'distrito'],
      cep: ['cep', 'zip', 'codigo postal', 'código postal', 'cod postal', 'zip code'],
      contact_phone: ['tel. contato', 'tel contato', 'telefone contato', 'contact_phone', 'celular contato', 'fone contato'],
      contrib_icms: ['contrib. icms', 'contrib icms', 'contribuinte icms', 'inscricao estadual', 'inscrição estadual', 'ie', 'insc estadual', 'inscr estadual'],
      notes: ['observações', 'observacoes', 'obs', 'notes', 'notas', 'observação', 'nota', 'info'],
    };

    // Find column indices using normalized matching
    const colMap: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(fieldMap)) {
      const idx = headers.findIndex(h => matchesAny(h, aliases));
      if (idx !== -1) colMap[field] = idx;
    }

    // Fallback: if no company_name found, try first column
    if (colMap.company_name === undefined) {
      colMap.company_name = 0;
    }

    // Debug: return matched columns info
    const matchedColumns: Record<string, string> = {};
    for (const [field, idx] of Object.entries(colMap)) {
      matchedColumns[field] = headers[idx];
    }

    const clients = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const client: Record<string, string> = {};
      
      for (const [field, idx] of Object.entries(colMap)) {
        if (idx < row.length && row[idx]) {
          client[field] = row[idx];
        }
      }
      
      if (client.company_name) {
        clients.push(client);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      clients, 
      count: clients.length,
      matched_columns: matchedColumns,
      total_columns: headers.length,
      headers: headers,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
