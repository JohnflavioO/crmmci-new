import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  FileText, 
  Building2, 
  UserCircle,
  Filter,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const OS_STATUS_DATA = [
  { name: 'Aguardando Peças', value: 0, color: '#f59e0b' },
  { name: 'Em Manutenção', value: 0, color: '#3b82f6' },
  { name: 'Finalizado', value: 0, color: '#10b981' },
  { name: 'Entregue', value: 0, color: '#6366f1' },
];

const RECURRENT_FAILURES = [
  { name: 'Nenhuma falha registrada', total: 0 },
];

const MOST_MAINTAINED = [
  { name: 'Sem dados', total: 0 },
];

const MOST_USED_PRODUCTS = [];

const OS_BY_CATEGORY = [
  { name: 'Garantia', value: 0, color: '#ec4899' },
  { name: 'Orçamento', value: 0, color: '#8b5cf6' },
  { name: 'Cortesia', value: 0, color: '#ef4444' },
];

export default function SupportReports() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Relatórios Técnicos</h1>
        <p className="text-sm text-muted-foreground">Visão geral e performance da assistência técnica</p>
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="tech">Técnico</Label>
              <Select>
                <SelectTrigger id="tech">
                  <SelectValue placeholder="Selecione o Técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Técnicos</SelectItem>
                  <SelectItem value="1">João Silva</SelectItem>
                  <SelectItem value="2">Maria Santos</SelectItem>
                  <SelectItem value="3">Ricardo Oliveira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">Início</Label>
              <Input type="date" id="start-date" defaultValue="2024-05-01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Final</Label>
              <Input type="date" id="end-date" defaultValue="2024-05-07" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700">
                <Filter className="h-4 w-4" />
                Filtrar
              </Button>
              <Button variant="outline" className="flex-1 gap-2 border-border">
                <X className="h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
            <div className="hidden md:block"></div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-border shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Produtividade por Técnico
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-2">
              {[
                { name: 'João Silva', val: 85 },
                { name: 'Maria Santos', val: 72 },
                { name: 'Ricardo Oliveira', val: 64 },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{item.name}</span>
                    <span>{item.val}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-border shadow-sm flex flex-col justify-center items-center p-6">
          <div className="p-3 bg-green-50 rounded-full mb-3">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <span className="text-3xl font-bold">40</span>
          <span className="text-xs font-bold uppercase text-muted-foreground mt-1">Ordens de Serviços</span>
        </Card>

        <Card className="bg-white border-border shadow-sm flex flex-col justify-center items-center p-6">
          <div className="p-3 bg-purple-50 rounded-full mb-3">
            <Building2 className="h-6 w-6 text-purple-600" />
          </div>
          <span className="text-3xl font-bold">12</span>
          <span className="text-xs font-bold uppercase text-muted-foreground mt-1">Empresa</span>
        </Card>

        <Card className="bg-white border-border shadow-sm flex flex-col justify-center items-center p-6">
          <div className="p-3 bg-orange-50 rounded-full mb-3">
            <UserCircle className="h-6 w-6 text-orange-600" />
          </div>
          <span className="text-3xl font-bold">85</span>
          <span className="text-xs font-bold uppercase text-muted-foreground mt-1">Contatos</span>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Status das O.S. */}
        <Card className="border-border shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">STATUS DAS O.S.</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={OS_STATUS_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {OS_STATUS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Falhas Recorrentes */}
        <Card className="border-border shadow-sm col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Falhas Recorrentes</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RECURRENT_FAILURES} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Equipamentos que mais dão manutenção */}
        <Card className="border-border shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">EQUIPAMENTOS QUE MAIS DÃO MANUTENÇÃO</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOST_MAINTAINED}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Produtos mais utilizados */}
        <Card className="border-border shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Produtos Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-2 space-y-4">
              {MOST_USED_PRODUCTS.map((product, i) => (
                <div key={i} className="flex items-center justify-between border-b border-muted pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Consumo: {product.total} un.</span>
                  </div>
                  <div className="p-1.5 bg-muted rounded-md font-mono text-xs font-bold text-primary">
                    #{i + 1}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* O.S. por Categoria */}
        <Card className="border-border shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">O.S. por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={OS_BY_CATEGORY}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {OS_BY_CATEGORY.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
