import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Compass, Plus, Search, Star, MoreHorizontal, Archive, Pencil, Trash2, Send, Loader2, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Conversation = {
  id: string;
  title: string | null;
  is_favorite: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_name: string | null;
  tool_result: any;
  created_at: string;
};

function formatValue(v: any, key: string) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue') || key.includes('price'))) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    try { return format(new Date(v), 'dd/MM/yyyy', { locale: ptBR }); } catch { return v; }
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function columnLabel(c: string) {
  const map: Record<string, string> = {
    company_name: 'Empresa', name: 'Nome', city: 'Cidade', state: 'UF',
    email: 'E-mail', phone: 'Telefone', quote_number: 'Orçamento',
    client_name: 'Cliente', total_amount: 'Valor', status: 'Status',
    created_at: 'Criado em', title: 'Tarefa', due_date: 'Vencimento',
    code: 'Código', brand: 'Marca', category_principal: 'Categoria', price: 'Preço',
  };
  return map[c] || c;
}

function groupByDate(items: Conversation[]) {
  const groups: Record<string, Conversation[]> = {
    'Favoritos': [],
    'Hoje': [],
    'Ontem': [],
    'Esta semana': [],
    'Este mês': [],
    'Antigos': [],
    'Arquivados': [],
  };
  for (const c of items) {
    if (c.archived_at) { groups['Arquivados'].push(c); continue; }
    if (c.is_favorite) { groups['Favoritos'].push(c); continue; }
    const d = new Date(c.updated_at || c.created_at);
    if (isToday(d)) groups['Hoje'].push(c);
    else if (isYesterday(d)) groups['Ontem'].push(c);
    else if (isThisWeek(d, { weekStartsOn: 1 })) groups['Esta semana'].push(c);
    else if (isThisMonth(d)) groups['Este mês'].push(c);
    else groups['Antigos'].push(c);
  }
  return groups;
}

