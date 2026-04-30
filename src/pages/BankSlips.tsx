import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  format, isToday, isBefore, startOfDay, addDays, 
  parseISO, differenceInDays, isWithinInterval
} from 'date-fns';
import { 
  FileSpreadsheet, Download, Search, Filter, 
  Plus, CheckCircle2, AlertTriangle, Clock, 
  DollarSign, Calculator, History, MessageSquare,
  Users, Trash2, Edit2, Calendar, List
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface BankSlip {
  id: string;
  dda?: string;
  reminder?: string;
  classification?: string;
  nfe_number?: string;
  client_name: string;
  principal_amount: number;
  due_date: string;
  payment_date?: string;
  interest_amount: number;
  fine_amount: number;
  updated_amount: number;
  reference?: string;
  status: string;
  salesperson_name?: string;
  notes?: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  'A vencer': 'bg-blue-100 text-blue-800 border-blue-200',
  'Vencido': 'bg-red-100 text-red-800 border-red-200',
  'Pago': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Em aberto': 'bg-gray-100 text-gray-800 border-gray-200',
  'Em negociação': 'bg-purple-100 text-purple-800 border-purple-200',
  'Cancelado': 'bg-slate-100 text-slate-800 border-slate-200',
  'Vence hoje': 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function BankSlips() {
  const { user, isFinanceiro, profile } = useAuth();
  const [bankSlips, setBankSlips] = useState<BankSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [activeView, setActiveView] = useState<'list' | 'sellers'>('list');
  
  // Dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<BankSlip | null>(null);
  const [editForm, setEditForm] = useState({
    interest_amount: 0,
    fine_amount: 0,
    notes: '',
    status: '',
    payment_date: ''
  });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_slips' as any)
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Calculate automatic status and amounts
      const today = startOfDay(new Date());
      const updatedData = (data || []).map((slip: any) => {
        let status = slip.status;
        const dueDate = parseISO(slip.due_date);
        
        // Only auto-update if not terminal status
        if (status !== 'Pago' && status !== 'Cancelado' && status !== 'Em negociação') {
          if (isToday(dueDate)) status = 'Vence hoje';
          else if (isBefore(dueDate, today)) status = 'Vencido';
          else status = 'A vencer';
        }

        const interest = parseFloat(slip.interest_amount) || 0;
        const fine = parseFloat(slip.fine_amount) || 0;
        const principal = parseFloat(slip.principal_amount) || 0;
        const updatedAmount = principal + interest + fine;

        return {
          ...slip,
          status,
          principal_amount: principal,
          interest_amount: interest,
          fine_amount: fine,
          updated_amount: updatedAmount
        };
      });

      setBankSlips(updatedData);
    } catch (error: any) {
      toast.error('Erro ao carregar boletos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const total = bankSlips.length;
    const aVencer = bankSlips.filter(s => s.status === 'A vencer' || s.status === 'Vence hoje').reduce((acc, s) => acc + s.updated_amount, 0);
    const pago = bankSlips.filter(s => s.status === 'Pago').reduce((acc, s) => acc + s.updated_amount, 0);
    const vencido = bankSlips.filter(s => s.status === 'Vencido').reduce((acc, s) => acc + s.updated_amount, 0);
    const emAberto = bankSlips.filter(s => s.status !== 'Pago' && s.status !== 'Cancelado').reduce((acc, s) => acc + s.updated_amount, 0);
    const vencendoHojeCount = bankSlips.filter(s => s.status === 'Vence hoje').length;
    const proximos7DiasCount = bankSlips.filter(s => {
      if (s.status === 'Pago' || s.status === 'Cancelado') return false;
      const due = parseISO(s.due_date);
      const in7Days = addDays(startOfDay(new Date()), 7);
      return isWithinInterval(due, { start: startOfDay(new Date()), end: in7Days });
    }).length;

    return { total, aVencer, pago, vencido, emAberto, vencendoHojeCount, proximos7DiasCount };
  }, [bankSlips]);

  const filteredSlips = useMemo(() => {
    return bankSlips.filter(s => {
      const matchesSearch = s.client_name.toLowerCase().includes(search.toLowerCase()) || 
                           s.nfe_number?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
      const matchesSeller = filterSeller === 'all' || s.salesperson_name === filterSeller;
      return matchesSearch && matchesStatus && matchesSeller;
    });
  }, [bankSlips, search, filterStatus, filterSeller]);

  const sellerGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    bankSlips.forEach(s => {
      const seller = s.salesperson_name || 'Sem Vendedor';
      if (!groups[seller]) {
        groups[seller] = {
          name: seller,
          total: 0,
          pago: 0,
          vencido: 0,
          emAberto: 0,
          count: 0
        };
      }
      groups[seller].total += s.updated_amount;
      if (s.status === 'Pago') groups[seller].pago += s.updated_amount;
      else if (s.status === 'Vencido') groups[seller].vencido += s.updated_amount;
      if (s.status !== 'Pago' && s.status !== 'Cancelado') groups[seller].emAberto += s.updated_amount;
      groups[seller].count++;
    });
    return Object.values(groups).sort((a: any, b: any) => b.total - a.total);
  }, [bankSlips]);

  const sellers = useMemo(() => {
    const names = Array.from(new Set(bankSlips.map(s => s.salesperson_name).filter(Boolean)));
    return names.sort();
  }, [bankSlips]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportData(data);
      setIsImportDialogOpen(true);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    setImporting(true);
    try {
      const toInsert = importData.map(row => {
        const principal = parseFloat(row['Principal']?.toString()?.replace(',', '.') || '0');
        const interest = parseFloat(row['Juros']?.toString()?.replace(',', '.') || '0');
        const fine = parseFloat(row['Multa']?.toString()?.replace(',', '.') || '0');
        
        return {
          dda: row['DDA']?.toString(),
          reminder: row['Lembrete']?.toString(),
          classification: row['Classificação']?.toString(),
          nfe_number: row['NF-e']?.toString(),
          client_name: row['Cliente']?.toString() || 'Cliente não informado',
          principal_amount: principal,
          interest_amount: interest,
          fine_amount: fine,
          due_date: row['Vencimento'] ? format(new Date(row['Vencimento']), 'yyyy-MM-dd') : null,
          payment_date: row['Data Pagamento'] ? format(new Date(row['Data Pagamento']), 'yyyy-MM-dd') : null,
          status: row['Pago'] ? 'Pago' : (row['Vencido'] ? 'Vencido' : 'Em aberto'),
          salesperson_name: row['Vendedor']?.toString(),
          reference: row['Referência']?.toString(),
          created_by: user?.id,
        };
      }).filter(item => item.due_date && item.client_name);

      const { error } = await supabase
        .from('bank_slips' as any)
        .upsert(toInsert, { 
          onConflict: 'nfe_number, client_name, due_date, principal_amount',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      
      toast.success('Importação concluída com sucesso!');
      setIsImportDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEdit = (slip: BankSlip) => {
    setSelectedSlip(slip);
    setEditForm({
      interest_amount: slip.interest_amount,
      fine_amount: slip.fine_amount,
      notes: slip.notes || '',
      status: slip.status,
      payment_date: slip.payment_date || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSlip) return;
    try {
      const { error } = await supabase
        .from('bank_slips' as any)
        .update({
          interest_amount: editForm.interest_amount,
          fine_amount: editForm.fine_amount,
          notes: editForm.notes,
          status: editForm.status,
          payment_date: editForm.payment_date || null
        })
        .eq('id', selectedSlip.id);

      if (error) throw error;

      await supabase.from('bank_slip_history' as any).insert({
        bank_slip_id: selectedSlip.id,
        action: 'Edição de Dados',
        prev_status: selectedSlip.status,
        new_status: editForm.status,
        notes: `Juros: ${editForm.interest_amount}, Multa: ${editForm.fine_amount}`,
        performed_by: user?.id
      });

      toast.success('Dados atualizados!');
      setIsEditModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleStatusChange = async (slip: BankSlip, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'Pago' && !slip.payment_date) {
        updateData.payment_date = format(new Date(), 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('bank_slips' as any)
        .update(updateData)
        .eq('id', slip.id);

      if (error) throw error;

      // Log history
      await supabase.from('bank_slip_history' as any).insert({
        bank_slip_id: slip.id,
        action: 'Alteração de Status',
        prev_status: slip.status,
        new_status: newStatus,
        performed_by: user?.id
      });

      toast.success('Status atualizado!');
      loadData();
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const openHistory = async (slip: BankSlip) => {
    setSelectedSlip(slip);
    try {
      const { data, error } = await supabase
        .from('bank_slip_history' as any)
        .select('*, performed_by_name:profiles(full_name)')
        .eq('bank_slip_id', slip.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
      setIsHistoryModalOpen(true);
    } catch (error: any) {
      toast.error('Erro ao carregar histórico');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">Controle de Boletos</h1>
            <p className="text-gray-500">Gerenciamento operacional de boletos e vencimentos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => document.getElementById('excel-upload')?.click()}>
              <FileSpreadsheet className="h-4 w-4" /> Importar Excel
            </Button>
            <input 
              type="file" 
              id="excel-upload" 
              className="hidden" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload}
            />
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> Novo Boleto
            </Button>
          </div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total a Vencer</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.aVencer)}</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Pago</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.pago)}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Vencido</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.vencido)}</p>
                </div>
                <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Vencendo Hoje</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.vencendoHojeCount}</p>
                  <p className="text-xs text-gray-400 mt-1">{stats.proximos7DiasCount} nos próximos 7 dias</p>
                </div>
                <div className="h-12 w-12 bg-orange-50 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col md:flex-row gap-4">
          <Card className="flex-1">
            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Buscar por cliente ou NF-e..." 
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="A vencer">A vencer</SelectItem>
                    <SelectItem value="Vence hoje">Vence hoje</SelectItem>
                    <SelectItem value="Vencido">Vencido</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Em negociação">Em negociação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <Select value={filterSeller} onValueChange={setFilterSeller}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Vendedores</SelectItem>
                    {sellers.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            <Button 
              variant={activeView === 'list' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setActiveView('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" /> Lista
            </Button>
            <Button 
              variant={activeView === 'sellers' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setActiveView('sellers')}
              className="gap-2"
            >
              <Users className="h-4 w-4" /> Vendedores
            </Button>
          </div>
        </div>

        {/* Main Content */}
        {activeView === 'list' ? (
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[200px]">Cliente</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Valor Principal</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Valor Atualizado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredSlips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-gray-500">Nenhum boleto encontrado.</TableCell>
                    </TableRow>
                  ) : (
                    filteredSlips.map((slip) => (
                      <TableRow key={slip.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                        <TableCell className="font-medium">{slip.client_name}</TableCell>
                        <TableCell>{slip.nfe_number || '-'}</TableCell>
                        <TableCell>{formatCurrency(slip.principal_amount)}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            slip.status === 'Vencido' ? "bg-red-50 text-red-700" : 
                            slip.status === 'Vence hoje' ? "bg-orange-50 text-orange-700" : ""
                          )}>
                            {format(parseISO(slip.due_date), 'dd/MM/yyyy')}
                          </span>
                        </TableCell>
                        <TableCell>{slip.payment_date ? format(parseISO(slip.payment_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-semibold text-gray-900">{formatCurrency(slip.updated_amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-medium", statusColors[slip.status])}>
                            {slip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">{slip.salesperson_name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {slip.status !== 'Pago' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleStatusChange(slip, 'Pago')}
                                title="Marcar como Pago"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleOpenEdit(slip)}
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                              onClick={() => openHistory(slip)}
                              title="Ver Histórico"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellerGroups.map((group) => (
              <Card key={group.name} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex justify-between items-center">
                    {group.name}
                    <Badge variant="secondary">{group.count} boletos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Total Emitido</p>
                      <p className="text-sm font-bold">{formatCurrency(group.total)}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600 uppercase font-semibold">Total Pago</p>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(group.pago)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600 uppercase font-semibold">Total Vencido</p>
                      <p className="text-sm font-bold text-red-700">{formatCurrency(group.vencido)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 uppercase font-semibold">Em Aberto</p>
                      <p className="text-sm font-bold text-blue-700">{formatCurrency(group.emAberto)}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full text-xs" onClick={() => {
                    setFilterSeller(group.name);
                    setActiveView('list');
                  }}>
                    Ver Boletos do Vendedor
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Boleto - {selectedSlip?.client_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Juros (R$)</Label>
                <Input 
                  type="number" 
                  value={editForm.interest_amount} 
                  onChange={(e) => setEditForm({ ...editForm, interest_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Multa (R$)</Label>
                <Input 
                  type="number" 
                  value={editForm.fine_amount} 
                  onChange={(e) => setEditForm({ ...editForm, fine_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em aberto">Em aberto</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                  <SelectItem value="Em negociação">Em negociação</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.status === 'Pago' && (
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input 
                  type="date" 
                  value={editForm.payment_date} 
                  onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                placeholder="Adicione uma nota..." 
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Revisar Importação</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto my-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Vendedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importData.slice(0, 10).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row['NF-e']}</TableCell>
                    <TableCell>{row['Cliente']}</TableCell>
                    <TableCell>{row['Principal']}</TableCell>
                    <TableCell>{row['Vencimento'] ? format(new Date(row['Vencimento']), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell>{row['Vendedor']}</TableCell>
                  </TableRow>
                ))}
                {importData.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                      + {importData.length - 10} outros registros...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={processImport} disabled={importing} className="bg-emerald-600 hover:bg-emerald-700">
              {importing ? 'Importando...' : `Confirmar Importação (${importData.length} registros)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico do Boleto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            {history.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma alteração registrada.</p>
            ) : (
              <div className="space-y-4">
                {history.map((item, idx) => (
                  <div key={idx} className="flex gap-3 border-l-2 border-emerald-500 pl-4 py-1">
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm text-gray-900">{item.action}</p>
                        <span className="text-[10px] text-gray-400">{format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.prev_status} → {item.new_status}
                      </p>
                      {item.performed_by_name && (
                        <p className="text-[10px] text-gray-400 mt-1">Por: {item.performed_by_name?.full_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}