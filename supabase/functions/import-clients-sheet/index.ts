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

// More precise matching: check if normalized header matches any alias
function matchesAny(header: string, aliases: string[]): boolean {
  const h = normalize(header);
  if (!h) return false;
  return aliases.some(a => {
    const na = normalize(a);
    // Exact match first
    if (h === na) return true;
    // Check if the header contains the alias as a whole word
    if (h.includes(na) || na.includes(h)) return true;
    return false;
  });
}

// Score-based matching: prioritize exact matches over partial
function findBestMatch(header: string, aliases: string[]): number {
  const h = normalize(header);
  if (!h) return -1;
  
  let bestScore = 0;
  
  for (const a of aliases) {
    const na = normalize(a);
    if (h === na) return 100; // Exact match
    if (h.startsWith(na + ' ') || h.endsWith(' ' + na)) {
      bestScore = Math.max(bestScore, 80);
    }
    if (h.includes(na)) {
      bestScore = Math.max(bestScore, 60);
    }
    if (na.includes(h) && h.length > 2) {
      bestScore = Math.max(bestScore, 40);
    }
  }
  
  return bestScore;
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
    
    console.log('Fetching CSV from:', csvUrl);
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Não foi possível acessar a planilha. Verifique se ela está compartilhada como "Qualquer pessoa com o link".' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const csvText = await response.text();
    console.log('CSV text length:', csvText.length);
    console.log('CSV first 500 chars:', csvText.substring(0, 500));
    
    const rows = parseCSV(csvText);
    
    console.log('Total rows parsed:', rows.length);
    
    if (rows.length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'Planilha vazia ou sem dados.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to find the header row - it might not be the first row
    // Look for a row that has recognizable column names
    let headerRowIdx = 0;
    const allFieldAliases = [
      'razao social', 'razão social', 'empresa', 'cliente', 'nome', 'company',
      'cnpj', 'cpf', 'documento',
      'cidade', 'city', 'municipio',
      'telefone', 'phone', 'tel', 'fone', 'celular',
      'email', 'e-mail',
      'endereco', 'endereço', 'address',
      'bairro', 'neighborhood',
      'cep', 'zip',
      'uf', 'estado', 'state',
      'contato', 'responsavel', 'responsável',
    ];
    
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      let matchCount = 0;
      for (const cell of rows[i]) {
        const n = normalize(cell);
        if (allFieldAliases.some(a => n === a || n.includes(a))) {
          matchCount++;
        }
      }
      console.log(`Row ${i} match count: ${matchCount}, cells: ${JSON.stringify(rows[i])}`);
      if (matchCount >= 2 && matchCount > 0) {
        headerRowIdx = i;
        break;
      }
    }
    
    const headers = rows[headerRowIdx];
    console.log('Using header row index:', headerRowIdx);
    console.log('Headers found:', JSON.stringify(headers));

    // Extended aliases for better matching - ordered by priority
    const fieldMap: Record<string, string[]> = {
      company_name: ['razao social', 'razão social', 'empresa', 'company_name', 'nome da empresa', 'nome empresa', 'cliente', 'company', 'nome fantasia', 'nome', 'razao', 'razão', 'name', 'nome razao social', 'fantasia'],
      cpf_cnpj: ['cpf cnpj', 'cpf/cnpj', 'cpf_cnpj', 'cnpj', 'cpf', 'documento', 'cnpj cpf', 'doc', 'cnpj/cpf'],
      city: ['cidade', 'city', 'municipio', 'município', 'mun', 'localidade'],
      state: ['uf', 'estado', 'state', 'sigla uf', 'sigla estado', 'sigla'],
      phone: ['telefone', 'phone', 'tel', 'fone', 'celular', 'whatsapp', 'wpp', 'tel comercial', 'telefone comercial', 'contato tel', 'telefone 1', 'tel 1', 'fone 1'],
      email: ['email', 'e-mail', 'e mail', 'e_mail', 'mail', 'correio eletronico', 'email comercial'],
      contact_name: ['contato', 'contact_name', 'responsável', 'responsavel', 'nome do contato', 'pessoa contato', 'nome contato', 'representante', 'pessoa de contato'],
      address: ['endereço', 'endereco', 'address', 'rua', 'logradouro', 'av', 'avenida', 'end', 'endereco completo', 'endereço completo', 'logr'],
      address_number: ['número', 'numero', 'nº', 'n°', 'address_number', 'num', 'no', 'nr', 'nro'],
      complement: ['complemento', 'complement', 'comp', 'compl'],
      neighborhood: ['bairro', 'neighborhood', 'setor', 'distrito'],
      cep: ['cep', 'zip', 'codigo postal', 'código postal', 'cod postal', 'zip code', 'cod post'],
      contact_phone: ['tel contato', 'tel. contato', 'telefone contato', 'contact_phone', 'celular contato', 'fone contato', 'telefone do contato', 'tel do contato'],
      contrib_icms: ['contrib icms', 'contrib. icms', 'contribuinte icms', 'inscricao estadual', 'inscrição estadual', 'ie', 'insc estadual', 'inscr estadual', 'inscricao', 'insc est'],
      notes: ['observações', 'observacoes', 'obs', 'notes', 'notas', 'observação', 'nota', 'info', 'informacoes', 'informações'],
    };

    // Find column indices using scored matching to avoid conflicts
    const colMap: Record<string, number> = {};
    const usedColumns = new Set<number>();
    
    // First pass: exact matches (highest priority)
    for (const [field, aliases] of Object.entries(fieldMap)) {
      for (let idx = 0; idx < headers.length; idx++) {
        if (usedColumns.has(idx)) continue;
        const h = normalize(headers[idx]);
        if (aliases.some(a => normalize(a) === h)) {
          colMap[field] = idx;
          usedColumns.add(idx);
          break;
        }
      }
    }
    
    // Second pass: partial matches for fields not yet matched
    for (const [field, aliases] of Object.entries(fieldMap)) {
      if (colMap[field] !== undefined) continue;
      
      let bestIdx = -1;
      let bestScore = 0;
      
      for (let idx = 0; idx < headers.length; idx++) {
        if (usedColumns.has(idx)) continue;
        const score = findBestMatch(headers[idx], aliases);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
      
      if (bestIdx !== -1 && bestScore >= 40) {
        colMap[field] = bestIdx;
        usedColumns.add(bestIdx);
      }
    }

    // Fallback: if no company_name found, try first non-empty text column
    if (colMap.company_name === undefined) {
      for (let idx = 0; idx < headers.length; idx++) {
        if (!usedColumns.has(idx) && headers[idx].trim()) {
          colMap.company_name = idx;
          usedColumns.add(idx);
          break;
        }
      }
      if (colMap.company_name === undefined) {
        colMap.company_name = 0;
      }
    }

    // Debug: return matched columns info
    const matchedColumns: Record<string, string> = {};
    for (const [field, idx] of Object.entries(colMap)) {
      matchedColumns[field] = `[${idx}] ${headers[idx]}`;
    }
    
    console.log('Column mapping:', JSON.stringify(matchedColumns));

    const clients = [];
    const dataStartIdx = headerRowIdx + 1;
    
    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i];
      const client: Record<string, string> = {};
      
      for (const [field, idx] of Object.entries(colMap)) {
        if (idx < row.length && row[idx] && row[idx].trim()) {
          client[field] = row[idx].trim();
        }
      }
      
      if (client.company_name) {
        clients.push(client);
      }
    }

    // Log sample client for debugging
    if (clients.length > 0) {
      console.log('Sample client (first):', JSON.stringify(clients[0]));
      console.log('Sample client fields:', Object.keys(clients[0]).join(', '));
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
    console.error('Import error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
