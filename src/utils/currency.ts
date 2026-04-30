
export const parseCurrencyBR = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já for um número do Excel (SheetJS), usamos diretamente
  if (typeof value === 'number') {
    return value;
  }

  let str = String(value)
    .replace(/&nbsp;/g, '')
    .replace(/\u00A0/g, '')
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .trim();

  // Caso especial: o valor pode estar vindo formatado com pontos como milhar e vírgula como decimal
  // Ex: "10.000,00"
  if (str.includes('.') && str.includes(',')) {
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }

  // Ex: "404,77"
  if (str.includes(',') && !str.includes('.')) {
    return Number(str.replace(',', '.'));
  }

  // Se houver apenas pontos (formato americano ou milhar sem centavos separado por ponto)
  // Se tiver múltiplos pontos, é separador de milhar: "10.000.000" -> 10000000
  if (str.includes('.') && (str.match(/\./g) || []).length > 1) {
    return Number(str.replace(/\./g, ''));
  }

  // Se tiver um único ponto, precisamos decidir se é decimal ou milhar
  // Em arquivos exportados que fingem ser XLS mas são HTML, "10.000" costuma ser 10 mil
  // Se o número depois do ponto tiver exatamente 3 dígitos, tratamos como milhar
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      return Number(str.replace(/\./g, ''));
    }
    // Se for 2 dígitos, é centavo: "10.00" -> 10
    if (parts.length === 2 && parts[1].length === 2) {
      return Number(str);
    }
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
};
