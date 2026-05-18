import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, Clock, CheckCircle2, TrendingUp, Users, 
  DollarSign, Wrench, MessageSquare, ArrowRight,
  Zap, Calendar, Package, ClipboardList
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;

export default function OperationalCenter() {
  const { user, profile, isAdmin, isGestor, isFinanceiro, isSupport } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // States for different roles
  const [sellerData, setSellerData] = useState<any>(null);
  const [managerData, setManagerData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [supportData, setSupportData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      setLoading(true);
      try {
        if (isFinanceiro || isAdmin || isGestor) {
          const { data: slips } = await db.from('bank_slips').select('*').in('status', ['A vencer', 'Vencido', 'Vence hoje']);
          setFinanceData({ slips });
        }
        
        if (isSupport || isAdmin || isGestor) {
          const { data: orders } = await db.from('technical_orders').select('*').not('status', 'eq', 'entregue').not('status', 'eq', 'cancelado');
          setSupportData({ orders });
        }

        if (isGestor || isAdmin) {
          // Manager specific data
          const { data: stuckQuotes } = await db.from('quotes').select('*, clients(company_name)').in('status', ['sent', 'negociacao', 'negotiation']).order('updated_at', { ascending: true }).limit(10);
          setManagerData({ stuckQuotes });
        }

        // Always load seller data for the logged user if they are a seller
        const { data: myQuotes } = await db.from('quotes').select('*, clients(company_name)').eq('created_by', user.id).in('status', ['sent', 'negociacao', 'negotiation', 'draft']);
        
        const overdueFollowups = myQuotes?.filter((q: any) => {
          if (!q.followup_date) return false;
          return new Date(q.followup_date) < new Date();
        });

        const noResponseProposals = myQuotes?.filter((q: any) => {
          if (q.status !== 'sent') return false;
          const days = differenceInDays(new Date(), new Date(q.updated_at));
          return days >= 3;
        });

        setSellerData({
          overdueFollowups,
          noResponseProposals
        });

      } catch (error) {
        console.error("Error loading operational data:", error);
        toast.error("Erro ao carregar dados operacionais");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.id, isAdmin, isGestor, isFinanceiro, isSupport]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display text-primary flex items-center gap-2">
              <Zap className="h-8 w-8 text-amber-500 fill-amber-500" />
              Central Operacional
            </h1>
            <p className="text-muted-foreground mt-1">
              Bem-vindo, <span className="font-semibold text-foreground">{profile?.full_name || 'Usuário'}</span>. Aqui estão suas prioridades de hoje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 text-xs bg-primary/5 border-primary/20">
              {isAdmin ? "Administrador" : isGestor ? "Gestor" : isFinanceiro ? "Financeiro" : isSupport ? "Suporte" : "Vendedor"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* SELLER SECTION */}
          {(true) && ( // Basic version shows some for everyone
            <>
              <OperationalCard 
                title="Follow-ups Atrasados"
                count={sellerData?.overdueFollowups?.length || 0}
                priority={sellerData?.overdueFollowups?.length > 0 ? "urgent" : "normal"}
                icon={Clock}
                description="Contatos agendados que já passaram da data"
                items={sellerData?.overdueFollowups?.map((q: any) => ({
                  id: q.id,
                  title: q.clients?.company_name || q.client_name,
                  subtitle: `Venceu em ${format(new Date(q.followup_date), 'dd/MM')}`,
                  action: () => window.location.href = `/quotes?id=${q.id}`
                }))}
              />

              <OperationalCard 
                title="Propostas sem Retorno"
                count={sellerData?.noResponseProposals?.length || 0}
                priority={sellerData?.noResponseProposals?.length > 5 ? "attention" : "normal"}
                icon={MessageSquare}
                description="Enviadas há mais de 3 dias sem interação"
                items={sellerData?.noResponseProposals?.map((q: any) => ({
                  id: q.id,
                  title: q.clients?.company_name || q.client_name,
                  subtitle: `${differenceInDays(new Date(), new Date(q.updated_at))} dias parado`,
                  action: () => window.location.href = `/quotes?id=${q.id}`
                }))}
              />
            </>
          )}

          {/* FINANCE SECTION */}
          {(isFinanceiro || isGestor || isAdmin) && (
            <OperationalCard 
              title="Boletos Vencendo/Vencidos"
              count={financeData?.slips?.filter((s: any) => s.status === 'Vencido' || s.status === 'Vence hoje').length || 0}
              priority={financeData?.slips?.some((s: any) => s.status === 'Vencido') ? "urgent" : "attention"}
              icon={DollarSign}
              description="Títulos que exigem cobrança imediata"
              items={financeData?.slips?.filter((s: any) => s.status === 'Vencido' || s.status === 'Vence hoje').slice(0, 5).map((s: any) => ({
                id: s.id,
                title: s.client_name,
                subtitle: `${s.status}: R$ ${s.updated_amount.toLocaleString('pt-BR')}`,
                action: () => window.location.href = `/bank-slips`
              }))}
            />
          )}

          {/* SUPPORT SECTION */}
          {(isSupport || isGestor || isAdmin) && (
            <OperationalCard 
              title="Ordens de Serviço em Aberto"
              count={supportData?.orders?.length || 0}
              priority={supportData?.orders?.length > 10 ? "attention" : "normal"}
              icon={Wrench}
              description="Equipamentos aguardando manutenção ou peças"
              items={supportData?.orders?.slice(0, 5).map((o: any) => ({
                id: o.id,
                title: `${o.equipment} - ${o.client_name}`,
                subtitle: `Status: ${o.status}`,
                action: () => window.location.href = `/suporte/os/${o.id}`
              }))}
            />
          )}

          {/* MANAGER SECTION */}
          {(isGestor || isAdmin) && (
            <OperationalCard 
              title="Negociações Travadas"
              count={managerData?.stuckQuotes?.length || 0}
              priority="attention"
              icon={AlertTriangle}
              description="Oportunidades do time sem movimentação"
              items={managerData?.stuckQuotes?.slice(0, 5).map((q: any) => ({
                id: q.id,
                title: q.clients?.company_name || q.client_name,
                subtitle: `Atualizado: ${format(new Date(q.updated_at), 'dd/MM')}`,
                action: () => window.location.href = `/quotes?id=${q.id}`
              }))}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function OperationalCard({ title, count, priority, icon: Icon, description, items }: any) {
  const priorityColors = {
    urgent: "bg-red-500 text-white border-red-600",
    attention: "bg-amber-500 text-white border-amber-600",
    normal: "bg-emerald-500 text-white border-emerald-600"
  };

  const priorityGlow = {
    urgent: "shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]",
    attention: "shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]",
    normal: "shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
  };

  return (
    <Card className={cn("overflow-hidden border-2 transition-all duration-300 hover:shadow-lg", priorityGlow[priority as keyof typeof priorityGlow])}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-lg bg-primary/5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <Badge className={cn("text-lg font-bold px-3 py-1", priorityColors[priority as keyof typeof priorityColors])}>
            {count}
          </Badge>
        </div>
        <CardTitle className="text-xl mt-2 font-display">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items && items.length > 0 ? (
            items.map((item: any) => (
              <div 
                key={item.id} 
                className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={item.action}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all text-primary" />
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-20" />
              <p className="text-xs text-muted-foreground">Tudo em dia!</p>
            </div>
          )}
          
          {count > (items?.length || 0) && (
            <Button variant="ghost" className="w-full text-xs h-8 mt-2 text-muted-foreground hover:text-primary">
              Ver todos os {count} itens
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
