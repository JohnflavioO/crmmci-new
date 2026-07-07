import QRCode from 'qrcode';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatDate = (d?: string | Date) => {
  if (!d) return new Date().toLocaleDateString('pt-BR');
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('pt-BR');
};

const COMPANY = {
  name: 'MCI Assistência Técnica',
  legal: 'MCI Câmera e Iluminação',
  cnpj: '05.502.390/0003-83',
  address: 'Av. Imperatriz Leopoldina, 1718 - 2º andar - Vila Leopoldina - São Paulo/SP - CEP 05305-003',
  phone: '+55 (11) 3641-9013',
  email: 'suporte@mci.com.br',
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo'));
      img.src = '/mci-logo-quote.png';
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function drawHeader(doc: any, title: string) {
  const W = 210;
  const margin = 12;
  const logo = await loadLogoDataUrl();
  if (logo) {
    const logoH = 14;
    const logoW = 30;
    try { doc.addImage(logo, 'PNG', margin, 10, logoW, logoH); } catch {}
  }
  // Company block right
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 128, 128);
  doc.text(COMPANY.name, W - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(70);
  doc.text(COMPANY.address, W - margin, 17, { align: 'right' });
  doc.text(`CNPJ: ${COMPANY.cnpj}   ·   Tel: ${COMPANY.phone}`, W - margin, 20.5, { align: 'right' });
  doc.text(COMPANY.email, W - margin, 24, { align: 'right' });

  // Title bar
  doc.setFillColor(0, 150, 136);
  doc.rect(0, 30, W, 9, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, W / 2, 36.5, { align: 'center' });
  doc.setTextColor(0);
}

function drawSectionTitle(doc: any, y: number, text: string) {
  const W = 210, margin = 12;
  doc.setFillColor(238, 246, 245);
  doc.setDrawColor(0, 150, 136);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, W - margin * 2, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 110, 100);
  doc.text(text.toUpperCase(), margin + 2, y + 4);
  doc.setTextColor(0);
  return y + 8;
}

function labelValueGrid(
  doc: any,
  startY: number,
  rows: Array<Array<[string, string]>>
): number {
  const W = 210, margin = 12;
  const colW = (W - margin * 2) / 2;
  let y = startY;
  rows.forEach((row) => {
    row.forEach(([label, value], idx) => {
      const x = margin + idx * colW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(90);
      doc.text(`${label}:`, x + 1, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20);
      const lines = doc.splitTextToSize(String(value || '-'), colW - 4 - doc.getTextWidth(`${label}: `));
      doc.text(lines, x + 1 + doc.getTextWidth(`${label}: `), y);
    });
    y += 5;
  });
  return y + 2;
}

