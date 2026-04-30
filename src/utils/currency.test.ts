
import { describe, it, expect } from 'vitest';
import { parseCurrencyBR } from './currency';

describe('parseCurrencyBR', () => {
  it('deve converter valores com separador de milhar (ponto) corretamente', () => {
    expect(parseCurrencyBR('10.000')).toBe(10000);
    expect(parseCurrencyBR('1.200.500')).toBe(1200500);
  });

  it('deve converter valores com separador de milhar (ponto) e decimal (vírgula) corretamente', () => {
    expect(parseCurrencyBR('10.000,00')).toBe(10000);
    expect(parseCurrencyBR('8.735,97')).toBe(8735.97);
    expect(parseCurrencyBR('1.200.500,45')).toBe(1200500.45);
  });

  it('deve converter valores apenas com vírgula decimal corretamente', () => {
    expect(parseCurrencyBR('404,77')).toBe(404.77);
    expect(parseCurrencyBR('10,00')).toBe(10);
  });

  it('deve converter valores em formato numérico (SheetJS) sem alteração', () => {
    expect(parseCurrencyBR(10000)).toBe(10000);
    expect(parseCurrencyBR(8735.97)).toBe(8735.97);
  });

  it('deve tratar espaços, símbolos monetários e &nbsp;', () => {
    expect(parseCurrencyBR('R$ 10.000,00')).toBe(10000);
    expect(parseCurrencyBR(' 8.735,97 ')).toBe(8735.97);
    expect(parseCurrencyBR('10&nbsp;000,00')).toBe(10000);
  });

  it('deve lidar com valores vazios ou inválidos', () => {
    expect(parseCurrencyBR('')).toBe(0);
    expect(parseCurrencyBR(null)).toBe(0);
    expect(parseCurrencyBR(undefined)).toBe(0);
    expect(parseCurrencyBR('texto-invalido')).toBe(0);
  });

  it('deve distinguir entre um ponto como decimal (2 dígitos) vs milhar (3 dígitos)', () => {
    expect(parseCurrencyBR('10.00')).toBe(10); // 2 casas = decimal
    expect(parseCurrencyBR('10.000')).toBe(10000); // 3 casas = milhar
  });
});
