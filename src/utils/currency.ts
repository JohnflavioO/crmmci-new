
export const parseCurrencyBR = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já for um número do Excel (SheetJS), usamos diretamente
  if (typeof value === 'number') {
    return value;
  }

  // Limpeza de caracteres não numéricos exceto ponto, vírgula e sinal de menos
  // Preservamos o texto original para análise de separadores
  let str = String(value)
    .replace(/&nbsp;/g, '')
    .replace(/\u00A0/g, '')
    .replace(/R\$/g, '')
    .trim();

  if (!str) return 0;

  // LÓGICA ROBUSTA PARA FORMATO BRASILEIRO (10.000,00 ou 10,00 ou 10.000)
  
  // Caso 1: Tem vírgula (Padrão brasileiro obrigatório)
  if (str.includes(',')) {
    // 10.000,00 -> 10000.00
    // Removemos os pontos de milhar e trocamos a vírgula por ponto decimal
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }

  // Caso 2: Não tem vírgula, mas tem ponto(s)
  if (str.includes('.')) {
    // Se houver mais de um ponto, é definitivamente milhar: 1.200.500
    if ((str.match(/\./g) || []).length > 1) {
      return Number(str.replace(/\./g, ''));
    }
    
    // Se houver apenas um ponto, precisamos decidir se é milhar ou decimal.
    // Regra para arquivos do sistema MCI (HTML exportado): 
    // "10.000" (sem vírgula) é DEZ MIL, não dez.
    const parts = str.split('.');
    if (parts[1].length === 3) {
      // 10.000 -> 10000
      return Number(str.replace(/\./g, ''));
    }
    // Se for 2 dígitos, pode ser centavo americano (10.00) ou erro de exportação (ex: 10.00 virando 10)
    // No contexto financeiro brasileiro, 10.00 sem vírgula costuma ser dez reais.
    return Number(str);
  }

  // Caso 3: Apenas números (ex: 10000)
  const num = Number(str.replace(/\s/g, ''));
  return isNaN(num) ? 0 : num;
};
