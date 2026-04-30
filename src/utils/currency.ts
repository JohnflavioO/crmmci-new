
export const parseCurrencyBR = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já for um número e NÃO for um caso de "falso decimal" (número muito pequeno vindo de planilha mal formatada)
  // Nota: Em planilhas exportadas como HTML, o SheetJS pode errar a interpretação se o valor for "10.000"
  // mas como estamos usando raw: true e ele vem como número, vamos confiar mas aplicar uma verificação.
  if (typeof value === 'number') {
    return value;
  }

  // Limpeza de caracteres não numéricos exceto ponto e vírgula
  let str = String(value)
    .replace(/&nbsp;/g, '')
    .replace(/\u00A0/g, '')
    .replace(/R\$/g, '')
    .replace(/[^\d.,-]/g, '') // Mantém apenas dígitos, ponto, vírgula e sinal de menos
    .trim();

  if (!str) return 0;

  // LÓGICA DEFINITIVA PARA FORMATO BRASILEIRO (Prioritário)
  // Caso 1: "10.000,00" -> Ponto milhar, vírgula decimal
  if (str.includes('.') && str.includes(',')) {
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }

  // Caso 2: "10.000" ou "1.200.500" -> Apenas pontos (Milhar)
  if (str.includes('.') && !str.includes(',')) {
    // Se houver mais de um ponto, é definitivamente milhar: 1.200.500
    if ((str.match(/\./g) || []).length > 1) {
      return Number(str.replace(/\./g, ''));
    }
    // Se houver apenas um ponto e 3 dígitos depois, é milhar: 10.000
    const parts = str.split('.');
    if (parts[1].length === 3) {
      return Number(str.replace(/\./g, ''));
    }
    // Se houver apenas um ponto e 2 dígitos depois, é decimal: 10.00
    if (parts[1].length === 2 || parts[1].length === 1) {
      return Number(str);
    }
  }

  // Caso 3: "10,00" -> Apenas vírgula (Decimal)
  if (str.includes(',') && !str.includes('.')) {
    return Number(str.replace(',', '.'));
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
};
