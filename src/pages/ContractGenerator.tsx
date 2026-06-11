import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Copy, Eye, History, FileDown, Printer, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { cn } from '@/lib/utils';

const mciData = {
  name: "MCI - Multi Comercial e Importadora LTDA",
  headquarters: {
    cnpj: "05.502.390/0001-11",
    address: "Rua Senador Pompeu, 1547, Centro, Fortaleza/CE"
  },
  branches: [
    { id: 'itajai', cnpj: "05.502.390/0002-00", label: "Armazém Itajaí/CE" },
    { id: 'sp', cnpj: "05.502.390/0003-83", label: "São Paulo/SP" }
  ]
};

const initialClient = {
  name: 'GH FILMES LTDA',
  document: '19.272.623/0001-41',
  city: 'Toledo/PR',
  responsible: 'Marcus Lima',
  phone: '45 99133-9206',
  email: 'marcus@ghfilmes.com.br'
};

const initialProducts = [
  { name: 'DZOFilm Kit 6 Lentes Arles 18, 25, 35, 50, 75 e 100 mm FF/VV Prime Cine (ARRI PL)', description: 'Kit completo de lentes de cinema', quantity: 1, value: 115551, observations: '' },
  { name: 'DZOFILM Arcana Anamorphic Prime Kit - 3 Lentes 32mm + 45mm + 75mm (ARRI PL, Titanium)', description: 'Kit anamórfico premium', quantity: 1, value: 0, observations: '' }
];

