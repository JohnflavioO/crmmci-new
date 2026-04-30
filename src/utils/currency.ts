
export const parseCurrencyBR = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Em arquivos exportados que fingem ser XLS (HTML), capturamos como string para precisão.
  if (typeof value === 'number') {
    return value;
  }

  // Limpeza total de espaços, incluindo espaços HTML (&nbsp;) e símbolos
  let str = String(value)
    .replace(/&nbsp;/g, '')
    .replace(/\u00A0/g, '')
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!str) return 0;

  // LÓGICA DE PRECISÃO TOTAL PARA EXPORTAÇÕES BRASILEIRAS (SISTEMA MCI)
  
  // 1. Se contém vírgula, é o padrão BR clássico (milhar opcional com ponto, decimal com vírgula)
  if (str.includes(',')) {
    // Remove todos os pontos (milhares) e converte vírgula em ponto decimal (JS)
    const sanitized = str.replace(/\./g, '').replace(',', '.');
    return Number(sanitized);
  }

  // 2. Se NÃO contém vírgula, mas contém ponto, o sistema exportador está usando ponto como milhar.
  // Ex: "10.000" ou "1.200.500"
  if (str.includes('.')) {
    // Removemos todos os pontos e tratamos o número como inteiro (sem centavos na planilha)
    const sanitized = str.replace(/\./g, '');
    return Number(sanitized);
  }

  // 3. Apenas dígitos (ex: "10000")
  const num = Number(str);
  return isNaN(num) ? 0 : num;
};
