
export const parseCurrencyBR = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já for um número do Excel (SheetJS), usamos diretamente
  if (typeof value === 'number') {
    // Verificação de segurança: se o número for suspeito (ex: 10 em vez de 10000)
    // No entanto, se o SheetJS já leu como número, confiamos no valor real.
    return value;
  }

  // Limpeza de caracteres não numéricos exceto ponto e vírgula
  let str = String(value)
    .replace(/&nbsp;/g, '')
    .replace(/\u00A0/g, '')
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!str) return 0;

  // LÓGICA ROBUSTA PARA FORMATO BRASILEIRO
  
  // 1. Identificar se o último separador é uma vírgula (decimal brasileiro)
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Formato Brasileiro: 10.000,00 ou 10,00
    // Removemos todos os pontos (milhares) e trocamos a vírgula por ponto
    return Number(str.replace(/\./g, '').replace(',', '.'));
  } 
  
  if (lastDot > lastComma) {
    // Formato Americano ou Milhar sem decimais (10.000 ou 10.00)
    // Se houver múltiplos pontos, é milhar: 1.200.500
    if ((str.match(/\./g) || []).length > 1) {
      return Number(str.replace(/\./g, ''));
    }
    
    // Se houver apenas um ponto, precisamos decidir se é milhar ou decimal
    // Regra de negócio: Se o arquivo é exportado de sistema brasileiro (HTML/XLS),
    // um ponto sozinho costuma ser milhar (ex: 10.000)
    const parts = str.split('.');
    if (parts[1].length === 3) {
      // 10.000 -> 10000
      return Number(str.replace(/\./g, ''));
    }
    // 10.00 -> 10.00
    return Number(str);
  }

  // Caso sem separadores
  const num = Number(str);
  return isNaN(num) ? 0 : num;
};
