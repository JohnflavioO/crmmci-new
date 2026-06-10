import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import AppLayout from '@/components/AppLayout';
import QuoteHeader from '@/components/QuoteHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, FileText, X, Download, MessageCircle, CreditCard, QrCode, FileBarChart, CheckCircle2, Clock, CircleDot, Copy, Loader2, Link2, Gift, Store, CalendarIcon, SplitSquareVertical, ShoppingBag } from 'lucide-react';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import QuoteChat from '@/components/QuoteChat';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ActionMenu } from '@/components/ActionMenu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const db = supabase as any;

// Helper seguro para validar e formatar datas
const safeFormatDate = (value: any, formatStr: string = 'dd/MM/yyyy') => {
  if (!value) return '';
  // Se já for uma string no formato yyyy-MM-dd, adicionamos o T12:00:00 para evitar problemas de fuso
  const dateStr = typeof value === 'string' && value.includes('-') && !value.includes('T') 
    ? `${value}T12:00:00` 
    : value;
    
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.warn('[Quotes] Data inválida detectada:', value);
    return '';
  }
  return format(date, formatStr, { locale: ptBR });
};

const safeDateValue = (value: any) => {
  if (!value) return '';
  const date = new Date(value.includes('-') && !value.includes('T') ? `${value}T12:00:00` : value);
  if (isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', pre_venda: 'Pré-venda', contato_feito: 'Contato Feito',
  sent: 'Proposta Enviada', negociacao: 'Negociação', approved: 'Aprovado', rejected: 'Rejeitado',
};

const paymentMethodLabels: Record<string, { label: string; icon: any }> = {
  pix: { label: 'PIX', icon: QrCode },
  cartao: { label: 'Cartão', icon: CreditCard },
  boleto: { label: 'Boleto', icon: FileBarChart },
};

const paymentStatusLabels: Record<string, { label: string; icon: any; className: string }> = {
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  em_andamento: { label: 'Em andamento', icon: CircleDot, className: 'bg-blue-100 text-blue-800 border-blue-200' },
  liquidado: { label: 'Liquidado', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const installmentOptions = Array.from({ length: 24 }, (_, i) => i + 1);

interface QuoteItem {
  id?: string;
  item_number: number;
  product_code: string;
  quantity: number | string;
  model: string;
  brand: string;
  specifications: string;
  unit_price: number | string;
  discount_percent: number | string;
  unit_total: number;
  line_total: number;
  image_url: string;
  is_gift: boolean;
  description_layout?: 'compact' | 'expanded';
}

const emptyItem = (): QuoteItem => ({
  item_number: 1, product_code: '', quantity: 1, model: '', brand: '',
  specifications: '', unit_price: 0, discount_percent: 0, unit_total: 0, line_total: 0, image_url: '', is_gift: false,
  description_layout: 'compact',
});

const shippingMethods = [
  { value: 'correios', label: 'Correios' },
  { value: 'mao_propria', label: 'Mão Própria' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'transportadora', label: 'Transportadora' },
];

const defaultForm = {
  client_id: '', salesperson: '', status: 'draft', notes: '',
  payment_terms: '', shipping_deadline: '', shipping_method: '',
  shipping_cost: 0 as number | string, proposal_validity: '15 dias',
  payment_method: '', payment_status: 'pendente',
  is_reseller: false,
  payment_date: '' as string,
  installments: 1,
  is_split_payment: false,
  split_method_1: '',
  split_value_1: 0 as number | string,
  split_date_1: '' as string,
  split_installments_1: 1,
  split_method_2: '',
  split_value_2: 0 as number | string,
  split_date_2: '' as string,
  split_installments_2: 1,
  manual_total: 0 as number | string,
  use_alt_shipping_address: false,
  shipping_recipient: '',
  shipping_cep: '',
  shipping_address: '',
  shipping_address_number: '',
  shipping_complement: '',
  shipping_neighborhood: '',
  shipping_city: '',
  shipping_state: '',
  shipping_phone: '',
  shipping_notes: '',
  followup_date: '' as string,
};

const QUICK_ENTRY_STATUSES = ['contato_feito', 'sent', 'negociacao'];

function PaymentMethodFields({ method, date, onDateChange, installments, onInstallmentsChange, label }: {
  method: string;
  date: string;
  onDateChange: (v: string) => void;
  installments: number;
  onInstallmentsChange: (v: number) => void;
  label?: string;
}) {
  if (method === 'pix') {
    const displayDate = date ? safeFormatDate(date) : 'Selecionar data';
    const selectedDate = date ? new Date(date + 'T12:00:00') : undefined;

    return (
      <div className="space-y-2">
        <Label className="text-xs">{label || 'Data do Pagamento'}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {displayDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : undefined}
              onSelect={(d) => onDateChange(d ? format(d, 'yyyy-MM-dd') : '')}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
  if (method === 'boleto' || method === 'cartao') {
    return (
      <div className="space-y-2">
        <Label className="text-xs">Parcelas</Label>
        <Select value={String(installments)} onValueChange={v => onInstallmentsChange(parseInt(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {installmentOptions.map(n => (
              <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return null;
}

export default function Quotes() {
  const { user, profile, isGestor, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('me');
  const [sellerProfiles, setSellerProfiles] = useState<{ user_id: string; full_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSavingFlag] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);
  const [chatQuote, setChatQuote] = useState<{ id: string; number: string } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const handleShippingCepChange = async (value: string) => {
    const cleanCep = value.replace(/\D/g, '');
    setForm(p => ({ ...p, shipping_cep: value }));
    
    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (!res.ok) throw new Error('Falha na resposta da API');
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            shipping_address: data.logradouro || prev.shipping_address,
            shipping_neighborhood: data.bairro || prev.shipping_neighborhood,
            shipping_city: data.localidade || prev.shipping_city,
            shipping_state: data.uf || prev.shipping_state,
          }));
          toast.success('Endereço de entrega preenchido!');
        }
      } catch (err) {
        console.error('CEP lookup error:', err);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleFollowupDateChange = (date: Date | undefined) => {
    setForm(prev => ({ ...prev, followup_date: date ? format(date, 'yyyy-MM-dd') : '' }));
  };

  const loadData = useCallback(async () => {
    try {
      if (!user?.id) {
        setQuotes([]);
        setClients([]);
        setSalespeople([]);
        setProducts([]);
        setSellerProfiles([]);
        return;
      }

      // SEGURANÇA: Admins e Gestores podem ver tudo via RLS, mas na interface 
      // aplicamos o filtro de responsável para evitar confusão.
      // Por padrão, mostramos apenas os orçamentos do usuário atual.
      let quotesQuery = db.from('quotes')
        .select('*, clients(company_name, name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      
      const params = new URLSearchParams(window.location.search);
      const statusFilter = params.get('status');
      
      if (isGestor) {
        if (responsibleFilter === 'me') {
          quotesQuery = quotesQuery.eq('created_by', user.id);
        } else if (responsibleFilter !== 'all') {
          quotesQuery = quotesQuery.eq('created_by', responsibleFilter);
        }
      } else {
        quotesQuery = quotesQuery.eq('created_by', user.id);
      }

      if (statusFilter === 'approved') {
        quotesQuery = quotesQuery.eq('status', 'approved');
      } else if (statusFilter === 'pending') {
        quotesQuery = quotesQuery.in('status', ['draft', 'sent', 'pre_venda', 'pre_sale', 'contato_feito', 'contact_made', 'negociacao', 'negotiation']);
      } else if (statusFilter === 'rejected') {
        quotesQuery = quotesQuery.eq('status', 'rejected');
      }

      const [q, c, s, p] = await Promise.all([
        quotesQuery,
        db.from('clients').select('id, company_name, name, is_revenda, contrib_icms').eq('created_by', user.id).order('company_name'),
        db.from('salespeople').select('*').eq('active', true).order('name'),
        db.from('products').select('id, name, brand, code, price, description, image_url').order('name'),
      ]);
      setQuotes(q.data || []);
      setClients(c.data || []);
      setSalespeople(s.data || []);
      setProducts(p.data || []);

      if (isGestor) {
        // Obter perfis comerciais ativos para o filtro
        const { data: profiles } = await db.from('profiles')
          .select('user_id, full_name, role, commercial_visible')
          .eq('active', true);
        
        const filteredProfiles = (profiles || []).filter((p: any) => {
          const role = (p.role || '').toLowerCase();
          // Admin aparece se commercial_visible for true ou se tiver role admin (conforme regra)
          // Mas regra diz: "Admin deve aparecer se também atuar como vendedor" -> commercial_visible serve pra isso
          const isCommercial = ['vendedor', 'comercial', 'gestor', 'admin'].includes(role);
          const isHidden = ['financeiro', 'logistica'].includes(role);
          return p.full_name && isCommercial && !isHidden;
        });
        setSellerProfiles(filteredProfiles);
      }
    } catch (err) {
      console.error('loadData error:', err);
    }
  }, [isAdmin, isGestor, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const calcItem = (item: QuoteItem): QuoteItem => {
    if (item.is_gift) {
      return { ...item, unit_total: 0, line_total: 0 };
    }
    const unitPrice = parseFloat(String(item.unit_price)) || 0;
    const discountPercent = parseFloat(String(item.discount_percent)) || 0;
    const quantity = parseFloat(String(item.quantity)) || 0;

    const unitTotal = unitPrice * (1 - discountPercent / 100);
    const lineTotal = unitTotal * quantity;
    return { ...item, unit_total: Math.round(unitTotal * 100) / 100, line_total: Math.round(lineTotal * 100) / 100 };
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = calcItem({ ...updated[index], [field]: value });
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const selectProduct = (idx: number, product: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = calcItem({
        ...updated[idx],
        model: product.name,
        brand: product.brand || '',
        product_code: product.code || '',
        specifications: product.description || '',
        unit_price: parseFloat(product.price) || 0,
        image_url: product.image_url || '',
      });
      return updated;
    });
    setProductSearch(prev => ({ ...prev, [idx]: '' }));
    setShowProductDropdown(null);
  };

  const filteredProductsBySearch = useMemo(() => {
    const searchMap: Record<number, any[]> = {};
    Object.keys(productSearch).forEach(idxStr => {
      const idx = parseInt(idxStr);
      const q = (productSearch[idx] || '').toLowerCase().trim();
      if (!q) {
        searchMap[idx] = [];
        return;
      }
      searchMap[idx] = products.filter((p: any) =>
        (p.name?.toLowerCase().includes(q) || 
         p.brand?.toLowerCase().includes(q) || 
         p.code?.toLowerCase().includes(q) ||
         p.description?.toLowerCase().includes(q))
      ).slice(0, 8);
    });
    return searchMap;
  }, [products, productSearch]);

  const getFilteredProducts = (idx: number) => {
    return filteredProductsBySearch[idx] || [];
  };

  const hasItems = items.some(i => !!i.model);
  
  const totalAmount = hasItems 
    ? items.reduce((sum, item) => sum + (parseFloat(String(item.line_total)) || 0), 0) 
    : (parseFloat(String(form.manual_total)) || 0);
  const grandTotal = totalAmount + (parseFloat(String(form.shipping_cost)) || 0);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Validate payment fields for approval
  const validatePaymentForApproval = (): string | null => {
    if (!form.payment_method && !form.is_split_payment) {
      return 'Selecione o método de pagamento.';
    }

    if (form.is_split_payment) {
      if (!form.split_method_1) return 'Selecione o método 1 do pagamento misto.';
      if (!form.split_method_2) return 'Selecione o método 2 do pagamento misto.';
      if (Number(form.split_value_1) <= 0) return 'Informe o valor do método 1.';
      if (Number(form.split_value_2) <= 0) return 'Informe o valor do método 2.';

      const sumSplit = Number(form.split_value_1) + Number(form.split_value_2);
      if (Math.abs(sumSplit - grandTotal) > 0.01) {
        return `A soma dos valores do pagamento misto (${formatCurrency(sumSplit)}) não corresponde ao total do orçamento (${formatCurrency(grandTotal)}).`;
      }

      if (form.split_method_1 === 'pix' && !form.split_date_1) return 'Informe a data do pagamento PIX (método 1).';
      if (form.split_method_2 === 'pix' && !form.split_date_2) return 'Informe a data do pagamento PIX (método 2).';
    } else {
      if (form.payment_method === 'pix' && !form.payment_date) {
        return 'Informe a data do pagamento PIX.';
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (saving) {
      console.log('[Quotes.handleSave] Blocked: already saving');
      return;
    }

    const watchdog = setTimeout(() => {
      console.warn('[Quotes.handleSave] Watchdog fired — forcing saving=false (network likely stalled)');
      setSavingFlag(false);
      toast.error('Tempo excedido ao salvar.', {
        description: 'A operação demorou mais que o esperado. Verifique sua conexão e tente novamente.',
      });
    }, 15000); // Reduzido para 15s para ser mais responsivo em falhas de rede

    try {
      // ---- Validações de pré-requisito (sempre com toast) ----
      if (!form.client_id) {
        toast.error('Selecione um cliente');
        return;
      }

      const selectedClient = clients.find((c: any) => c.id === form.client_id);

      // Validate reseller IE
      if (form.is_reseller) {
        const ie = selectedClient?.contrib_icms?.replace(/[.\-/\s]/g, '') || '';
        if (!ie || ie.length < 8 || ie.length > 14) {
          toast.error('Clientes do tipo revenda precisam ter Inscrição Estadual válida cadastrada antes de continuar.', {
            description: 'Edite o cadastro do cliente e preencha a Inscrição Estadual.',
          });
          return;
        }
      }

      const hasAnyItem = items.some(i => !!i.model);
      const canQuickEntry = Number(form.manual_total) > 0 && QUICK_ENTRY_STATUSES.includes(form.status);
      if (!hasAnyItem && !canQuickEntry) {
        toast.error('Adicione pelo menos um item ou informe o valor total da negociação (para status Contato Feito, Proposta Enviada ou Negociação)');
        return;
      }

      // Validate payment if approving
      if (form.status === 'approved') {
        const paymentError = validatePaymentForApproval();
        if (paymentError) {
          toast.error('Para aprovar este orçamento, preencha corretamente os dados de pagamento.', { description: paymentError });
          return;
        }
      }

      setSavingFlag(true);

      let quoteId: string;
      const matchedSeller = salespeople.find((s: any) => s.name === form.salesperson);

      const quoteData: any = {
        client_id: form.client_id, salesperson: form.salesperson, status: form.status,
        salesperson_id: matchedSeller?.id || user?.id || null,
        notes: form.notes, total_amount: grandTotal,
        payment_terms: form.payment_terms, shipping_deadline: form.shipping_deadline,
        shipping_method: form.shipping_method, shipping_cost: Number(form.shipping_cost) || 0,
        proposal_validity: form.proposal_validity,
        followup_date: form.followup_date || null,
        payment_method: form.is_split_payment ? null : (form.payment_method || null),
        payment_status: form.payment_status,
        is_reseller: form.is_reseller,
        payment_date: (!form.is_split_payment && form.payment_method === 'pix' && form.payment_date) ? form.payment_date : null,
        installments: (!form.is_split_payment && (form.payment_method === 'boleto' || form.payment_method === 'cartao')) ? form.installments : 1,
        is_split_payment: form.is_split_payment,
        split_method_1: form.is_split_payment ? (form.split_method_1 || null) : null,
        split_value_1: form.is_split_payment ? (Number(form.split_value_1) || 0) : 0,
        split_date_1: form.is_split_payment && form.split_method_1 === 'pix' && form.split_date_1 ? form.split_date_1 : null,
        split_installments_1: form.is_split_payment && (form.split_method_1 === 'boleto' || form.split_method_1 === 'cartao') ? form.split_installments_1 : 1,
        split_method_2: form.is_split_payment ? (form.split_method_2 || null) : null,
        split_value_2: form.is_split_payment ? (Number(form.split_value_2) || 0) : 0,
        split_date_2: form.is_split_payment && form.split_method_2 === 'pix' && form.split_date_2 ? form.split_date_2 : null,
        split_installments_2: form.is_split_payment && (form.split_method_2 === 'boleto' || form.split_method_2 === 'cartao') ? form.split_installments_2 : 1,
        use_alt_shipping_address: form.use_alt_shipping_address,
        shipping_recipient: form.use_alt_shipping_address ? (form.shipping_recipient || null) : null,
        shipping_cep: form.use_alt_shipping_address ? (form.shipping_cep || null) : null,
        shipping_address: form.use_alt_shipping_address ? (form.shipping_address || null) : null,
        shipping_address_number: form.use_alt_shipping_address ? (form.shipping_address_number || null) : null,
        shipping_complement: form.use_alt_shipping_address ? (form.shipping_complement || null) : null,
        shipping_neighborhood: form.use_alt_shipping_address ? (form.shipping_neighborhood || null) : null,
        shipping_city: form.use_alt_shipping_address ? (form.shipping_city || null) : null,
        shipping_state: form.use_alt_shipping_address ? (form.shipping_state || null) : null,
        shipping_phone: form.use_alt_shipping_address ? (form.shipping_phone || null) : null,
        shipping_notes: form.use_alt_shipping_address ? (form.shipping_notes || null) : null,
      };

      // Garantir que campos de data nulos ou vazios sejam salvos como null e não strings inválidas
      ['followup_date', 'payment_date', 'split_date_1', 'split_date_2'].forEach(key => {
        if (quoteData[key] === '' || quoteData[key] === undefined) {
          quoteData[key] = null;
        }
      });

      console.log('[Quotes.handleSave] Payload:', { editing: !!editingQuote, quoteData, itemsCount: items.filter(i => i.model).length });

      if (editingQuote) {
        const { error } = await db.from('quotes').update(quoteData).eq('id', editingQuote.id);
        if (error) {
          console.error('[Quotes.handleSave] Update error:', error);
          throw error;
        }
        quoteId = editingQuote.id;
        const { error: delErr } = await db.from('quote_items').delete().eq('quote_id', quoteId);
        if (delErr) console.warn('[Quotes.handleSave] delete items warning:', delErr);
      } else {
        const { data: numData, error: numErr } = await db.rpc('generate_quote_number');
        if (numErr) console.warn('[Quotes.handleSave] generate_quote_number warning:', numErr);
        const { data, error } = await db.from('quotes').insert({
          ...quoteData,
          quote_number: numData || `ORC-${Date.now()}`,
          created_by: user?.id,
          quote_date: format(new Date(), 'yyyy-MM-dd'),
        }).select('id').single();
        if (error) {
          console.error('[Quotes.handleSave] Insert error:', error);
          throw error;
        }
        quoteId = data.id;
      }

      const validItems = items.filter(i => i.model).map((item, idx) => ({
        quote_id: quoteId, item_number: idx + 1, product_code: item.product_code,
        quantity: Number(item.quantity) || 1, model: item.model, brand: item.brand,
        specifications: item.specifications, unit_price: Number(item.unit_price) || 0,
        discount_percent: Number(item.discount_percent) || 0, unit_total: item.unit_total,
        line_total: item.line_total, image_url: item.image_url, is_gift: item.is_gift,
        description_layout: item.description_layout || 'compact',
      }));

      if (validItems.length > 0) {
        const { error } = await db.from('quote_items').insert(validItems);
        if (error) {
          console.error('[Quotes.handleSave] Insert items error:', error);
          throw error;
        }
      }

      toast.success(editingQuote ? 'Orçamento atualizado!' : 'Orçamento criado!');
      setDialogOpen(false);
      resetForm();
      // Delay reload slightly to allow DB consistency
      setTimeout(() => loadData(), 500);
    } catch (err: any) {
      console.error('[Quotes.handleSave] Unhandled error:', err);
      const msg = err?.message || err?.error_description || err?.hint || 'Erro inesperado ao salvar o orçamento.';
      const code = err?.code ? ` (código: ${err.code})` : '';
      toast.error('Não foi possível salvar o orçamento.', {
        description: msg + code,
      });
    } finally {
      clearTimeout(watchdog);
      setSavingFlag(false);
    }
  };

  const handleEdit = async (quote: any) => {
    try {
      console.log('[Quotes.handleEdit] Iniciando carregamento do orçamento:', { 
        id: quote.id, 
        number: quote.quote_number,
        timestamp: new Date().toISOString() 
      });
      
      const { data: qItems, error: itemsError } = await db.from('quote_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('item_number');
      
      if (itemsError) {
        console.error('[Quotes.handleEdit] Erro detalhado ao buscar itens:', {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint
        });
        toast.error('Erro ao carregar itens do banco de dados', {
          description: `Causa: ${itemsError.message} (Código: ${itemsError.code})`
        });
      }

      // Log dos campos de data recebidos para depuração
      console.log('[Quotes.handleEdit] Payload recebido para edição:', {
        id: quote.id,
        quote_date: quote.quote_date,
        payment_date: quote.payment_date,
        split_date_1: quote.split_date_1,
        split_date_2: quote.split_date_2,
        followup_date: quote.followup_date,
        created_at: quote.created_at
      });

      // Preparação dos dados do formulário com validação de tipos e datas seguras
      const formData = {
        client_id: quote.client_id || '', 
        salesperson: quote.salesperson || '',
        status: quote.status, 
        notes: quote.notes || '',
        payment_terms: quote.payment_terms || '', 
        shipping_deadline: quote.shipping_deadline || '',
        shipping_method: quote.shipping_method || '',
        shipping_cost: parseFloat(quote.shipping_cost) || 0,
        proposal_validity: quote.proposal_validity || '15 dias',
        payment_method: quote.payment_method || '', 
        payment_status: quote.payment_status || 'pendente',
        is_reseller: quote.is_reseller || false,
        payment_date: quote.payment_date || '',
        installments: quote.installments || 1,
        is_split_payment: quote.is_split_payment || false,
        split_method_1: quote.split_method_1 || '',
        split_value_1: parseFloat(quote.split_value_1) || 0,
        split_date_1: quote.split_date_1 || '',
        split_installments_1: quote.split_installments_1 || 1,
        split_method_2: quote.split_method_2 || '',
        split_value_2: parseFloat(quote.split_value_2) || 0,
        split_date_2: quote.split_date_2 || '',
        split_installments_2: quote.split_installments_2 || 1,
        manual_total: (!qItems || qItems.length === 0) ? (parseFloat(quote.total_amount) || 0) : 0,
        use_alt_shipping_address: quote.use_alt_shipping_address || false,
        shipping_recipient: quote.shipping_recipient || '',
        shipping_cep: quote.shipping_cep || '',
        shipping_address: quote.shipping_address || '',
        shipping_address_number: quote.shipping_address_number || '',
        shipping_complement: quote.shipping_complement || '',
        shipping_neighborhood: quote.shipping_neighborhood || '',
        shipping_city: quote.shipping_city || '',
        shipping_state: quote.shipping_state || '',
        shipping_phone: quote.shipping_phone || '',
        shipping_notes: quote.shipping_notes || '',
        followup_date: safeDateValue(quote.followup_date),
      };

      console.log('[Quotes.handleEdit] Sucesso no processamento dos dados:', {
        itemsCount: qItems?.length || 0,
        quoteId: quote.id,
        parsedFollowup: formData.followup_date
      });

      setEditingQuote(quote);
      setItems(qItems && qItems.length > 0 ? qItems : [emptyItem()]);
      setForm(formData);
      setDialogOpen(true);
      
    } catch (err: any) {
      console.error('[Quotes.handleEdit] Erro crítico não tratado:', err);
      toast.error('Não foi possível abrir o editor', {
        description: `Erro: ${err.message || 'Falha na renderização dos dados do orçamento'}`
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    const { error } = await db.rpc('delete_quote_cascade', { p_quote_id: id });
    if (error) toast.error(error.message);
    else { toast.success('Orçamento excluído'); loadData(); }
  };

  const handleDuplicate = async (quote: any) => {
    try {
      const { data: qItems } = await db.from('quote_items').select('*').eq('quote_id', quote.id).order('item_number');
      const { data: numData } = await db.rpc('generate_quote_number');
      const { data: newQuote, error } = await db.from('quotes').insert({
        client_id: quote.client_id, client_name: quote.client_name,
        salesperson: quote.salesperson, salesperson_id: quote.salesperson_id,
        status: 'draft', notes: quote.notes,
        payment_terms: quote.payment_terms, shipping_deadline: quote.shipping_deadline,
        shipping_method: quote.shipping_method, shipping_cost: quote.shipping_cost,
        proposal_validity: quote.proposal_validity, payment_method: quote.payment_method,
        payment_status: 'pendente', total_amount: quote.total_amount, total: quote.total,
        discount: quote.discount, quote_number: numData || `ORC-${Date.now()}`,
        created_by: user?.id, is_reseller: quote.is_reseller || false,
        payment_date: quote.payment_date || null,
        installments: quote.installments || 1,
        is_split_payment: quote.is_split_payment || false,
        split_method_1: quote.split_method_1 || null,
        split_value_1: quote.split_value_1 || 0,
        split_date_1: quote.split_date_1 || null,
        split_installments_1: quote.split_installments_1 || 1,
        split_method_2: quote.split_method_2 || null,
        split_value_2: quote.split_value_2 || 0,
        split_date_2: quote.split_date_2 || null,
        split_installments_2: quote.split_installments_2 || 1,
      }).select('id').single();
      if (error) throw error;
      if (qItems?.length > 0) {
        const dupItems = qItems.map((item: any, idx: number) => ({
          quote_id: newQuote.id, item_number: idx + 1, product_code: item.product_code,
          quantity: item.quantity, model: item.model, brand: item.brand, description: item.description || '',
          specifications: item.specifications, unit_price: item.unit_price,
          discount_percent: item.discount_percent, unit_total: item.unit_total,
          line_total: item.line_total, image_url: item.image_url, is_gift: item.is_gift || false,
        }));
        await db.from('quote_items').insert(dupItems);
      }
      toast.success('Orçamento duplicado com sucesso!');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao duplicar: ' + err.message);
    }
  };

  const handleCopyPublicLink = (quote: any) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/quote/${quote.public_token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link público copiado!');
  };

  const handleExportPdf = async (quote: any) => {
    try {
      const [{ data: qItems }, { data: clientData }] = await Promise.all([
        db.from('quote_items').select('*').eq('quote_id', quote.id).order('item_number'),
        db.from('clients').select('*').eq('id', quote.client_id).maybeSingle(),
      ]);
      await generateQuotePdf(quote, qItems || [], clientData);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + err.message);
    }
  };

  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);

  const handleWhatsAppWithPdf = async (quote: any) => {
    if (!quote.clients?.phone) return;
    setWhatsappLoading(quote.id);
    try {
      const { data: clientData } = await db.from('clients').select('*').eq('id', quote.client_id).maybeSingle();
      const phone = quote.clients.phone.replace(/\D/g, '');
      const clientName = clientData?.company_name || clientData?.name || quote.client_name || 'Cliente';
      const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(quote.total_amount) || 0);
      const publicLink = `${window.location.origin}/quote/${quote.public_token}`;
      const sellerName = profile?.full_name || '';
      let message = `Olá ${clientName}! 👋\n\nPreparei seu orçamento:\n\n📋 *${quote.quote_number}*\n💰 Valor: *${total}*\n\n📄 Ver proposta: ${publicLink}\n\nSe precisar de ajustes ou tiver dúvidas, estou à disposição 🙂`;
      if (sellerName) message += `\n\nAtenciosamente,\n*${sellerName}*`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err: any) {
      toast.error('Erro ao preparar WhatsApp: ' + err.message);
    } finally {
      setWhatsappLoading(null);
    }
  };

  const getDefaultSalesperson = useCallback(() => {
    if (!profile?.full_name) return '';
    if (salespeople.length > 0) {
      const exact = salespeople.find((s: any) => s.name === profile.full_name);
      if (exact) return exact.name;
      const match = salespeople.find((s: any) => s.name?.toLowerCase().trim() === profile.full_name.toLowerCase().trim());
      if (match) return match.name;
      const partial = salespeople.find((s: any) =>
        s.name?.toLowerCase().includes(profile.full_name.toLowerCase()) ||
        profile.full_name.toLowerCase().includes(s.name?.toLowerCase())
      );
      if (partial) return partial.name;
    }
    return profile.full_name;
  }, [profile?.full_name, salespeople]);

  useEffect(() => {
    if (!editingQuote) {
      const defaultSp = getDefaultSalesperson();
      if (defaultSp) {
        setForm(prev => {
          if (prev.salesperson && prev.salesperson !== '') return prev;
          return { ...prev, salesperson: defaultSp };
        });
      }
    }
  }, [getDefaultSalesperson, editingQuote]);

  const resetForm = () => {
    setEditingQuote(null);
    const defaultSp = getDefaultSalesperson();
    setForm({ ...defaultForm, salesperson: defaultSp });
    setItems([emptyItem()]);
  };

  const filtered = quotes.filter((q: any) => {
    if (isGestor) {
      if (responsibleFilter === 'me') {
        if (q.created_by !== user?.id) return false;
      } else if (responsibleFilter !== 'all') {
        if (q.created_by !== responsibleFilter) return false;
      }
    } else if (isAdmin || !isGestor) {
      // Vendedor e agora Admin vêem apenas os seus
      if (q.created_by !== user?.id) return false;
    }
    return q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.client_name?.toLowerCase()?.includes(search.toLowerCase()) ||
      q.clients?.name?.toLowerCase()?.includes(search.toLowerCase()) ||
      q.clients?.company_name?.toLowerCase()?.includes(search.toLowerCase());
  });

  // Helper to render split payment summary for listings
  const renderPaymentInfo = (q: any) => {
    if (q.is_split_payment) {
      const m1 = paymentMethodLabels[q.split_method_1];
      const m2 = paymentMethodLabels[q.split_method_2];
      return (
        <span className="inline-flex items-center gap-1 text-xs">
          <SplitSquareVertical className="h-3 w-3 text-primary" />
          {m1?.label || '?'} + {m2?.label || '?'}
        </span>
      );
    }
    const pm = paymentMethodLabels[q.payment_method];
    if (!pm) return <span className="text-muted-foreground text-xs">—</span>;
    const PmIcon = pm.icon;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted border border-border">
        <PmIcon className="h-3 w-3" /> {pm.label}
        {q.installments > 1 && ` ${q.installments}x`}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Orçamentos</h1>
          <p className="text-muted-foreground text-sm">Crie e gerencie seus orçamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => {
          if (o && !editingQuote) {
            setForm(prev => ({ ...prev, salesperson: prev.salesperson || getDefaultSalesperson() }));
          }
          setDialogOpen(o);
          if (!o) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto min-h-[44px]"><Plus className="h-4 w-4" /> Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingQuote ? `Editar ${editingQuote.quote_number}` : 'Novo Orçamento'}
              </DialogTitle>
            </DialogHeader>

            <QuoteHeader />

            <div className="space-y-6 mt-4">
              {/* Client, Salesperson, Status */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="space-y-2 md:col-span-12 lg:col-span-8">
                  <Label className="text-sm font-semibold mb-1 block">
                    Cliente <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.client_id} onValueChange={v => {
                    const selectedClient = clients.find((c: any) => c.id === v);
                    setForm(p => ({
                      ...p,
                      client_id: v,
                      is_reseller: selectedClient?.is_revenda || false,
                    }));
                  }}>
                    <SelectTrigger className="h-11 text-sm border-2 focus:ring-primary/20 transition-all bg-white shadow-sm px-4">
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)]">
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="py-2.5">
                          <span className="font-medium text-sm whitespace-normal text-left">{c.company_name || c.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-12 lg:col-span-4">
                  <Label className="text-sm font-semibold">Vendedor</Label>
                  {!isAdmin && !isGestor ? (
                    <Input value={form.salesperson || profile?.full_name || ''} readOnly className="bg-muted cursor-not-allowed" />
                  ) : (
                    <Select value={form.salesperson} onValueChange={v => setForm(p => ({ ...p, salesperson: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                      <SelectContent>
                        {salespeople.map((s: any) => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:col-span-12 lg:col-span-12 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="pre_venda">Pré-venda</SelectItem>
                        <SelectItem value="contato_feito">Contato Feito</SelectItem>
                        <SelectItem value="sent">Proposta Enviada</SelectItem>
                        <SelectItem value="negociacao">Negociação</SelectItem>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Validade da Proposta</Label>
                    <Input className="h-10" value={form.proposal_validity} onChange={e => setForm(p => ({ ...p, proposal_validity: e.target.value }))} placeholder="Ex: 15 dias" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Data de Follow-up</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full h-10 justify-start text-left font-normal",
                            !form.followup_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.followup_date ? safeFormatDate(form.followup_date) : <span>Selecionar data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.followup_date ? new Date(form.followup_date + 'T12:00:00') : undefined}
                          onSelect={handleFollowupDateChange}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Quick entry - manual total */}
              {QUICK_ENTRY_STATUSES.includes(form.status) && (
                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold">Lançamento rápido</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use este campo para registrar rapidamente o valor da negociação sem adicionar itens neste momento.
                  </p>
                  <div className="max-w-xs">
                    <Label className="text-xs">Valor total da negociação (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.manual_total === 0 ? '' : form.manual_total}
                      onChange={e => setForm(p => ({ ...p, manual_total: e.target.value }))}
                      onFocus={e => e.target.select()}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  {Number(form.manual_total) > 0 && !hasItems && (
                    <p className="text-xs text-emerald-600 font-medium">✓ Você pode salvar sem adicionar itens/produtos</p>
                  )}
                </div>
              )}

              {/* Payment Block - reorganized */}
              <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Pagamento</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="split-payment" className="text-xs text-muted-foreground cursor-pointer">Pagamento em dois métodos</Label>
                    <Switch
                      id="split-payment"
                      checked={form.is_split_payment}
                      onCheckedChange={(checked) => setForm(p => ({
                        ...p,
                        is_split_payment: checked,
                        // Reset single payment when enabling split
                        ...(checked ? { payment_method: '', payment_date: '', installments: 1 } : { split_method_1: '', split_method_2: '', split_value_1: 0, split_value_2: 0, split_date_1: '', split_date_2: '', split_installments_1: 1, split_installments_2: 1 }),
                      }))}
                    />
                  </div>
                </div>

                {!form.is_split_payment ? (
                  /* Single payment mode */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Método de Pagamento</Label>
                      <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v, payment_date: '', installments: 1 }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar método" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.payment_method && (
                      <PaymentMethodFields
                        method={form.payment_method}
                        date={form.payment_date}
                        onDateChange={v => setForm(p => ({ ...p, payment_date: v }))}
                        installments={form.installments}
                        onInstallmentsChange={v => setForm(p => ({ ...p, installments: v }))}
                      />
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs">Observações de pagamento</Label>
                      <Input
                        value={form.payment_terms}
                        onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}
                        placeholder="Ex: combinar entrega antes do pagamento, etc. (opcional)"
                      />
                    </div>
                  </div>
                ) : (
                  /* Split payment mode */
                  <div className="space-y-4">
                    {/* Method 1 */}
                    <div className="p-3 rounded-md border bg-background space-y-3">
                      <Label className="text-xs font-semibold text-primary">Método 1 — Entrada</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Método</Label>
                          <Select value={form.split_method_1} onValueChange={v => setForm(p => ({ ...p, split_method_1: v, split_date_1: '', split_installments_1: 1 }))}>
                            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input type="number" step="0.01" min={0}
                            value={form.split_value_1 === 0 ? '' : form.split_value_1}
                            onChange={e => {
                              const v = e.target.value;
                              const numV = parseFloat(v) || 0;
                              setForm(p => ({ ...p, split_value_1: v, split_value_2: Math.max(0, Math.round((grandTotal - numV) * 100) / 100) }));
                            }}
                            onFocus={e => e.target.select()}
                            placeholder="0,00"
                          />
                        </div>
                        {form.split_method_1 && (
                          <PaymentMethodFields
                            method={form.split_method_1}
                            date={form.split_date_1}
                            onDateChange={v => setForm(p => ({ ...p, split_date_1: v }))}
                            installments={form.split_installments_1}
                            onInstallmentsChange={v => setForm(p => ({ ...p, split_installments_1: v }))}
                          />
                        )}
                      </div>
                    </div>

                    {/* Method 2 */}
                    <div className="p-3 rounded-md border bg-background space-y-3">
                      <Label className="text-xs font-semibold text-primary">Método 2 — Restante</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Método</Label>
                          <Select value={form.split_method_2} onValueChange={v => setForm(p => ({ ...p, split_method_2: v, split_date_2: '', split_installments_2: 1 }))}>
                            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input type="number" step="0.01" min={0}
                            value={form.split_value_2 === 0 ? '' : form.split_value_2}
                            onChange={e => {
                              setForm(p => ({ ...p, split_value_2: e.target.value }));
                            }}
                            onFocus={e => e.target.select()}
                            placeholder="0,00"
                          />
                        </div>
                        {form.split_method_2 && (
                          <PaymentMethodFields
                            method={form.split_method_2}
                            date={form.split_date_2}
                            onDateChange={v => setForm(p => ({ ...p, split_date_2: v }))}
                            installments={form.split_installments_2}
                            onInstallmentsChange={v => setForm(p => ({ ...p, split_installments_2: v }))}
                          />
                        )}
                      </div>
                    </div>

                    {/* Split summary */}
                    {Number(form.split_value_1) > 0 || Number(form.split_value_2) > 0 ? (
                      <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                        Método 1: {formatCurrency(Number(form.split_value_1))} + Método 2: {formatCurrency(Number(form.split_value_2))} = {formatCurrency(Number(form.split_value_1) + Number(form.split_value_2))}
                        {Math.abs((Number(form.split_value_1) + Number(form.split_value_2)) - grandTotal) > 0.01 && (
                          <span className="text-destructive ml-2 font-medium">
                            (Diferença de {formatCurrency(Math.abs((Number(form.split_value_1) + Number(form.split_value_2)) - grandTotal))} em relação ao total)
                          </span>
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label className="text-xs">Observações de pagamento</Label>
                      <Input
                        value={form.payment_terms}
                        onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}
                        placeholder="Ex: observações adicionais sobre pagamento (opcional)"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Status do Pagamento</Label>
                    <Select value={form.payment_status} onValueChange={v => setForm(p => ({ ...p, payment_status: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_andamento">Em andamento</SelectItem>
                        <SelectItem value="liquidado">Liquidado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Approval warning */}
                {form.status === 'approved' && !form.is_split_payment && !form.payment_method && (
                  <p className="text-xs text-destructive font-medium">⚠ Para aprovar, preencha o método de pagamento.</p>
                )}
              </div>

              {/* Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/20">
                <div className="space-y-2">
                  <Label>Prazo de Envio</Label>
                  <Input
                    value={form.shipping_deadline}
                    onChange={e => setForm(p => ({ ...p, shipping_deadline: e.target.value }))}
                    placeholder="Ex: 5 dias úteis"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forma de Envio</Label>
                  <Select value={form.shipping_method} onValueChange={v => setForm(p => ({ ...p, shipping_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {shippingMethods.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Frete (R$)</Label>
                  <Input type="number" step="0.01" min={0}
                    value={form.shipping_cost === 0 ? '' : form.shipping_cost}
                    onChange={e => setForm(p => ({ ...p, shipping_cost: e.target.value }))}
                    onFocus={e => e.target.select()}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Endereço de Entrega Alternativo */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="use_alt_shipping"
                    checked={form.use_alt_shipping_address}
                    onCheckedChange={(checked) => setForm(p => ({ ...p, use_alt_shipping_address: !!checked }))}
                  />
                  <label htmlFor="use_alt_shipping" className="text-sm font-medium cursor-pointer select-none">
                    Enviar para endereço diferente do cadastro
                  </label>
                </div>

                {form.use_alt_shipping_address && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
                    <div className="space-y-1 md:col-span-6">
                      <Label className="text-xs">Destinatário</Label>
                      <Input value={form.shipping_recipient} maxLength={150}
                        onChange={e => setForm(p => ({ ...p, shipping_recipient: e.target.value }))}
                        placeholder="Nome de quem vai receber" />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">Telefone</Label>
                      <Input value={form.shipping_phone} maxLength={20}
                        onChange={e => setForm(p => ({ ...p, shipping_phone: e.target.value }))}
                        placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">CEP</Label>
                      <Input value={form.shipping_cep} maxLength={10}
                        onChange={e => handleShippingCepChange(e.target.value)}
                        placeholder="00000-000" />
                    </div>
                    <div className="space-y-1 md:col-span-7">
                      <Label className="text-xs">Logradouro</Label>
                      <Input value={form.shipping_address} maxLength={200}
                        onChange={e => setForm(p => ({ ...p, shipping_address: e.target.value }))}
                        placeholder="Rua / Avenida" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Número</Label>
                      <Input value={form.shipping_address_number} maxLength={20}
                        onChange={e => setForm(p => ({ ...p, shipping_address_number: e.target.value }))}
                        placeholder="123" />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">Complemento</Label>
                      <Input value={form.shipping_complement} maxLength={100}
                        onChange={e => setForm(p => ({ ...p, shipping_complement: e.target.value }))}
                        placeholder="Sala, andar..." />
                    </div>
                    <div className="space-y-1 md:col-span-5">
                      <Label className="text-xs">Bairro</Label>
                      <Input value={form.shipping_neighborhood} maxLength={100}
                        onChange={e => setForm(p => ({ ...p, shipping_neighborhood: e.target.value }))} />
                    </div>
                    <div className="space-y-1 md:col-span-5">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={form.shipping_city} maxLength={100}
                        onChange={e => setForm(p => ({ ...p, shipping_city: e.target.value }))} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">UF</Label>
                      <Input value={form.shipping_state} maxLength={2}
                        onChange={e => setForm(p => ({ ...p, shipping_state: e.target.value.toUpperCase() }))}
                        placeholder="SP" />
                    </div>
                    <div className="space-y-1 md:col-span-12">
                      <Label className="text-xs">Observações de Entrega</Label>
                      <Input value={form.shipping_notes} maxLength={500}
                        onChange={e => setForm(p => ({ ...p, shipping_notes: e.target.value }))}
                        placeholder="Ex: entregar no horário comercial, falar com portaria..." />
                    </div>
                  </div>
                )}
              </div>


              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <Checkbox
                  id="is_reseller"
                  checked={form.is_reseller}
                  onCheckedChange={(checked) => setForm(p => ({ ...p, is_reseller: !!checked }))}
                />
                <label htmlFor="is_reseller" className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                  <Store className="h-4 w-4 text-orange-500" />
                  Cliente Revenda
                </label>
                {form.is_reseller && (() => {
                  const sc = clients.find((c: any) => c.id === form.client_id);
                  const ie = sc?.contrib_icms;
                  return ie ? (
                    <span className="text-xs text-muted-foreground ml-auto">IE: {ie}</span>
                  ) : (
                    <span className="text-xs text-destructive ml-auto">⚠ IE não cadastrada</span>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={4} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observações gerais do orçamento..." />
              </div>

              {/* Follow-up Date */}
              <div className="space-y-2 p-4 rounded-lg border bg-amber-50/30 border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarIcon className="h-4 w-4 text-amber-600" />
                  <Label className="font-semibold text-amber-900">Data do Próximo Follow-up</Label>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal bg-white", !form.followup_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.followup_date ? safeFormatDate(form.followup_date) : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.followup_date ? (new Date(form.followup_date + 'T12:00:00')) : undefined}
                        onSelect={handleFollowupDateChange}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-amber-700/70">
                    Defina uma data para ser lembrado de retomar o contato com este cliente.
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Itens do Orçamento</Label>
                  <Button type="button" size="sm" onClick={addItem} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-3 w-3" /> Adicionar Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.model} className="w-12 h-12 object-contain rounded border" onError={e => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                              <FileText className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="text-sm font-medium break-words flex-1">Item {idx + 1}{item.model ? ` — ${item.model}` : ''}</span>
                        </div>
                        {items.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {/* Product Search */}
                      <div className="space-y-1 relative col-span-full">
                        <Label className="text-xs">Buscar Produto (digite para pesquisar)</Label>
                        <Input
                          placeholder="Digite nome, marca ou código do produto..."
                          value={productSearch[idx] || ''}
                          onChange={e => {
                            setProductSearch(prev => ({ ...prev, [idx]: e.target.value }));
                            setShowProductDropdown(idx);
                          }}
                          onFocus={() => setShowProductDropdown(idx)}
                          onBlur={() => setTimeout(() => setShowProductDropdown(null), 200)}
                        />
                        {showProductDropdown === idx && getFilteredProducts(idx).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {getFilteredProducts(idx).map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-3"
                                onMouseDown={() => selectProduct(idx, p)}
                              >
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="w-8 h-8 object-contain rounded border shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 bg-muted rounded border flex items-center justify-center shrink-0">
                                    <FileText className="h-3 w-3 text-muted-foreground/40" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium block whitespace-normal">{p.name}</span>
                                  <span className="text-muted-foreground text-xs">{p.brand} • {formatCurrency(parseFloat(p.price) || 0)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Modelo *</Label>
                          <Input value={item.model} onChange={e => updateItem(idx, 'model', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Marca</Label>
                          <Input value={item.brand} onChange={e => updateItem(idx, 'brand', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Código</Label>
                          <Input value={item.product_code} onChange={e => updateItem(idx, 'product_code', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input type="number" min={1} value={item.quantity === 0 ? '' : item.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            onFocus={e => e.target.select()} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs">Especificações</Label>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Layout no PDF:</Label>
                            <Select
                              value={item.description_layout || 'compact'}
                              onValueChange={v => updateItem(idx, 'description_layout', v)}
                            >
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compact">Compacto (curto)</SelectItem>
                                <SelectItem value="expanded">Expandido (completo)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Textarea value={item.specifications} rows={2}
                          onChange={e => updateItem(idx, 'specifications', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Preço Unit. (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={item.unit_price === 0 ? '' : item.unit_price} 
                            disabled={true}
                            onChange={e => updateItem(idx, 'unit_price', e.target.value)} 
                            onFocus={e => e.target.select()}
                            className="bg-muted opacity-80 cursor-not-allowed" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Desconto (%)</Label>
                          <div className="relative">
                            <Input 
                              type="number" 
                              step="0.1" 
                              min={0} 
                              max={100} 
                              value={item.discount_percent === 0 ? '' : item.discount_percent} 
                              disabled={item.is_gift}
                              onChange={e => updateItem(idx, 'discount_percent', e.target.value)} 
                              onFocus={e => e.target.select()}
                              className={cn("pr-7", item.is_gift && "opacity-50")} 
                            />
                            {item.discount_percent !== 0 && item.discount_percent !== '' && !item.is_gift && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                                %
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor Unit.</Label>
                          <Input value={item.is_gift ? 'BRINDE' : formatCurrency(item.unit_total)} readOnly className="bg-muted" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total</Label>
                          <Input value={item.is_gift ? 'BRINDE' : formatCurrency(item.line_total)} readOnly className={`bg-muted font-semibold ${item.is_gift ? 'text-emerald-600' : ''}`} />
                        </div>
                        <div className="space-y-1 flex items-end">
                          <Button
                            type="button"
                            variant={item.is_gift ? 'default' : 'outline'}
                            size="sm"
                            className={`w-full gap-1.5 min-h-[36px] ${item.is_gift ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                            onClick={() => {
                              setItems(prev => {
                                const updated = [...prev];
                                updated[idx] = calcItem({ ...updated[idx], is_gift: !updated[idx].is_gift });
                                return updated;
                              });
                            }}
                          >
                            <Gift className="h-3.5 w-3.5" />
                            {item.is_gift ? 'Brinde ✓' : 'Brinde'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" onClick={addItem} className="mt-3 w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="h-4 w-4" /> Adicionar Novo Item
                </Button>

                <div className="flex justify-end mt-4 p-3 bg-primary/5 rounded-lg">
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(totalAmount)}</p>
                    {Number(form.shipping_cost) > 0 && <p className="text-sm text-muted-foreground">Frete: {formatCurrency(Number(form.shipping_cost))}</p>}
                    <p className="text-2xl font-bold font-display text-primary">Total: {formatCurrency(grandTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Orçamento'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'flex-row items-center'}`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar orçamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            {isGestor && (
              <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                <SelectTrigger className="w-full sm:w-[220px] min-h-[44px]">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Meus Orçamentos</SelectItem>
                  <SelectItem value="all">Todos os Vendedores</SelectItem>
                  {sellerProfiles.filter(s => s.user_id !== user?.id).map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">
                {responsibleFilter !== 'me' && responsibleFilter !== 'all' 
                  ? "Este vendedor ainda não possui orçamentos." 
                  : "Nenhum orçamento encontrado"}
              </p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filtered.map((q: any) => {
                const ps = paymentStatusLabels[q.payment_status] || paymentStatusLabels.pendente;
                const PsIcon = ps.icon;
                return (
                  <div key={q.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{q.quote_number}</p>
                        <p className="text-xs text-muted-foreground">{q.clients?.company_name || q.clients?.name || q.client_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{safeFormatDate(q.quote_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency((parseFloat(q.total_amount) || 0))}</p>
                        {parseFloat(q.shipping_cost) > 0 && (
                          <p className="text-xs text-muted-foreground">Frete: {formatCurrency(parseFloat(q.shipping_cost))}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        q.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                        q.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {statusLabels[q.status] || q.status}
                      </span>
                      {q.source === 'loja_integrada' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                          <ShoppingBag className="h-3 w-3" /> Loja Integrada
                        </span>
                      )}
                      {q.is_reseller && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                          <Store className="h-3 w-3" /> Revenda
                        </span>
                      )}
                      {renderPaymentInfo(q)}
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${ps.className}`}>
                        <PsIcon className="h-3 w-3" /> {ps.label}
                      </span>
                    </div>
                    <div className="flex gap-1 pt-1 border-t">
                      {q.clients?.phone && (
                        <Button size="sm" variant="ghost" disabled={whatsappLoading === q.id} onClick={() => handleWhatsAppWithPdf(q)} className="min-h-[44px] flex-1">
                          {whatsappLoading === q.id ? <Loader2 className="h-4 w-4 animate-spin text-green-600" /> : <MessageCircle className="h-4 w-4 text-green-600" />}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleCopyPublicLink(q)} className="min-h-[44px] flex-1" title="Link público">
                        <Link2 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(q)} className="min-h-[44px] flex-1">
                        <Copy className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setChatQuote({ id: q.id, number: q.quote_number })} className="min-h-[44px] flex-1" title="Chat interno">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleExportPdf(q)} className="min-h-[44px] flex-1">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(q)} className="min-h-[44px] flex-1">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)} className="min-h-[44px] flex-1">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Orçamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Frete</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q: any) => {
                  const ps = paymentStatusLabels[q.payment_status] || paymentStatusLabels.pendente;
                  const PsIcon = ps.icon;
                  return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {q.quote_number}
                        {q.source === 'loja_integrada' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            <ShoppingBag className="h-2.5 w-2.5" /> Importado
                          </span>
                        )}
                        {q.is_reseller && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            <Store className="h-2.5 w-2.5" /> Revenda
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{q.clients?.company_name || q.clients?.name || q.client_name || '-'}</TableCell>
                    <TableCell>{safeFormatDate(q.quote_date)}</TableCell>
                    <TableCell>
                      {parseFloat(q.shipping_cost) > 0 ? (
                        <span className="text-xs font-medium text-muted-foreground">{formatCurrency(parseFloat(q.shipping_cost))}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency((parseFloat(q.total_amount) || 0))}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        q.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                        q.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {q.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {statusLabels[q.status] || q.status}
                      </span>
                    </TableCell>
                    <TableCell>{renderPaymentInfo(q)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ps.className}`}>
                        <PsIcon className="h-3 w-3" /> {ps.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActionMenu 
                        actions={[
                          { 
                            label: "WhatsApp com PDF", 
                            icon: MessageCircle, 
                            onClick: () => handleWhatsAppWithPdf(q),
                            isPrimary: true,
                            isLoading: whatsappLoading === q.id,
                            className: "text-green-600",
                            disabled: !q.clients?.phone
                          },
                          { 
                            label: "Link Público", 
                            icon: Link2, 
                            onClick: () => handleCopyPublicLink(q),
                            className: "text-primary"
                          },
                          { 
                            label: "Duplicar", 
                            icon: Copy, 
                            onClick: () => handleDuplicate(q),
                            className: "text-blue-600"
                          },
                          { 
                            label: "Chat Interno", 
                            icon: MessageSquare, 
                            onClick: () => setChatQuote({ id: q.id, number: q.quote_number }),
                            className: "text-primary"
                          },
                          { 
                            label: "Exportar PDF", 
                            icon: Download, 
                            onClick: () => handleExportPdf(q)
                          },
                          { 
                            label: "Editar", 
                            icon: Pencil, 
                            onClick: () => handleEdit(q),
                            isSecondary: true
                          },
                          { 
                            label: "Excluir", 
                            icon: Trash2, 
                            onClick: () => handleDelete(q.id),
                            variant: 'destructive'
                          }
                        ]} 
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <QuoteChat
        quoteId={chatQuote?.id || ''}
        quoteNumber={chatQuote?.number || ''}
        open={!!chatQuote}
        onOpenChange={(o) => { if (!o) setChatQuote(null); }}
      />
    </AppLayout>
  );
}
