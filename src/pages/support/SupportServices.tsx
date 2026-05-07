import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, 
  Search, 
  Plus, 
  Filter,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface Service {
  id: string;
  name: string;
  description: string;
  base_price: number;
  estimated_time: string;
  category: string;
}

export default function SupportServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Serviços Técnicos</h1>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de serviços e mão de obra</p>
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou categoria..." 
            className="pl-9 bg-background border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-10 px-4">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-border shadow-sm">
              <CardContent className="h-48" />
            </Card>
          ))
        ) : filteredServices.length > 0 ? (
          filteredServices.map((service) => (
            <Card key={service.id} className="group hover:border-primary/50 transition-all border-border shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold">
                    {service.category || 'Geral'}
                  </Badge>
                  <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                    {service.name}
                  </CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="gap-2">
                      <Edit className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-rose-600 focus:text-rose-600">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">
                  {service.description || 'Sem descrição cadastrada.'}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {service.estimated_time || '--'}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    R$ {Number(service.base_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Wrench className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Nenhum serviço encontrado</p>
              <p className="text-sm text-muted-foreground">Tente ajustar sua busca ou cadastrar um novo serviço.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