export default function ContractGenerator() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  const [formData, setFormData] = useState<any>({
    client: { ...initialClient },
    products: [...initialProducts],
    commercial: {
      total_value: 115551,
      delivery_forecast: 'final de julho, conforme chegada da encomenda destinada ao cliente',
      payment_terms: 'A combinar',
      notes: '',
      additional_clauses: ''
    },
    mci_branch: 'matriz'
  });


  useEffect(() => {
    fetchContracts();
    fetchTemplates();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('generated_contracts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContracts(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar contratos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('active', true);
      if (error) throw error;
      setTemplates(data || []);
      if (data && data.length > 0) setSelectedTemplate(data[0].id);
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { name: '', description: '', quantity: 1, value: 0, observations: '' }]
    });
  };

  const removeProduct = (index: number) => {
    const newProducts = [...formData.products];
    newProducts.splice(index, 1);
    setFormData({ ...formData, products: newProducts });
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const newProducts = [...formData.products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setFormData({ ...formData, products: newProducts });
  };

  const handleSave = async (status: string = 'rascunho') => {
    if (!user || !profile?.company_id) {
      toast.error('Sessão inválida ou empresa não vinculada ao perfil.');
      console.error('Missing auth info:', { user: !!user, company_id: profile?.company_id });
      return;
    }

    setSaving(true);
    const contractPayload = {
      company_id: profile.company_id,
      client_name: formData.client.name,
      client_document: formData.client.document,
      responsible_name: formData.client.responsible,
      responsible_phone: formData.client.phone,
      total_value: formData.commercial.total_value,
      delivery_forecast: formData.commercial.delivery_forecast,
      status: status,
      contract_data_json: formData,
      created_by: user.id
    };

    console.log('Tentando salvar contrato:', contractPayload);

    try {
      const { data, error } = await supabase
        .from('generated_contracts')
        .insert(contractPayload)
        .select();

      if (error) {
        console.error('Erro detalhado Supabase:', error);
        throw error;
      }
      
      console.log('Contrato salvo com sucesso:', data);
      toast.success('Contrato gerado com sucesso!');
      setView('list');
      fetchContracts();
    } catch (error: any) {
      console.error('Catch error:', error);
      toast.error('Erro ao salvar contrato: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = (contract: any) => {
    const data = contract.contract_data_json || formData;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header text representation of logo
    doc.setFontSize(22);
    doc.setTextColor(15, 43, 38);
    doc.text("MCI STORE", pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(mciData.name, pageWidth / 2, 28, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, pageWidth - 20, 35);

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATO DE PRÉ-VENDA E ENTREGA FUTURA", pageWidth / 2, 45, { align: 'center' });

    // Client Info
    doc.setFontSize(11);
    doc.text("DADOS DO CLIENTE", 20, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Razão Social: ${data.client.name}`, 20, 68);
    doc.text(`CNPJ: ${data.client.document}`, 20, 74);
    doc.text(`Cidade/UF: ${data.client.city}`, 20, 80);
    doc.text(`Responsável: ${data.client.responsible}`, 20, 86);
    doc.text(`Contato: ${data.client.phone} | ${data.client.email}`, 20, 92);

    // Products Table
    doc.setFont("helvetica", "bold");
    doc.text("EQUIPAMENTOS / PRODUTOS", 20, 105);
    
    const tableData = data.products.map((p: any) => [
      p.name,
      p.description,
      p.quantity,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value)
    ]);

    (doc as any).autoTable({
      startY: 110,
      head: [['Equipamento', 'Descrição', 'Qtd', 'Valor']],

      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 43, 38] },
      styles: { fontSize: 8 }
    });

    // Commercial Conditions
    const finalY = (doc as any).lastAutoTable.cursor.y + 15;
    doc.setFont("helvetica", "bold");
    doc.text("CONDIÇÕES COMERCIAIS", 20, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Valor Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.commercial.total_value)}`, 20, finalY + 8);
    doc.text(`Previsão de Entrega: ${data.commercial.delivery_forecast}`, 20, finalY + 14);
    doc.text(`Forma de Pagamento: ${data.commercial.payment_terms}`, 20, finalY + 20);

    // Signatures
    const sigY = finalY + 50;
    doc.line(20, sigY, 90, sigY);
    doc.text("Representante MCI", 35, sigY + 5);
    
    doc.line(pageWidth - 90, sigY, pageWidth - 20, sigY);
    doc.text("Representante do Cliente", pageWidth - 75, sigY + 5);
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("O cliente poderá assinar a punho ou via GOV/assinatura digital.", pageWidth / 2, sigY + 20, { align: 'center' });

    doc.save(`Contrato_${data.client.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-emerald-600" />
              Gerador de Contratos
            </h1>
            <p className="text-muted-foreground">Crie e gerencie contratos institucionais da MCI</p>
          </div>
          {view === 'list' ? (
            <Button onClick={() => setView('create')} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> Novo Contrato
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setView('list')}>
              <History className="h-4 w-4 mr-2" /> Histórico
            </Button>
          )}
        </div>

        {view === 'list' ? (
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum contrato gerado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="text-xs">{format(new Date(contract.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="font-medium text-sm">{contract.client_name}</TableCell>
                        <TableCell className="text-sm font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.total_value)}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                            contract.status === 'rascunho' && "bg-gray-100 text-gray-700 border-gray-200",
                            contract.status === 'enviado' && "bg-blue-100 text-blue-700 border-blue-200",
                            contract.status === 'assinado' && "bg-emerald-100 text-emerald-700 border-emerald-200"
                          )}>
                            {contract.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => generatePDF(contract)} title="Baixar PDF">
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Duplicar">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Dados do Cliente</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs">Razão Social</Label><Input className="h-9" value={formData.client.name} onChange={e => setFormData({...formData, client: {...formData.client, name: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">CNPJ</Label><Input className="h-9" value={formData.client.document} onChange={e => setFormData({...formData, client: {...formData.client, document: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Cidade/UF</Label><Input className="h-9" value={formData.client.city} onChange={e => setFormData({...formData, client: {...formData.client, city: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Responsável</Label><Input className="h-9" value={formData.client.responsible} onChange={e => setFormData({...formData, client: {...formData.client, responsible: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input className="h-9" value={formData.client.phone} onChange={e => setFormData({...formData, client: {...formData.client, phone: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input className="h-9" value={formData.client.email} onChange={e => setFormData({...formData, client: {...formData.client, email: e.target.value}})} /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">Produtos</CardTitle><Button variant="outline" size="sm" onClick={addProduct}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button></CardHeader>
                <CardContent className="space-y-3">
                  {formData.products.map((product: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-md relative grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/20">
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-red-500" onClick={() => removeProduct(idx)}><Trash2 className="h-4 w-4" /></Button>
                      <div className="md:col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome do Equipamento</Label><Input className="h-8 text-sm" value={product.name} onChange={e => updateProduct(idx, 'name', e.target.value)} /></div>
                      <div className="md:col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Descrição</Label><Input className="h-8 text-sm" value={product.description} onChange={e => updateProduct(idx, 'description', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Qtd</Label><Input className="h-8 text-sm" type="number" value={product.quantity} onChange={e => updateProduct(idx, 'quantity', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor Unitário</Label><Input className="h-8 text-sm" type="number" value={product.value} onChange={e => updateProduct(idx, 'value', parseFloat(e.target.value))} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Comercial</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-xs">Valor Total</Label><Input className="h-9 font-bold text-emerald-700" type="number" value={formData.commercial.total_value} onChange={e => setFormData({...formData, commercial: {...formData.commercial, total_value: parseFloat(e.target.value)}})} /></div>
                    <div className="space-y-1"><Label className="text-xs">Entrega Estimada</Label><Input className="h-9" value={formData.commercial.delivery_forecast} onChange={e => setFormData({...formData, commercial: {...formData.commercial, delivery_forecast: e.target.value}})} /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Forma de Pagamento</Label><Input className="h-9" value={formData.commercial.payment_terms} onChange={e => setFormData({...formData, commercial: {...formData.commercial, payment_terms: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-xs">Cláusulas Adicionais</Label><Textarea className="text-sm" value={formData.commercial.additional_clauses} onChange={e => setFormData({...formData, commercial: {...formData.commercial, additional_clauses: e.target.value}})} /></div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-emerald-50/30 border-emerald-100">
                <CardHeader><CardTitle className="text-md">Configurações MCI</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1"><Label className="text-xs">Template</Label><Select value={selectedTemplate} onValueChange={setSelectedTemplate}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Unidade</Label><Select value={formData.mci_branch} onValueChange={v => setFormData({...formData, mci_branch: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="matriz">Matriz - Fortaleza/CE</SelectItem><SelectItem value="itajai">Filial - Itajaí/CE</SelectItem><SelectItem value="sp">Filial - São Paulo/SP</SelectItem></SelectContent></Select></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-md">Conclusão</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-11" onClick={() => handleSave('enviado')} disabled={saving}>{saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}Gerar Contrato</Button>
                  <Button variant="outline" className="w-full" onClick={() => handleSave('rascunho')} disabled={saving}>Salvar Rascunho</Button>
                  <Button variant="secondary" className="w-full" onClick={() => generatePDF(formData)}><Eye className="h-4 w-4 mr-2" /> Prévia PDF</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
