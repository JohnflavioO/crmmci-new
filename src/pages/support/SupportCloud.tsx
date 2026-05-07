import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Cloud, 
  Search, 
  Upload, 
  File, 
  FileText, 
  Image as ImageIcon,
  MoreVertical,
  Download,
  Trash2,
  FolderOpen
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

interface CloudFile {
  id: string;
  name: string;
  category: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

export default function SupportCloud() {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_cloud_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching cloud files:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const getFileIcon = (type: string) => {
    if (type?.includes('pdf')) return <FileText className="h-6 w-6 text-rose-500" />;
    if (type?.includes('image')) return <ImageIcon className="h-6 w-6 text-blue-500" />;
    return <File className="h-6 w-6 text-muted-foreground" />;
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Nuvem Técnica</h1>
          <p className="text-sm text-muted-foreground">Manuais, firmwares e esquemas elétricos</p>
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Upload className="h-4 w-4" />
          Upload de Arquivo
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-border shadow-sm h-32" />
          ))
        ) : filteredFiles.length > 0 ? (
          filteredFiles.map((file) => (
            <Card key={file.id} className="group hover:border-primary/50 transition-all border-border shadow-sm">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  {getFileIcon(file.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{file.name}</h4>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">{file.category || 'Outros'}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="gap-2" onClick={() => window.open(file.file_url, '_blank')}>
                      <Download className="h-4 w-4" /> Download
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-rose-600 focus:text-rose-600">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Nenhum arquivo encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
