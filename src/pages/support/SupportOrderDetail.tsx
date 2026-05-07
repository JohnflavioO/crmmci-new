import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';
import { STATUS_OPTIONS } from './SupportOrders';

export default function SupportOrderDetail() {
  const { id } = useParams();
  const [os, setOs] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('technical_orders' as any).select('*').eq('id', id).maybeSingle();
    setOs(data);
    const { data: h } = await supabase.from('technical_status_history' as any).select('*').eq('order_id', id).order('created_at', { ascending: false });
    setHistory((h || []) as any[]);
  };
  useEffect(() => { if (id) load(); }, [id]);

  const update = async (patch: any) => {
    const total = Number(patch.parts_value ?? os.parts_value) + Number(patch.labor_value ?? os.labor_value) + Number(patch.shipping_value ?? os.shipping_value);
    const { error } = await supabase.from('technical_orders' as any).update({ ...patch, total_value: total }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Atualizado');
    load();
  };

  if (!os) return <p>Carregando...</p>;

  const trackingUrl = `${window.location.origin}/rastreamento/os/${os.public_token}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{os.os_number}</h1>
          <p className="text-sm text-muted-foreground">{os.client_name} · {os.equipment}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{STATUS_OPTIONS.find(s => s.key === os.status)?.label}</Badge>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(trackingUrl); toast.success('Link copiado'); }}>
            <Copy className="h-3 w-3 mr-1" />Link rastreio
          </Button>
          <a href={trackingUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" />Abrir</Button>
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Equipamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Marca</Label><Input defaultValue={os.brand} onBlur={e => update({ brand: e.target.value })} /></div>
            <div><Label>Modelo</Label><Input defaultValue={os.model} onBlur={e => update({ model: e.target.value })} /></div>
            <div><Label>Serial</Label><Input defaultValue={os.serial} onBlur={e => update({ serial: e.target.value })} /></div>
            <div><Label>Defeito Relatado</Label><Textarea defaultValue={os.reported_defect} onBlur={e => update({ reported_defect: e.target.value })} /></div>
            <div><Label>Diagnóstico Técnico</Label><Textarea defaultValue={os.technical_diagnosis} onBlur={e => update({ technical_diagnosis: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status & Valores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={os.status} onValueChange={v => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Peças</Label><Input type="number" step="0.01" defaultValue={os.parts_value} onBlur={e => update({ parts_value: Number(e.target.value) })} /></div>
              <div><Label>Mão de obra</Label><Input type="number" step="0.01" defaultValue={os.labor_value} onBlur={e => update({ labor_value: Number(e.target.value) })} /></div>
              <div><Label>Frete</Label><Input type="number" step="0.01" defaultValue={os.shipping_value} onBlur={e => update({ shipping_value: Number(e.target.value) })} /></div>
            </div>
            <div className="text-right text-lg font-bold">Total: R$ {Number(os.total_value || 0).toFixed(2)}</div>
            <div><Label>Garantia</Label><Input defaultValue={os.warranty} onBlur={e => update({ warranty: e.target.value })} /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 text-sm border-l-2 border-primary pl-3 py-1">
                <Badge variant="outline">{STATUS_OPTIONS.find(s => s.key === h.new_status)?.label || h.new_status}</Badge>
                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                {h.performed_by_name && <span>por {h.performed_by_name}</span>}
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
