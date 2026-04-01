export async function generateQuotePdf(quote: any, items: any[], client: any) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;
  const cw = W - margin * 2;
  let y = margin;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Header bar
  doc.setFillColor(0, 150, 136);
  doc.rect(0, 0, W, 10, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE COMPRA / ORÇAMENTO', W / 2, 7, { align: 'center' });

  y = 14;
  doc.setTextColor(0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');

  // Company locations
  const locations = [
    { title: 'CEARÁ', lines: ['Rua Senador Pompeu, 1547', 'Centro - CEP: 60.025-001', 'Tel.: +55 (85) 3254-4700', 'CNPJ: 05.502.390/0001-11'] },
    { title: 'SANTA CATARINA', lines: ['Rua Odílio Garcia, 211', 'Sala B, Box 10 - Cordeiro', 'CEP: 88310-180', 'CNPJ: 05.502.390/0002-00'] },
    { title: 'SÃO PAULO', lines: ['R. Inácio Pereira da Rocha, 142', 'Sala 502, Vila Madalena', 'CEP: 05432-010', 'CNPJ: 05.502.390/0003-83'] },
    { title: 'MIAMI', lines: ['8123 NW 29th St Doral, FL', '+1 (786) 925-6661', 'MCI IMP & EXP CORP'] },
  ];

  const colW = cw / 4;
  locations.forEach((loc, i) => {
    const x = margin + i * colW;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 128);
    doc.text(loc.title, x, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    loc.lines.forEach((line, li) => {
      doc.text(line, x, y + 5 + li * 3);
    });
  });

  y += 22;

  // Brands bar
  doc.setFontSize(6);
  doc.setTextColor(120);
  const brands = 'Aputure • DZOFILM • Caligri • SECCED • Accsoon • Miliboo • Godox • 7artisans • CREAM SOURCE';
  doc.text(brands, W / 2, y, { align: 'center' });
  y += 4;

  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 5;

  // Quote info
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orçamento: ${quote.quote_number}`, margin, y);
  doc.text(`Data: ${new Date(quote.quote_date).toLocaleDateString('pt-BR')}`, W - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (client) {
    doc.text(`Cliente: ${client.company_name || client.name || ''}`, margin, y);
    y += 4;
    if (client.cpf_cnpj) { doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, margin, y); y += 4; }
    if (client.email) { doc.text(`Email: ${client.email}`, margin, y); y += 4; }
    if (client.phone) { doc.text(`Tel: ${client.phone}`, margin, y); y += 4; }
  }
  if (quote.salesperson) { doc.text(`Vendedor: ${quote.salesperson}`, margin, y); y += 4; }
  y += 3;

  // Items table header
  const cols = [
    { label: '#', w: 8 },
    { label: 'Código', w: 20 },
    { label: 'Modelo / Descrição', w: 60 },
    { label: 'Marca', w: 22 },
    { label: 'Qtd', w: 12 },
    { label: 'Unit.', w: 22 },
    { label: 'Desc.', w: 14 },
    { label: 'Total', w: 28 },
  ];

  doc.setFillColor(0, 150, 136);
  doc.rect(margin, y, cw, 6, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let cx = margin + 1;
  cols.forEach(col => {
    doc.text(col.label, cx, y + 4);
    cx += col.w;
  });
  y += 7;

  // Items
  doc.setTextColor(30);
  doc.setFont('helvetica', 'normal');
  items.forEach((item: any, i: number) => {
    if (y > 265) { doc.addPage(); y = margin; }
    const bg = i % 2 === 0;
    if (bg) { doc.setFillColor(245, 245, 245); doc.rect(margin, y - 3, cw, 5, 'F'); }
    cx = margin + 1;
    const row = [
      String(item.item_number || i + 1),
      item.product_code || '',
      item.model || item.description || '',
      item.brand || '',
      String(item.quantity || 1),
      fmt(parseFloat(item.unit_price) || 0),
      `${item.discount_percent || 0}%`,
      fmt(parseFloat(item.line_total || item.total_price) || 0),
    ];
    row.forEach((val, ci) => {
      doc.text(val.substring(0, cols[ci].w / 2), cx, y);
      cx += cols[ci].w;
    });
    y += 5;
  });

  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // Total
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 128, 128);
  doc.text(`TOTAL: ${fmt(parseFloat(quote.total_amount) || 0)}`, W - margin, y, { align: 'right' });
  y += 8;

  // Payment/Shipping info
  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'normal');
  const shippingLabels: Record<string, string> = {
    correios: 'Correios', mao_propria: 'Mão Própria', retirada: 'Retirada', transportadora: 'Transportadora',
  };
  if (quote.payment_terms) { doc.text(`Forma de Pagamento: ${quote.payment_terms}`, margin, y); y += 4; }
  if (quote.shipping_deadline) { doc.text(`Prazo de Envio: ${quote.shipping_deadline}`, margin, y); y += 4; }
  if (quote.shipping_method) { doc.text(`Forma de Envio: ${shippingLabels[quote.shipping_method] || quote.shipping_method}`, margin, y); y += 4; }
  if (quote.notes) { y += 2; doc.text(`Observações: ${quote.notes}`, margin, y); }

  doc.save(`${quote.quote_number}.pdf`);
}