function ResultTable({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="mt-3 space-y-3">
      {result.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border border-border/60 p-3">
          {Object.entries(result.summary).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{k.replace(/_/g, ' ')}</p>
              <p className="text-base font-semibold text-foreground">{formatValue(v, k)}</p>
            </div>
          ))}
        </div>
      )}
      {result.rows && result.rows.length > 0 && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
            {result.count} registro{result.count === 1 ? '' : 's'}
          </div>
          <div className="overflow-x-auto max-h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns?.map((c: string) => <TableHead key={c}>{columnLabel(c)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r: any, i: number) => (
                  <TableRow key={r.id || i}>
                    {result.columns?.map((c: string) => (
                      <TableCell key={c} className="text-sm">{formatValue(r[c], c)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {result.rows && result.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
      )}
    </div>
  );
}

export default function AssistenteComercial() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const name = profile?.full_name?.split(' ')[0] || '';
    return name ? `${g}, ${name}.` : `${g}.`;
  }, [profile?.full_name]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('assistant_conversations')
      .select('id, title, is_favorite, archived_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200);
    setConversations((data as any) || []);
  }, [user]);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('assistant_messages')
      .select('id, conversation_id, role, content, tool_name, tool_result, created_at')
      .eq('conversation_id', convId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true });
    setMessages((data as any) || []);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [activeId]);

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic user message
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversation_id: activeId || 'new',
      role: 'user',
      content: text,
      tool_name: null,
      tool_result: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput('');

    try {
      const contextPayload = {
        module: location.pathname,
      };
      const { data, error } = await supabase.functions.invoke('assistant-commercial', {
        body: { message: text, conversation_id: activeId, context: contextPayload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const convId = data.conversation_id as string;
      if (!activeId) setActiveId(convId);
      await Promise.all([loadMessages(convId), loadConversations()]);
    } catch (e: any) {
      toast.error('Não foi possível responder', { description: e.message });
      // rollback optimistic
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const toggleFavorite = async (c: Conversation) => {
    await supabase.from('assistant_conversations').update({ is_favorite: !c.is_favorite }).eq('id', c.id);
    loadConversations();
  };
  const archive = async (c: Conversation) => {
    await supabase.from('assistant_conversations').update({ archived_at: c.archived_at ? null : new Date().toISOString() }).eq('id', c.id);
    loadConversations();
  };
  const remove = async (c: Conversation) => {
    if (!confirm('Excluir esta conversa? Esta ação não pode ser desfeita.')) return;
    await supabase.from('assistant_conversations').delete().eq('id', c.id);
    if (activeId === c.id) newConversation();
    loadConversations();
  };
  const commitRename = async () => {
    if (!renaming) return;
    await supabase.from('assistant_conversations').update({ title: renameValue.slice(0, 120) }).eq('id', renaming.id);
    setRenaming(null);
    loadConversations();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, search]);
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const suggestions = [
    'Clientes há mais de 180 dias sem comprar',
    'Propostas em negociação acima de R$ 50 mil',
    'Métricas do mês',
    'Follow-ups atrasados',
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border/60 bg-muted/20 transition-all duration-200',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden',
        )}
      >
        <div className="p-3 space-y-2 border-b border-border/60">
          <Button onClick={newConversation} className="w-full justify-start h-9" variant="outline">
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar conversas"
              className="h-8 pl-8 text-sm bg-background"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(grouped).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  {label === 'Favoritos' && <Star className="h-3 w-3" />} {label}
                </p>
                <div className="space-y-0.5">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        'group flex items-center rounded-md text-sm',
                        activeId === c.id ? 'bg-accent' : 'hover:bg-accent/50',
                      )}
                    >
                      <button
                        onClick={() => setActiveId(c.id)}
                        className="flex-1 text-left px-2 py-1.5 truncate"
                      >
                        {c.title || 'Sem título'}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 mr-1 rounded hover:bg-background"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => toggleFavorite(c)}>
                            <Star className={cn('h-4 w-4', c.is_favorite && 'fill-amber-400 text-amber-500')} />
                            {c.is_favorite ? 'Remover favorito' : 'Favoritar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setRenaming(c); setRenameValue(c.title || ''); }}>
                            <Pencil className="h-4 w-4" /> Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archive(c)}>
                            <Archive className="h-4 w-4" /> {c.archived_at ? 'Desarquivar' : 'Arquivar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(c)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 pt-4">Nenhuma conversa {search ? 'encontrada' : 'ainda'}.</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-border/60 flex items-center px-3 gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen((v) => !v)}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.14em]">
            <Compass className="h-3.5 w-3.5" /> Assistente Comercial
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl w-full px-4 md:px-6 py-6 space-y-6">
            {messages.length === 0 && !sending && (
              <div className="pt-8">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{greeting}</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Consulte dados reais do CRM. Comece com uma pergunta ou escolha uma sugestão.
                </p>
                <div className="mt-6 grid sm:grid-cols-2 gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-sm p-3 rounded-md border border-border/60 hover:border-foreground/25 hover:bg-accent/40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.role === 'user' ? 'Você' : 'Assistente'}
                </p>
                {m.role === 'user' ? (
                  <Card className="p-4 border-border/70 bg-muted/30">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  </Card>
                ) : (
                  <Card className="p-4 border-border/70">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    {m.tool_result && <ResultTable result={m.tool_result} />}
                    {m.content?.startsWith('Assistente temporariamente indisponível') && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          'Consultar clientes',
                          'Consultar orçamentos',
                          'Consultar produtos',
                          'Follow-ups atrasados',
                          'Métricas do mês',
                        ].map((label) => (
                          <button
                            key={label}
                            onClick={() => { setInput(label); setTimeout(() => inputRef.current?.focus(), 0); }}
                            className="text-xs px-3 py-1.5 rounded-full border border-border/60 hover:border-foreground/30 hover:bg-accent/40 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.tool_name && (
                      <p className="mt-2 text-[10px] text-muted-foreground">Fonte: {m.tool_name}</p>
                    )}
                  </Card>
                )}
              </div>
            ))}

            {sending && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assistente</p>
                <Card className="p-4 border-border/70 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando dados do CRM…
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border/60 bg-background">
          <div className="mx-auto max-w-3xl w-full px-4 md:px-6 py-3">
            <div className="flex items-end gap-2 rounded-lg border border-border/70 bg-background p-2 focus-within:border-foreground/40 transition-colors">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Pergunte sobre clientes, propostas, métricas, follow-ups…"
                rows={1}
                className="min-h-[40px] max-h-40 resize-none border-0 focus-visible:ring-0 shadow-none px-2 py-2 text-[15px]"
                disabled={sending}
              />
              <Button
                onClick={send}
                disabled={sending || !input.trim()}
                size="icon"
                className="h-9 w-9 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Respostas baseadas em dados reais do CRM. Verifique valores antes de decisões críticas.
            </p>
          </div>
        </div>
      </main>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={commitRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
