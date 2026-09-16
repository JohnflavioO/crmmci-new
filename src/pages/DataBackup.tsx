import { useState } from 'react';
import { Archive, CheckCircle2, Database, Download, Loader2, ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BACKUP_TABLES = [
  { name: 'quotes', label: 'Propostas' },
  { name: 'quote_items', label: 'Itens das propostas' },
  { name: 'clients', label: 'Clientes' },
  { name: 'products', label: 'Produtos' },
  { name: 'profiles', label: 'Vendedores' },
] as const;

const PAGE_SIZE = 500;
const PRIVATE_FIELD = /(password|secret|token|credential|api[_-]?key)/i;

function removePrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removePrivateFields);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !PRIVATE_FIELD.test(key))
        .map(([key, nestedValue]) => [key, removePrivateFields(nestedValue)]),
    );
  }
  return value;
}

async function fetchAllRows(table: string) {
  const rows: unknown[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as unknown[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return removePrivateFields(rows);
}

export default function DataBackup() {
  const { isAdmin, isGestor, profile } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [lastBackup, setLastBackup] = useState<{ date: Date; total: number } | null>(null);

  if (!isAdmin && !isGestor) return null;

  const createBackup = async () => {
    setRunning(true);
    setProgress(0);
    setLastBackup(null);

    try {
      const exportedAt = new Date();
      const tables: Record<string, unknown> = {};
      const counts: Record<string, number> = {};
      let total = 0;

      for (let index = 0; index < BACKUP_TABLES.length; index += 1) {
        const table = BACKUP_TABLES[index];
        setCurrentTable(table.label);
        const rows = await fetchAllRows(table.name);
        tables[table.name] = rows;
        const count = Array.isArray(rows) ? rows.length : 0;
        counts[table.name] = count;
        total += count;
        setProgress(Math.round(((index + 1) / BACKUP_TABLES.length) * 100));
      }

      const backup = {
        format: 'mci-crm-backup',
        version: 1,
        exported_at: exportedAt.toISOString(),
        company_id: profile?.company_id ?? null,
        counts,
        tables,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-mci-${exportedAt.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setLastBackup({ date: exportedAt, total });
      toast.success(`Backup concluído com ${total.toLocaleString('pt-BR')} registros`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível gerar o backup';
      toast.error(message);
      setProgress(0);
    } finally {
      setRunning(false);
      setCurrentTable('');
    }
  };

  return (
    <AppLayout>
      <main className="mx-auto max-w-5xl space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Backup de dados</h1>
              <p className="text-sm text-muted-foreground">Exporte uma cópia segura dos dados comerciais da empresa.</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border bg-card p-4">
            <FileSummary icon={Archive} title="Conteúdo" text="Propostas, clientes e produtos" />
          </div>
          <div className="rounded-md border bg-card p-4">
            <FileSummary icon={ShieldCheck} title="Segurança" text="Sem senhas, tokens ou credenciais" />
          </div>
          <div className="rounded-md border bg-card p-4">
            <FileSummary icon={Download} title="Destino" text="Arquivo salvo somente neste dispositivo" />
          </div>
        </section>

        <section className="rounded-md border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Backup comercial completo</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Inclui propostas e seus itens, clientes dos vendedores, produtos e cadastros comerciais visíveis para sua empresa.
              </p>
            </div>
            <Button onClick={createBackup} disabled={running} className="shrink-0 gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {running ? 'Gerando backup' : 'Baixar backup'}
            </Button>
          </div>

          {running && (
            <div className="mt-6 space-y-2" aria-live="polite">
              <div className="flex justify-between text-sm">
                <span>Exportando {currentTable}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {lastBackup && (
            <Alert className="mt-6 border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Backup concluído</AlertTitle>
              <AlertDescription>
                {lastBackup.total.toLocaleString('pt-BR')} registros exportados em {lastBackup.date.toLocaleString('pt-BR')}.
              </AlertDescription>
            </Alert>
          )}
        </section>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Uso econômico e seguro</AlertTitle>
          <AlertDescription>
            Esta função não usa inteligência artificial nem mantém cópias extras na nuvem. O custo ocorre apenas durante a leitura solicitada.
          </AlertDescription>
        </Alert>
      </main>
    </AppLayout>
  );
}

function FileSummary({ icon: Icon, title, text }: { icon: typeof Archive; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 text-primary" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}