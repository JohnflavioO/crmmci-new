import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Package, AlertTriangle, Boxes, Lock, BookmarkCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SaldoInfo {
  Quantidade: number;
  PesoBruto: number;
  PesoLiquido: number;
  Valor: number;
  Volume: number;
}

interface EstoqueItem {
  Filial: string;
  Cliente: string;
  Produto: string;
  UnidadeMedida: string;
  NumeroOrdem: number;
  NumeroPedido: string;
  NaturezaOperacao: string;
  ClienteFaturamento: string;
  Deposito: string;
  Endereco: string;
  Unitizacao: number;
  Volume: number;
  ClassificacaoEstoque: string;
  NumeroOcorrencia: number;
  NumeroDocumento: number;
  NumeroDescarga: number;
  Lote: string;
  Fabricacao: string;
  Validade: string;
  Conteiner: string;
  SaldoDisponivel: SaldoInfo;
  SaldoReservado: SaldoInfo;
  SaldoBloqueado: SaldoInfo;
  SaldoAtual: SaldoInfo;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('/');
  if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function formatNum(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function EstoqueSC() {
  const [items, setItems] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filialFilter, setFilialFilter] = useState('all');
  const [depositoFilter, setDepositoFilter] = useState('all');

  const fetchEstoque = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('estoque-sc');
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setItems(data.items ?? []);
      setLastUpdated(data.timestamp ?? new Date().toISOString());
      // Log debug info to console for diagnostics
      if (data?.debug) {
        console.log('[EstoqueSC] Debug:', data.debug);
      }
      const count = data.items?.length ?? 0;
      if (count === 0) {
        toast({ 
          title: 'Estoque consultado', 
          description: 'A API retornou 0 itens. O armazém pode estar sem estoque para este CNPJ.',
        });
      } else {
        toast({ title: 'Estoque atualizado', description: `${count} itens carregados.` });
      }
    } catch (err: any) {
      const msg = err?.message || 'Erro ao consultar estoque';
      setError(msg);
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstoque();
  }, [fetchEstoque]);

  // Unique values for filters
  const filiais = useMemo(() => [...new Set(items.map(i => i.Filial).filter(Boolean))].sort(), [items]);
  const depositos = useMemo(() => [...new Set(items.map(i => i.Deposito).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => {
      if (filialFilter !== 'all' && i.Filial !== filialFilter) return false;
      if (depositoFilter !== 'all' && i.Deposito !== depositoFilter) return false;
      if (q) {
        const text = `${i.Produto} ${i.Cliente} ${i.Lote} ${i.Conteiner} ${i.Endereco}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filialFilter, depositoFilter]);

  // Summary cards
  const summary = useMemo(() => {
    const s = { total: filtered.length, disponivel: 0, reservado: 0, bloqueado: 0, atual: 0 };
    for (const i of filtered) {
      s.disponivel += i.SaldoDisponivel?.Quantidade ?? 0;
      s.reservado += i.SaldoReservado?.Quantidade ?? 0;
      s.bloqueado += i.SaldoBloqueado?.Quantidade ?? 0;
      s.atual += i.SaldoAtual?.Quantidade ?? 0;
    }
    return s;
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Estoque SC</h1>
            <p className="text-sm text-muted-foreground">Consulta em tempo real do estoque do armazém Sanco</p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <Button onClick={fetchEstoque} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar estoque
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Falha ao carregar estoque</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" /> Total de Itens
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatNum(summary.total)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BookmarkCheck className="h-3.5 w-3.5 text-green-500" /> Disponível
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{formatNum(summary.disponivel)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-yellow-500" /> Reservado
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-yellow-600">{formatNum(summary.reservado)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-red-500" /> Bloqueado
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-600">{formatNum(summary.bloqueado)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-blue-500" /> Saldo Atual
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-blue-600">{formatNum(summary.atual)}</p></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, cliente, lote, contêiner..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filialFilter} onValueChange={setFilialFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filial" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas filiais</SelectItem>
              {filiais.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={depositoFilter} onValueChange={setDepositoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Depósito" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos depósitos</SelectItem>
              {depositos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Fabricação</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Contêiner</TableHead>
                    <TableHead>UM</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Bloqueado</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Peso Bruto</TableHead>
                    <TableHead className="text-right">Peso Líq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Carregando estoque...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                        {items.length === 0 ? 'Nenhum item no estoque.' : 'Nenhum resultado para os filtros selecionados.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium max-w-[200px] truncate" title={item.Produto}>{item.Produto || '—'}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={item.Cliente}>{item.Cliente || '—'}</TableCell>
                        <TableCell>{item.Filial || '—'}</TableCell>
                        <TableCell>{item.Deposito || '—'}</TableCell>
                        <TableCell>{item.Endereco || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{item.Lote || '—'}</Badge></TableCell>
                        <TableCell>{formatDate(item.Fabricacao)}</TableCell>
                        <TableCell>{formatDate(item.Validade)}</TableCell>
                        <TableCell>{item.Conteiner || '—'}</TableCell>
                        <TableCell>{item.UnidadeMedida || '—'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatNum(item.SaldoDisponivel?.Quantidade)}</TableCell>
                        <TableCell className="text-right text-yellow-600">{formatNum(item.SaldoReservado?.Quantidade)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatNum(item.SaldoBloqueado?.Quantidade)}</TableCell>
                        <TableCell className="text-right font-bold">{formatNum(item.SaldoAtual?.Quantidade)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNum(item.SaldoAtual?.PesoBruto)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNum(item.SaldoAtual?.PesoLiquido)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
