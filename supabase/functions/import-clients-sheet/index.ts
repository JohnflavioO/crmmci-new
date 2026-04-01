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

    // Extract spreadsheet ID
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return new Response(JSON.stringify({ success: false, error: 'Não foi possível extrair o ID da planilha.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetId = match[1];
    // Extract gid if present
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

    const headers = rows[0].map(h => h.toLowerCase().trim());
    
    // Map common column names to our fields
    const fieldMap: Record<string, string[]> = {
      company_name: ['razão social', 'razao social', 'empresa', 'company_name', 'nome', 'cliente', 'name', 'company'],
      cpf_cnpj: ['cpf/cnpj', 'cpf_cnpj', 'cnpj', 'cpf', 'documento'],
      city: ['cidade', 'city', 'municipio', 'município'],
      state: ['uf', 'estado', 'state'],
      phone: ['telefone', 'phone', 'tel', 'fone', 'celular'],
      email: ['email', 'e-mail', 'e_mail'],
      contact_name: ['contato', 'contact_name', 'responsável', 'responsavel', 'nome do contato'],
      address: ['endereço', 'endereco', 'address', 'rua', 'logradouro'],
      address_number: ['número', 'numero', 'nº', 'n°', 'address_number'],
      complement: ['complemento', 'complement', 'comp'],
      neighborhood: ['bairro', 'neighborhood'],
      cep: ['cep', 'zip', 'codigo postal', 'código postal'],
      contact_phone: ['tel. contato', 'tel contato', 'telefone contato', 'contact_phone'],
      contrib_icms: ['contrib. icms', 'contrib icms', 'contribuinte icms', 'inscricao estadual', 'ie'],
      notes: ['observações', 'observacoes', 'obs', 'notes', 'notas'],
    };

    // Find column indices
    const colMap: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(fieldMap)) {
      const idx = headers.findIndex(h => aliases.some(a => h.includes(a)));
      if (idx !== -1) colMap[field] = idx;
    }

    if (!colMap.company_name && colMap.company_name !== 0) {
      // Try first column as company name
      colMap.company_name = 0;
    }

    const clients = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const client: Record<string, string> = {};
      
      for (const [field, idx] of Object.entries(colMap)) {
        if (row[idx]) client[field] = row[idx];
      }
      
      if (client.company_name) {
        clients.push(client);
      }
    }

    return new Response(JSON.stringify({ success: true, clients, count: clients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
