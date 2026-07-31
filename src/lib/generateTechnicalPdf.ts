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
  email: 'jonathan@mcistore.com.br',
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

/** Rodapé do orçamento: bloco do técnico responsável (modelo do sistema antigo) */
function drawQuoteFooter(doc: any, os: any) {
  const W = 210;
  const H = 297;
  const margin = 12;
  const pageCount = doc.getNumberOfPages();
  doc.setPage(pageCount);
  const top = H - 40;
  doc.setDrawColor(0, 190, 170);
  doc.setLineWidth(0.5);
  doc.line(margin, top, W - margin, top);
  doc.setLineWidth(0.2);
  doc.setDrawColor(215);
  doc.rect(margin, top + 4, W - margin * 2, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(70);
  doc.text('Técnico Responsável', margin + 4, top + 10);
  doc.setFontSize(10);
  doc.setTextColor(0, 110, 180);
  doc.text(os.technician_name || '-', margin + 4, top + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.text(os.technician_email || COMPANY.email, W / 2 - 4, top + 14);
  doc.setTextColor(0, 150, 109);
  doc.text(os.technician_phone || COMPANY.phone, W - margin - 6, top + 14, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setTextColor(120);
  doc.text(`${COMPANY.name} • www.mci.tv`, margin + 4, top + 23);
  doc.text('Garantia de 1 ano em toda manutenção e peças', W - margin - 4, top + 23, { align: 'right' });
  doc.setTextColor(0);
}


/**
 * PDF de Orçamento Técnico (espelha o modelo do sistema antigo)
 */
export async function generateTechnicalQuotePdf(
  os: any,
  parts: any[],
  options?: { returnBlob?: boolean; client?: any }
): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;
  const client = options?.client || {};

  await drawHeader(doc, 'ORÇAMENTO DE SERVIÇO TÉCNICO');
  let y = 44;

  // OS + data + versão + validade
  const validDays = Number(os.budget_valid_days || 10);
  const version = Number(os.budget_version || 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`OS Nº ${os.os_number}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Versão ${version}  ·  Data: ${formatDate(os.entry_date || os.created_at)}  ·  Validade: ${validDays} dias`,
    W - margin,
    y,
    { align: 'right' }
  );
  y += 6;

  // Cliente
  y = drawSectionTitle(doc, y, 'Dados do Cliente');
  y = labelValueGrid(doc, y, [
    [['Cliente', os.client_name || client.name || '-'], ['CPF/CNPJ', client.cpf_cnpj || os.client_document || '-']],
    [['Telefone', client.phone || client.whatsapp || os.client_phone || '-'], ['E-mail', client.email || os.client_email || '-']],
    [['Endereço', client.address || '-'], ['Cidade/UF', [client.city, client.state].filter(Boolean).join(' / ') || '-']],
  ]);

  // Prestador
  y = drawSectionTitle(doc, y, 'Prestador de Serviço');
  y = labelValueGrid(doc, y, [
    [['Empresa', COMPANY.name], ['CNPJ', COMPANY.cnpj]],
    [['Telefone', COMPANY.phone], ['E-mail', COMPANY.email]],
    [
      ['Técnico responsável', os.technician_name || '-'],
      ['Contato do técnico', os.technician_phone || os.technician_email || COMPANY.phone],
    ],
  ]);

  // Equipamento
  y = drawSectionTitle(doc, y, 'Equipamento');
  y = labelValueGrid(doc, y, [
    [['Equipamento', os.equipment || '-'], ['Marca', os.brand || '-']],
    [['Modelo', os.model || '-'], ['Nº de Série', os.serial || '-']],
    [['Tipo de serviço', os.service_type || os.os_type || '-'], ['Estado físico', os.physical_condition || '-']],
  ]);
  const accessories = Array.isArray(os.accessories)
    ? os.accessories.join(', ')
    : (os.accessories || '');
  y = labelValueGrid(doc, y, [[['Acessórios recebidos', accessories || 'Nenhum']]]);

  // Defeito e diagnóstico
  const textBlock = (title: string, content: string) => {
    y = drawSectionTitle(doc, y, title);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(content || '-', W - margin * 2 - 2);
    if (y + lines.length * 4 > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin + 1, y);
    y += lines.length * 4 + 4;
  };

  textBlock('Defeito Relatado pelo Cliente', os.reported_defect || '-');
  textBlock('Relatório Técnico / Diagnóstico', os.technical_diagnosis || '-');

  // Totais (cálculo idêntico ao editor)
  const partsValue = (parts || []).length
    ? (parts || []).reduce((s: number, p: any) => s + Number(p.total_price || 0), 0)
    : Number(os.parts_value || 0);
  const laborValue = Number(os.labor_value || 0);
  const shippingValue = Number(os.shipping_value || 0);
  const shippingLabel = os.shipping_method || 'Frete';
  const discountPercent = Number(os.discount_percent || 0);
  const scope = os.discount_scope === 'total' ? 'total' : 'parts';
  const discountBase = scope === 'total' ? partsValue + laborValue + shippingValue : partsValue;
  const discountValue = (discountBase * discountPercent) / 100;
  const total = Math.max(0, partsValue + laborValue + shippingValue - discountValue);

  // Tabela de peças e serviços (peças + mão de obra + frete, como no modelo antigo)
  const rows: any[] = (parts || []).map((p: any) => [
    p.code || p.product_code || '-',
    p.product_name || '-',
    String(p.quantity ?? 1),
    fmt(Number(p.unit_price || 0)),
    fmt(Number(p.total_price || 0)),
  ]);

  const repair = os.repair_description || os.technician_notes || '';
  if (repair) {
    rows.push([
      { content: '', styles: { cellWidth: 22 } },
      { content: repair, colSpan: 4, styles: { fontStyle: 'italic', textColor: 90 } },
    ]);
  }
  if (laborValue > 0) {
    rows.push(['', 'Mão de Obra Especializada', '1', fmt(laborValue), fmt(laborValue)]);
  }
  if (shippingValue > 0) {
    rows.push(['', `Frete: ${shippingLabel}`, '1', fmt(shippingValue), fmt(shippingValue)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descrição', 'Qtd', 'Unitário', 'Total']],
    body: rows.length ? rows : [['-', 'Nenhum item lançado', '-', '-', '-']],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }, textColor: 30 },
    headStyles: { fontStyle: 'bold', textColor: 40, lineWidth: { bottom: 0.3 }, lineColor: [190, 190, 190] },
    bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: [225, 225, 225] },
    columnStyles: {
      0: { cellWidth: 18, fontSize: 7, textColor: 110 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 12, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (y > 225) { doc.addPage(); y = 24; }

  const totalsX = W - margin - 80;
  const totalsW = 80;
  const drawRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 8.5);
    doc.text(label, totalsX + totalsW - 34, y, { align: 'right' });
    doc.text(val, totalsX + totalsW - 2, y, { align: 'right' });
    y += bold ? 7 : 5.2;
  };
  drawRow('Subtotal Peças', fmt(partsValue));
  if (discountPercent) {
    doc.setTextColor(200, 60, 60);
    drawRow(
      `Desconto ${discountPercent}% (${scope === 'total' ? 'sobre o total' : 'sobre peças'})`,
      `- ${fmt(discountValue)}`
    );
    doc.setTextColor(0);
  }
  drawRow('Mão de Obra', fmt(laborValue));
  drawRow(`Frete (${shippingLabel})`, fmt(shippingValue));
  doc.setDrawColor(60);
  doc.setLineWidth(0.6);
  doc.line(totalsX, y - 2.5, totalsX + totalsW, y - 2.5);
  doc.setLineWidth(0.2);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text('TOTAL', totalsX + totalsW - 40, y, { align: 'right' });
  doc.setTextColor(0, 150, 109);
  doc.text(fmt(total), totalsX + totalsW - 2, y, { align: 'right' });
  doc.setTextColor(0);
  y += 14;

  // Condições + assinatura
  if (y > 250) { doc.addPage(); y = 30; }
  doc.setDrawColor(215);
  doc.line(margin, y - 6, W - margin, y - 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40);
  doc.text('Condições:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Validade deste orçamento é de ${validDays} dias.`, margin + 17, y);
  const warrantyText = os.warranty
    || 'Toda manutenção e peças possuem garantia de 1 ano, exceto por mau uso.';
  const wLines = doc.splitTextToSize(warrantyText, 80);
  doc.text(wLines, margin, y + 5);
  doc.setTextColor(0);

  // Assinatura (lado direito)
  const sigX = W - margin - 78;
  doc.setDrawColor(160);
  doc.line(sigX, y + 5, W - margin, y + 5);
  doc.setFontSize(9);
  doc.setTextColor(50);
  doc.text('Assinatura do Responsável', sigX + 39, y + 10, { align: 'center' });
  doc.setTextColor(0);

  drawQuoteFooter(doc, os);


  const blob = doc.output('blob');
  if (options?.returnBlob) return blob;
  doc.save(`orcamento-tecnico-${os.os_number}-v${version}.pdf`);
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
