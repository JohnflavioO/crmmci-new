import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, User, Tag, MessageSquare, CheckSquare, 
  History, Paperclip, Phone, MoreHorizontal, Trash2,
  Clock, AlertCircle, Share2, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

interface TaskDetailsModalProps {
  task: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailsModal({ task, isOpen, onClose, onUpdate }: TaskDetailsModalProps) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      loadDetails();
    }
  }, [task, isOpen]);

  const loadDetails = async () => {
    if (!task) return;
    
    const [{ data: c }, { data: ch }] = await Promise.all([
      db.from('task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
      db.from('task_checklists').select('*').eq('task_id', task.id).order('position', { ascending: true })
    ]);
    
    setComments(c || []);
    setChecklist(ch || []);
  };

  const addComment = async () => {
    if (!comment.trim() || !task) return;
    setLoading(true);
    const { error } = await db.from('task_comments').insert({
      task_id: task.id,
      content: comment,
      user_id: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      toast.error('Erro ao adicionar comentário');
    } else {
      setComment('');
      loadDetails();
      toast.success('Comentário enviado');
    }
    setLoading(false);
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim() || !task) return;
    const { error } = await db.from('task_checklists').insert({
      task_id: task.id,
      content: newChecklistItem,
      position: checklist.length
    });

    if (error) {
      toast.error('Erro ao adicionar item');
    } else {
      setNewChecklistItem('');
      loadDetails();
    }
  };

  const toggleChecklistItem = async (item: any) => {
    const { error } = await db.from('task_checklists').update({
      is_completed: !item.is_completed
    }).eq('id', item.id);

    if (!error) loadDetails();
  };

  const deletetask = async () => {
    if (!task || !confirm('Deseja realmente excluir esta tarefa?')) return;
    const { error } = await db.from('tasks').delete().eq('id', task.id);
    if (error) {
      toast.error('Erro ao excluir tarefa');
    } else {
      toast.success('Tarefa excluída');
      onUpdate();
      onClose();
    }
  };

  if (!task) return null;

  const priorityColors: Record<string, string> = {
    alta: 'bg-red-100 text-red-700 border-red-200',
    média: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    baixa: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[600px] w-full p-0 flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start mb-4">
            <Badge variant="outline" className={priorityColors[task.priority] || ''}>
              {task.priority.toUpperCase()}
            </Badge>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => {/* Quick Share */}}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={deletetask} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetTitle className="text-2xl font-bold leading-tight mb-2">{task.title}</SheetTitle>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Prazo: {task.due_date ? format(new Date(task.due_date), "dd 'de' MMMM", { locale: ptBR }) : 'Sem data'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>Resp: {task.user_id?.substring(0, 8)}...</span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Description */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MoreHorizontal className="h-3 w-3" /> Descrição
              </Label>
              <div className="text-sm bg-muted/30 p-4 rounded-lg min-h-[80px]">
                {task.description || <span className="italic text-muted-foreground">Sem descrição adicionada.</span>}
              </div>
            </div>

            {/* Related Context */}
            {(task.client || task.quote) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {task.client && (
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Cliente Relacionado</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> {task.client.name}
                    </p>
                  </div>
                )}
                {task.quote && (
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Orçamento</p>
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" /> #{task.quote.quote_number}
                      </p>
                      {task.quote.total && (
                        <p className="text-sm font-bold text-emerald-600">
                          R$ {task.quote.total.toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs for Details */}
            <Tabs defaultValue="checklist" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="checklist" className="text-xs gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" /> Checklist
                </TabsTrigger>
                <TabsTrigger value="comments" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </TabsTrigger>
                <TabsTrigger value="attachments" className="text-xs gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Anexos
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1.5">
                  <History className="h-3.5 w-3.5" /> Timeline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Progresso: {checklist.length > 0 ? Math.round((checklist.filter(i => i.is_completed).length / checklist.length) * 100) : 0}%</p>
                </div>
                <div className="space-y-2">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md group transition-colors">
                      <Checkbox checked={item.is_completed} onCheckedChange={() => toggleChecklistItem(item)} />
                      <span className={`text-sm flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.content}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-4">
                    <Input 
                      placeholder="Adicionar item..." 
                      className="h-9 text-sm" 
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                    />
                    <Button size="sm" onClick={addChecklistItem}>Adicionar</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <Textarea 
                      placeholder="Escreva um comentário..." 
                      className="min-h-[80px] text-sm" 
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addComment} disabled={loading || !comment.trim()} className="gap-2">
                      <Send className="h-4 w-4" /> Enviar
                    </Button>
                  </div>
                  
                  <Separator />

                  <div className="space-y-4 pt-2">
                    {comments.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum comentário ainda.</p>}
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-accent text-[10px] flex items-center justify-center shrink-0">
                          {c.user_id?.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold">Usuário</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'dd/MM HH:mm')}</span>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-lg text-sm">
                            {c.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="py-8 text-center text-muted-foreground">
                <Paperclip className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm italic">Nenhum anexo encontrado.</p>
                <Button variant="outline" size="sm" className="mt-4">Fazer upload</Button>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                    <p className="text-xs font-bold">Criada em {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}</p>
                    <p className="text-xs text-muted-foreground">Início da jornada da tarefa</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t bg-muted/10">
          <Button variant="outline" className="gap-2 w-full md:w-auto" onClick={() => {/* Open WhatsApp if client has phone */}}>
            <Phone className="h-4 w-4" /> WhatsApp Rápido
          </Button>
          <Button className="gap-2 w-full md:w-auto" onClick={onClose}>Fechar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
