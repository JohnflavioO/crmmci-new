import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Sparkles, Copy, Check, RefreshCw, Phone, MessageSquare, Target, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import {
  generateFollowUp,
  determineTone,
  determineObjective,
  type FollowUpContext,
  type FollowUpSuggestion,
  type FollowUpObjective,
} from '@/lib/followUpEngine';

interface FollowUpClientData {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  last_interaction_at: string;
  pipeline_stage: string;
  daysAgo: number;
  quoteValue: number;
  quoteNumber: string;
  quoteStatus: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: FollowUpClientData;
  sellerName: string;
  onMarkContacted: () => void;
}

const objectiveLabels: Record<FollowUpObjective, string> = {
  retomar_conversa: 'Retomar conversa',
  cobrar_decisao: 'Cobrar decisão',
  reforcar_valor: 'Reforçar valor',
  contornar_objecao: 'Contornar objeção',
  recuperar_lead: 'Recuperar lead',
};

const objectionOptions = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'caro', label: 'Achou caro' },
  { value: 'prazo', label: 'Pediu prazo' },
  { value: 'analisar', label: 'Vai analisar' },
  { value: 'concorrente', label: 'Comparando concorrente' },
  { value: 'sumiu', label: 'Sumiu / não responde' },
];

const categoryConfig: Record<string, { label: string; color: string }> = {
  retomada: { label: 'Retomada', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  objecao: { label: 'Objeção', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  reativacao: { label: 'Reativação', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  acompanhamento: { label: 'Acompanhamento', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

// Map quote status to stage for context
function resolveStage(pipelineStage: string, quoteStatus: string): string {
  if (quoteStatus === 'sent') return 'sent';
  if (quoteStatus === 'negociacao') return 'negociacao';
  if (quoteStatus === 'approved') return 'approved';
  if (pipelineStage === 'contato_feito') return 'contato_feito';
  if (pipelineStage === 'pre_venda') return 'pre_venda';
  // Derive from pipeline_stage or default
  if (['lead', 'novo'].includes(pipelineStage)) return 'pre_venda';
  return pipelineStage || 'pre_venda';
}

export default function FollowUpGeneratorModal({ open, onOpenChange, client, sellerName, onMarkContacted }: Props) {
  const [suggestion, setSuggestion] = useState<FollowUpSuggestion | null>(null);
  const [editedMessage, setEditedMessage] = useState('');
  const [objection, setObjection] = useState('none');
  const [objective, setObjective] = useState<FollowUpObjective | 'auto'>('auto');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const stage = resolveStage(client.pipeline_stage, client.quoteStatus);
    const tone = determineTone(client.daysAgo);
    const objectionValue = objection === 'none' ? null : objection;
    const resolvedObjective: FollowUpObjective = objective === 'auto'
      ? determineObjective(stage, client.daysAgo, objectionValue)
      : objective;

    const ctx: FollowUpContext = {
      clientName: client.company_name || 'Cliente',
      companyName: client.company_name || '',
      contactName: client.contact_name || '',
      currentStage: stage,
      daysWithoutInteraction: client.daysAgo,
      lastInteraction: client.last_interaction_at,
      objectionReason: objectionValue,
      quoteValue: client.quoteValue,
      sellerName,
      tone,
      objective: resolvedObjective,
      quoteNumber: client.quoteNumber,
    };

    const result = generateFollowUp(ctx);
    setSuggestion(result);
    setEditedMessage(result.message);
    setCopied(false);
  };

  useEffect(() => {
    if (open) {
      generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleRegenerate = () => {
    generate();
    toast.info('Nova sugestão gerada');
  };

  const stage = resolveStage(client.pipeline_stage, client.quoteStatus);
  const stageLabels: Record<string, string> = {
    pre_venda: 'Pré-venda',
    contato_feito: 'Contato Feito',
    sent: 'Proposta Enviada',
    negociacao: 'Negociação',
    approved: 'Fechado',
  };

  const catConfig = suggestion ? categoryConfig[suggestion.category] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Follow-up Inteligente
          </DialogTitle>
        </DialogHeader>

        {/* Context summary */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{client.company_name || 'Cliente'}</span>
            <Badge variant="outline" className="text-[10px]">{stageLabels[stage] || stage}</Badge>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
            <span>⏱️ {client.daysAgo} dias sem contato</span>
            {client.quoteNumber && <span>📄 {client.quoteNumber}</span>}
            {client.quoteValue > 0 && (
              <span>💰 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.quoteValue)}</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Objeção do cliente</Label>
            <Select value={objection} onValueChange={(v) => { setObjection(v); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {objectionOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivo</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                {Object.entries(objectiveLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" /> Gerar nova sugestão
        </Button>

        {/* Suggestion */}
        {suggestion && (
          <div className="space-y-3">
            {/* Meta badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {catConfig && (
                <Badge className={`${catConfig.color} text-[10px]`}>
                  {catConfig.label}
                </Badge>
              )}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Target className="h-3 w-3" /> {suggestion.intention}
              </div>
            </div>

            {/* Editable message */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Mensagem sugerida
              </Label>
              <Textarea
                value={editedMessage}
                onChange={e => setEditedMessage(e.target.value)}
                className="min-h-[120px] text-sm"
              />
            </div>

            {/* CTA suggestion */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-primary">CTA recomendado</p>
                <p className="text-xs text-muted-foreground">{suggestion.cta}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar mensagem'}
              </Button>
              <Button variant="outline" className="gap-2" onClick={onMarkContacted}>
                <Phone className="h-4 w-4" /> Contatado
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
