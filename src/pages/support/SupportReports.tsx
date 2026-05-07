import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  Download, 
  FileText, 
  PieChart, 
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SupportReports() {
  const reportTypes = [
    { title: 'Ordens de Serviço por Status', description: 'Volume total de OS por cada etapa do fluxo.', icon: PieChart },
    { title: 'Faturamento Mensal', description: 'Relatório financeiro de mão de obra e peças.', icon: TrendingUp },
    { title: 'Performance por Técnico', description: 'Tempo médio de reparo e produtividade.', icon: BarChart3 },
    { title: 'Giro de Estoque', description: 'Uso de peças e necessidade de reposição.', icon: FileText },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Relatórios Técnicos</h1>
          <p className="text-sm text-muted-foreground">Análise de dados e performance da assistência</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Este Mês
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Mais Filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report, idx) => (
          <Card key={idx} className="group hover:border-primary/50 transition-all cursor-pointer border-border shadow-sm">
            <CardHeader className="flex flex-row items-start gap-4 pb-2">
              <div className="p-3 bg-muted rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <report.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{report.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
              </div>
            </CardHeader>
            <CardContent className="flex justify-end pt-4 border-t border-border/50">
              <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary hover:bg-primary/5">
                <Download className="h-4 w-4" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Relatórios Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Relatorio_Geral_OS_Maio_2024.pdf</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Gerado em 07/05/2024</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Concluído</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
