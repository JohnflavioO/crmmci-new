import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, Lightbulb, Sparkles, MessageSquare, Send, Loader2, Paperclip, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAppVersion } from "@/hooks/useAppVersion";
import {
  sendReportToTaskHub,
  fileToAttachment,
  type ReportType,
  type ReportPriority,
  type ReportAttachment,
} from "@/lib/taskhubClient";

const SOURCE_APP = "crm-mci";

const TYPE_META: Record<ReportType, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: "Bug", icon: Bug, color: "text-red-500" },
  improvement: { label: "Melhoria", icon: Sparkles, color: "text-emerald-500" },
  idea: { label: "Ideia", icon: Lightbulb, color: "text-amber-500" },
  request: { label: "Solicitação", icon: MessageSquare, color: "text-blue-500" },
};

const PATH_TO_MODULE: Array<[RegExp, string]> = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/quotes/, "Orçamentos"],
  [/^\/clients/, "Clientes"],
  [/^\/products/, "Produtos"],
  [/^\/financial/, "Financeiro"],
  [/^\/bank-slips/, "Boletos"],
  [/^\/logistics/, "Logística"],
  [/^\/metrics/, "Métricas"],
  [/^\/inteligencia/, "Inteligência Comercial"],
  [/^\/pipeline/, "Pipeline"],
  [/^\/tasks/, "Tarefas"],
  [/^\/reports/, "Relatórios"],
  [/^\/approvals/, "Aprovações"],
  [/^\/integrations/, "Integrações"],
  [/^\/ajuda/, "Ajuda"],
  [/^\/sobre/, "Sobre"],
  [/^\/suporte/, "Suporte Técnico"],
  [/^\/contracts/, "Contratos"],
  [/^\/ecoflow/, "Calculadora Ecoflow"],
  [/^\/estoque-sc/, "Estoque SC"],
  [/^\/negociacoes/, "Negociações"],
  [/^\/prospect/, "Prospect"],
  [/^\/operational/, "Centro Operacional"],
];

function resolveModule(pathname: string): string {
  for (const [re, label] of PATH_TO_MODULE) if (re.test(pathname)) return label;
  return "Geral";
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function TaskHubReportModal({ open, onOpenChange }: Props) {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { remote, local } = useAppVersion();
  const version = remote?.version || local || null;

  const [type, setType] = useState<ReportType>("bug");
  const [priority, setPriority] = useState<ReportPriority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const moduleName = useMemo(() => resolveModule(location.pathname), [location.pathname]);

  useEffect(() => {
    if (!open) {
      setType("bug");
      setPriority("medium");
      setTitle("");
      setDescription("");
      setFiles([]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    setSubmitting(true);
    try {
      let attachments: ReportAttachment[] = [];
      if (files.length) {
        attachments = await Promise.all(files.map(fileToAttachment));
      }
      const result = await sendReportToTaskHub({
        type,
        title: title.trim(),
        description: description.trim(),
        priority,
        module: moduleName,
        source_app: SOURCE_APP,
        context: {
          user_id: user?.id ?? null,
          user_name: profile?.full_name ?? null,
          user_email: user?.email ?? null,
          user_role: profile?.role ?? null,
          company_id: profile?.company_id ?? null,
          app_version: version ?? null,
          module: moduleName,
        },
        attachments,
      });

      const data = result.data as any;
      if (result.ok) {
        if (data?.mock) {
          toast.success("Registrado localmente — integração TaskHub ainda não está ativa.");
          onOpenChange(false);
        } else {
          const id = data?.card_id || data?.taskhub?.card_id || data?.taskhub?.id || data?.taskhub?.issue_id;
          toast.success(`Card criado no TaskHub com sucesso (#${id})`);
          onOpenChange(false);
        }
      } else {
        const msg =
          data?.message ||
          data?.error ||
          result.error ||
          "Falha ao enviar.";
        toast.error(msg, {
          description: "Solicitação salva como pendente no log local.",
          duration: 8000,
        });
      }
    } catch (e) {
      toast.error(`Falha ao criar card no TaskHub: ${(e as Error).message}`, {
        description: "Solicitação salva como pendente no log local.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar para TaskHub</DialogTitle>
          <DialogDescription>
            Reportar bug, sugerir melhoria, registrar ideia ou abrir solicitação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as ReportType[]).map((k) => {
                    const Icon = TYPE_META[k].icon;
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${TYPE_META[k].color}`} />
                          {TYPE_META[k].label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ReportPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Resumo curto e direto"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={6}
              placeholder="Descreva o que aconteceu, passos para reproduzir, expectativa..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos (até 5)</Label>
            <Input type="file" multiple onChange={onPickFiles} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {files.map((f, i) => (
                  <span key={i} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                    {f.name}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-1 text-muted-foreground">
            <div><strong>Módulo:</strong> {moduleName}</div>
            <div><strong>URL:</strong> {location.pathname}{location.search}</div>
            <div><strong>Usuário:</strong> {profile?.full_name || user?.email || "—"} ({profile?.role || "—"})</div>
            <div><strong>Versão CRM:</strong> {version || "—"}</div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
