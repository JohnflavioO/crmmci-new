import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, PlayCircle, Search, HelpCircle } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

interface HelpVideo {
  id: string;
  title: string;
  description: string | null;
  category: string;
  loom_url: string;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = [
  'Geral',
  'Orçamentos',
  'Clientes',
  'Financeiro',
  'Logística',
  'Suporte Técnico',
  'Métricas',
  'Configurações',
];

function loomId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}
function loomEmbedUrl(url: string): string | null {
  const id = loomId(url);
  return id ? `https://www.loom.com/embed/${id}` : null;
}
function loomThumbUrl(url: string): string | null {
  const id = loomId(url);
  return id ? `https://cdn.loom.com/sessions/thumbnails/${id}-with-play.jpg` : null;
}

export default function Help() {
  const { isAdmin, isGestor } = useAuth();
  const canManage = isAdmin || isGestor;
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<HelpVideo | null>(null);
  const [playing, setPlaying] = useState<HelpVideo | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Geral',
    loom_url: '',
    sort_order: 0,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('help_videos' as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar vídeos');
    } else {
      setVideos((data || []) as unknown as HelpVideo[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'Geral', loom_url: '', sort_order: 0 });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setOpenForm(true); };
  const openEdit = (v: HelpVideo) => {
    setEditing(v);
    setForm({
      title: v.title,
      description: v.description || '',
      category: v.category,
      loom_url: v.loom_url,
      sort_order: v.sort_order,
    });
    setOpenForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.loom_url.trim()) {
      toast.error('Título e link do Loom são obrigatórios');
      return;
    }
    if (!loomEmbedUrl(form.loom_url)) {
      toast.error('Link do Loom inválido. Use o formato https://www.loom.com/share/...');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      loom_url: form.loom_url.trim(),
      sort_order: Number(form.sort_order) || 0,
    };

    if (editing) {
      const { error } = await supabase.from('help_videos' as any).update(payload).eq('id', editing.id);
      if (error) return toast.error('Erro ao atualizar');
      toast.success('Vídeo atualizado');
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('help_videos' as any).insert({
        ...payload, created_by: user?.id,
      });
      if (error) return toast.error('Erro ao criar');
      toast.success('Vídeo adicionado');
    }
    setOpenForm(false);
    resetForm();
    load();
  };

  const remove = async (v: HelpVideo) => {
    if (!confirm(`Remover "${v.title}"?`)) return;
    const { error } = await supabase.from('help_videos' as any).delete().eq('id', v.id);
    if (error) return toast.error('Erro ao remover');
    toast.success('Vídeo removido');
    load();
  };

  const filtered = videos.filter(v => {
    const matchesSearch = !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || v.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <AppLayout>
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Ajuda</h1>
            <p className="text-sm text-muted-foreground">Tutoriais e passo a passo de uso do CRM</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo tutorial
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tutoriais..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum tutorial encontrado.</p>
            {canManage && (
              <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Adicionar o primeiro
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => {
            const thumb = loomThumbUrl(v.loom_url);
            return (
              <Card key={v.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
                <button
                  onClick={() => setPlaying(v)}
                  className="relative aspect-video bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center group overflow-hidden"
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt={v.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center transition-transform group-hover:scale-110">
                    <div className="h-14 w-14 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
                      <PlayCircle className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                </button>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug line-clamp-2">{v.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{v.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                  {v.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{v.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-2">
                    <Button size="sm" variant="default" className="flex-1 gap-2" onClick={() => setPlaying(v)}>
                      <PlayCircle className="h-4 w-4" /> Assistir
                    </Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(v)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Player */}
      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && loomEmbedUrl(playing.loom_url) && (
            <div className="aspect-video w-full">
              <iframe
                src={loomEmbedUrl(playing.loom_url)!}
                allowFullScreen
                className="w-full h-full rounded-md"
              />
            </div>
          )}
          {playing?.description && (
            <p className="text-sm text-muted-foreground">{playing.description}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Form */}
      <Dialog open={openForm} onOpenChange={(o) => { setOpenForm(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tutorial' : 'Novo tutorial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Link do Loom *</Label>
              <Input
                placeholder="https://www.loom.com/share/..."
                value={form.loom_url}
                onChange={(e) => setForm({ ...form, loom_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Cole a URL completa do Loom (share ou embed).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