function drawFooter(doc: any, technicianName?: string) {
  const W = 210;
  const H = 297;
  const margin = 12;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.line(margin, H - 18, W - margin, H - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${COMPANY.legal} · CNPJ ${COMPANY.cnpj} · ${COMPANY.phone}`, margin, H - 14);
    if (technicianName) {
      doc.text(`Técnico responsável: ${technicianName}`, margin, H - 10);
    }
    doc.text(`Página ${i}/${pageCount}`, W - margin, H - 10, { align: 'right' });
  }
}

/**
 * PDF de Orçamento Técnico (baseado no modelo Lumen Locadora)
 */
export async function generateTechnicalQuotePdf(
  os: any,
  parts: any[],
  options?: { returnBlob?: boolean }
): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;

  await drawHeader(doc, 'ORÇAMENTO TÉCNICO');
  let y = 44;

  // OS + data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`OS Nº ${os.os_number}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Data: ${formatDate(os.entry_date || os.created_at)}`, W - margin, y, { align: 'right' });
  y += 6;

  // Cliente
  y = drawSectionTitle(doc, y, 'Dados do Cliente');
  y = labelValueGrid(doc, y, [
    [['Cliente', os.client_name || '-'], ['Telefone', os.client_phone || os.phone || '-']],
    [['E-mail', os.client_email || os.email || '-'], ['CPF/CNPJ', os.client_document || '-']],
  ]);

  // Equipamento
  y = drawSectionTitle(doc, y, 'Equipamento');
  y = labelValueGrid(doc, y, [
    [['Equipamento', os.equipment || '-'], ['Marca', os.brand || '-']],
    [['Modelo', os.model || '-'], ['Nº de Série', os.serial || '-']],
  ]);
  const accessories = Array.isArray(os.accessories) ? os.accessories.join(', ') : (os.accessories || '-');
  y = labelValueGrid(doc, y, [
    [['Acessórios recebidos', accessories || '-'], ['Estado físico', os.physical_condition || '-']],
  ]);

  // Defeito e diagnóstico
  y = drawSectionTitle(doc, y, 'Defeito Relatado');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const defectLines = doc.splitTextToSize(os.reported_defect || '-', W - margin * 2 - 2);
  doc.text(defectLines, margin + 1, y);
  y += defectLines.length * 4 + 3;

  y = drawSectionTitle(doc, y, 'Relatório Técnico / Diagnóstico');
  const diagLines = doc.splitTextToSize(os.technical_diagnosis || '-', W - margin * 2 - 2);
  doc.text(diagLines, margin + 1, y);
  y += diagLines.length * 4 + 4;

  // Tabela de peças e serviços
  const rows = (parts || []).map((p: any, i: number) => [
    String(i + 1),
    p.product_code || p.code || '-',
    p.product_name || '-',
    String(p.quantity ?? 1),
    fmt(Number(p.unit_price || 0)),
    fmt(Number(p.total_price || 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Código', 'Descrição', 'Qtd', 'V. Unit.', 'Total']],
    body: rows.length ? rows : [['-', '-', 'Nenhuma peça adicionada', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8, textColor: 30 },
    headStyles: { fillColor: [0, 150, 136], textColor: 255, fontStyle: 'bold', halign: 'left' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totais
  const partsValue = Number(os.parts_value || 0);
  const laborValue = Number(os.labor_value || 0);
  const servicesValue = Number(os.services_value || 0);
  const shippingValue = Number(os.shipping_value || 0);
  const total = Number(os.total_value || (partsValue + laborValue + servicesValue + shippingValue));

  const totalsX = W - margin - 70;
  const totalsW = 70;
  const drawRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.text(label, totalsX + 2, y);
    doc.text(val, totalsX + totalsW - 2, y, { align: 'right' });
    y += bold ? 6 : 4.6;
  };
  drawRow('Subtotal de peças', fmt(partsValue));
  drawRow('Mão de obra', fmt(laborValue));
  if (servicesValue) drawRow('Serviços', fmt(servicesValue));
  if (shippingValue) drawRow('Frete', fmt(shippingValue));
  doc.setDrawColor(0, 150, 136);
  doc.line(totalsX, y - 2, totalsX + totalsW, y - 2);
  doc.setTextColor(0, 110, 100);
  drawRow('TOTAL GERAL', fmt(total), true);
  doc.setTextColor(0);

  y += 2;

  // Condições
  y = drawSectionTitle(doc, y, 'Condições');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const conditions = [
    `Validade do orçamento: 15 dias a partir da data de emissão.`,
    `Garantia dos serviços: ${os.warranty || '90 dias'} sobre os itens efetivamente reparados.`,
    `Prazo estimado de execução após aprovação: conforme disponibilidade de peças.`,
    `Equipamentos não retirados em até 90 dias após aviso poderão ser cobrados por armazenagem.`,
  ];
  conditions.forEach((c) => {
    const lines = doc.splitTextToSize(`• ${c}`, W - margin * 2 - 2);
    doc.text(lines, margin + 1, y);
    y += lines.length * 3.8;
  });

  y += 10;
  // Assinatura
  doc.setDrawColor(120);
  doc.line(margin, y, margin + 80, y);
  doc.line(W - margin - 80, y, W - margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.text('Aprovação do cliente', margin, y + 4);
  doc.text('Responsável técnico', W - margin, y + 4, { align: 'right' });

  drawFooter(doc, os.technician_name);

  const blob = doc.output('blob');
  if (options?.returnBlob) return blob;
  doc.save(`orcamento-tecnico-${os.os_number}.pdf`);
}

/**
 * PDF de Termo de Entrada / Recibo de Equipamento
 */
export async function generateEquipmentReceiptPdf(
  os: any,
  options?: { returnBlob?: boolean }
): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;

  await drawHeader(doc, 'TERMO DE ENTRADA DE EQUIPAMENTO');
  let y = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`OS Nº ${os.os_number}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Data de entrada: ${formatDate(os.entry_date || os.created_at)}`, W - margin, y, { align: 'right' });
  y += 6;

  y = drawSectionTitle(doc, y, 'Dados do Cliente');
  y = labelValueGrid(doc, y, [
    [['Cliente', os.client_name || '-'], ['Telefone', os.client_phone || os.phone || '-']],
    [['E-mail', os.client_email || os.email || '-'], ['CPF/CNPJ', os.client_document || '-']],
  ]);

  y = drawSectionTitle(doc, y, 'Equipamento');
  y = labelValueGrid(doc, y, [
    [['Equipamento', os.equipment || '-'], ['Marca', os.brand || '-']],
    [['Modelo', os.model || '-'], ['Nº de Série', os.serial || '-']],
    [['Estado físico', os.physical_condition || '-'], ['Garantia', os.warranty || '-']],
  ]);

  const accessories = Array.isArray(os.accessories) ? os.accessories.join(', ') : (os.accessories || '-');
  y = labelValueGrid(doc, y, [[['Acessórios recebidos', accessories || 'Nenhum']]]);

  y = drawSectionTitle(doc, y, 'Defeito Relatado pelo Cliente');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const defectLines = doc.splitTextToSize(os.reported_defect || '-', W - margin * 2 - 2);
  doc.text(defectLines, margin + 1, y);
  y += defectLines.length * 4 + 5;

  y = drawSectionTitle(doc, y, 'Condições de Recebimento');
  doc.setFontSize(8);
  const conds = [
    'O equipamento foi recebido apenas para avaliação técnica. Os defeitos apontados são de responsabilidade do cliente.',
    'O prazo para diagnóstico é de até 5 dias úteis. Após avaliação, será enviado orçamento para aprovação.',
    'Não nos responsabilizamos por dados armazenados em cartões de memória, discos ou similares.',
    'Equipamentos não retirados após 90 dias do aviso de conclusão estarão sujeitos a taxa de armazenagem.',
    'A garantia dos serviços é de 90 dias sobre os itens efetivamente reparados.',
  ];
  conds.forEach((c) => {
    const lines = doc.splitTextToSize(`• ${c}`, W - margin * 2 - 2);
    doc.text(lines, margin + 1, y);
    y += lines.length * 3.8;
  });

  // Tracking + QR
  y += 4;
  y = drawSectionTitle(doc, y, 'Acompanhe sua OS Online');
  const trackingUrl = `${window.location.origin}/rastreamento/os/${os.public_token || ''}`;
  try {
    const qr = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 220 });
    doc.addImage(qr, 'PNG', margin, y, 28, 28);
  } catch {}
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Escaneie o QR Code ou acesse o link:', margin + 32, y + 6);
  doc.setTextColor(0, 110, 200);
  doc.setFontSize(8);
  doc.text(trackingUrl, margin + 32, y + 12, { maxWidth: W - margin - 32 - margin });
  doc.setTextColor(0);
  y += 32;

  // Assinaturas
  y = Math.max(y, 235);
  doc.setDrawColor(120);
  doc.line(margin, y, margin + 80, y);
  doc.line(W - margin - 80, y, W - margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.text(`Assinatura do Cliente — ${os.client_name || ''}`, margin, y + 4);
  doc.text(`Responsável Técnico${os.technician_name ? ' — ' + os.technician_name : ''}`, W - margin, y + 4, { align: 'right' });

  drawFooter(doc, os.technician_name);

  const blob = doc.output('blob');
  if (options?.returnBlob) return blob;
  doc.save(`termo-entrada-${os.os_number}.pdf`);
}
