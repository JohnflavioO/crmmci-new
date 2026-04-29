export async function generateQuotePdf(quote: any, items: any[], client: any, options?: { returnBlob?: boolean }): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;
  const cw = W - margin * 2;
  let y = margin;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Load logo (optimized PNG, pre-resized to 400px)
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => reject(new Error('logo'));
      logoImg.src = '/mci-logo-quote.png';
    });
    const lw = logoImg.naturalWidth;
    const lh = logoImg.naturalHeight;
    // Use PNG format to preserve transparency (no black background)
    const canvas = document.createElement('canvas');
    canvas.width = lw;
    canvas.height = lh;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(logoImg, 0, 0, lw, lh);
    const logoData = canvas.toDataURL('image/png');
    // Maintain aspect ratio: 28mm wide
    const logoW = 28;
    const logoH = logoW * (lh / lw);
    doc.addImage(logoData, 'PNG', margin, y, logoW, logoH);
  } catch { /* logo not available, skip */ }

  // Header bar
  doc.setFillColor(0, 150, 136);
  doc.rect(0, 0, W, 10, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE COMPRA / ORÇAMENTO', W / 2, 7, { align: 'center' });

  y = 14;
  const locStartX = margin + 32;

  const locations = [
    { title: 'CEARÁ', lines: ['Rua Senador Pompeu, 1547', 'Centro - CEP: 60.025-001', 'Tel.: +55 (85) 3254-4700', 'CNPJ: 05.502.390/0001-11'] },
    { title: 'SANTA CATARINA', lines: ['Rua Odílio Garcia, 211', 'Sala B, Box 10 - Cordeiro', 'CEP: 88310-180', 'CNPJ: 05.502.390/0002-00'] },
    { title: 'SÃO PAULO', lines: ['R. Inácio Pereira da Rocha, 142', 'Sala 502, Vila Madalena', 'CEP: 05432-010', 'CNPJ: 05.502.390/0003-83'] },
    { title: 'MIAMI', lines: ['8123 NW 29th St Doral, FL', '+1 (786) 925-6661', 'MCI IMP & EXP CORP'] },
  ];

  const locWidth = (cw - 28) / 4;
  doc.setFontSize(6.5);
  locations.forEach((loc, i) => {
    const x = locStartX + i * locWidth;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 128);
    doc.text(loc.title, x, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    loc.lines.forEach((line, li) => {
      doc.text(line, x, y + 5 + li * 2.8);
    });
  });

  y += 22;

  // Brands bar
  doc.setFontSize(5.5);
  doc.setTextColor(120);
  const brands = 'Aputure • DZOFILM • Caligri • SECCED • Accsoon • Miliboo • Godox • 7artisans • CREAM SOURCE';
  doc.text(brands, W / 2, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 5;

  // Quote info
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orçamento: ${quote.quote_number}`, margin, y);

  // Reseller badge next to quote number
  if (quote.is_reseller) {
    const qnWidth = doc.getTextWidth(`Orçamento: ${quote.quote_number}  `);
    const badgeX = margin + qnWidth;
    const badgeText = 'REVENDA';
    doc.setFontSize(7);
    const badgeW = doc.getTextWidth(badgeText) + 6;
    doc.setFillColor(139, 92, 246); // purple
    doc.roundedRect(badgeX, y - 3.5, badgeW, 5, 1.5, 1.5, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.text(badgeText, badgeX + 3, y);
    doc.setFontSize(9);
    doc.setTextColor(0);
  }

  doc.text(`Data: ${quote.quote_date ? quote.quote_date.split('-').reverse().join('/') : '-'}`, W - margin, y, { align: 'right' });
  y += 5;

  if (quote.proposal_validity) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Validade da Proposta: ${quote.proposal_validity}`, W - margin, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0);
  if (client) {
    doc.text(`Cliente: ${client.company_name || client.name || ''}`, margin, y); y += 4;
    if (client.cpf_cnpj) { doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, margin, y); y += 4; }
    if (client.email) { doc.text(`Email: ${client.email}`, margin, y); y += 4; }
    if (client.phone) { doc.text(`Tel: ${client.phone}`, margin, y); y += 4; }
    if (client.address) {
      const addr = [client.address, client.address_number, client.complement, client.neighborhood, client.city, client.state].filter(Boolean).join(', ');
      doc.text(`Endereço: ${addr}`, margin, y); y += 4;
    }
  }
  if (quote.salesperson) { doc.text(`Vendedor: ${quote.salesperson}`, margin, y); y += 4; }
  y += 3;

  // Items table header
  const cols = [
    { label: '#', w: 8 },
    { label: 'Foto', w: 14 },
    { label: 'Código', w: 16 },
    { label: 'Modelo / Descrição', w: 48 },
    { label: 'Marca', w: 18 },
    { label: 'Qtd', w: 10 },
    { label: 'Unit.', w: 20 },
    { label: 'Desc.', w: 12 },
    { label: 'Total', w: 26 },
  ];

  const checkPage = (needed: number) => {
    if (y + needed > 275) { doc.addPage(); y = margin; }
  };

  const headerH = 8;
  doc.setFillColor(0, 150, 136);
  doc.rect(margin, y, cw, headerH, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let cx = margin + 2;
  cols.forEach(col => {
    doc.text(col.label, cx, y + 5.5);
    cx += col.w;
  });
  y += headerH + 4;

  // Preload item images - compress heavily for smaller file size
  const itemImages: Record<number, string> = {};
  await Promise.all(
    items.map(async (item: any, i: number) => {
      if (!item.image_url) return;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = item.image_url;
        });
        // Resize to tiny thumbnail for PDF (max 50px) with heavy JPEG compression
        const maxSize = 50;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx2 = c.getContext('2d')!;
        ctx2.drawImage(img, 0, 0, w, h);
        itemImages[i] = c.toDataURL('image/jpeg', 0.3);
      } catch { /* skip */ }
    })
  );

  // Items
  doc.setTextColor(30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const rowHeight = 12;
  items.forEach((item: any, i: number) => {
    checkPage(rowHeight + 2);
    const bg = i % 2 === 0;
    if (bg) { doc.setFillColor(245, 245, 245); doc.rect(margin, y - 5, cw, rowHeight, 'F'); }
    cx = margin + 2;

    doc.setTextColor(30);
    doc.text(String(item.item_number || i + 1), cx, y);
    cx += cols[0].w;

    if (itemImages[i]) {
      try {
        doc.addImage(itemImages[i], 'JPEG', cx, y - 4, 10, 10);
      } catch { /* skip */ }
    }
    cx += cols[1].w;

    const desc = [item.model || item.description || '', item.specifications ? `(${item.specifications})` : ''].filter(Boolean).join(' ');
    const isGift = item.is_gift === true;
    
    // Render row contents
    const rowValues = [
      item.product_code || '',
      desc,
      item.brand || '',
      String(item.quantity || 1),
      isGift ? 'BRINDE' : fmt(parseFloat(item.unit_price) || 0),
      isGift ? '-' : (item.discount_percent ? `${item.discount_percent}%` : ''),
      isGift ? 'BRINDE' : fmt(parseFloat(item.line_total || item.total_price) || 0),
    ];

    rowValues.forEach((val, ci) => {
      const colIdx = ci + 2;
      const col = cols[colIdx];
      
      if (isGift && (ci === 4 || ci === 6)) {
        doc.setTextColor(0, 150, 100);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(30);
        doc.setFont('helvetica', 'normal');
      }

      // Especial handling for description column to avoid cutting
      if (ci === 1) { // Descrição
        const splitDesc = doc.splitTextToSize(val, col.w - 2);
        doc.text(splitDesc, cx, y);
      } else {
        const maxChars = Math.floor(col.w / 1.8);
        doc.text(val.substring(0, maxChars), cx, y);
      }
      
      cx += col.w;
    });
    doc.setTextColor(30);
    doc.setFont('helvetica', 'normal');
    y += rowHeight;
  });

  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 3;

  // Subtotal, Frete, Total
  const shippingCost = parseFloat(quote.shipping_cost) || 0;
  const totalWithShipping = parseFloat(quote.total_amount) || 0;
  const subtotal = totalWithShipping - shippingCost;
  const grandTotal = totalWithShipping;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);

  if (shippingCost > 0) {
    doc.text(`Subtotal: ${fmt(subtotal)}`, W - margin, y, { align: 'right' });
    y += 3.5;
    doc.text(`Frete: ${fmt(shippingCost)}`, W - margin, y, { align: 'right' });
    y += 4;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 128, 128);
  doc.text(`TOTAL: ${fmt(grandTotal)}`, W - margin, y, { align: 'right' });
  y += 5;

  // Payment/Shipping info
  checkPage(20);
  doc.setFontSize(7);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'normal');
  const shippingLabels: Record<string, string> = {
    correios: 'Correios', mao_propria: 'Mão Própria', retirada: 'Retirada', transportadora: 'Transportadora',
  };
  if (quote.payment_terms) { doc.text(`Forma de Pagamento: ${quote.payment_terms}`, margin, y); y += 3; }
  if (quote.shipping_deadline) { doc.text(`Prazo de Envio: ${quote.shipping_deadline}`, margin, y); y += 3; }
  if (quote.shipping_method) { doc.text(`Forma de Envio: ${shippingLabels[quote.shipping_method] || quote.shipping_method}`, margin, y); y += 3; }
  if (quote.proposal_validity) { doc.text(`Validade da Proposta: ${quote.proposal_validity}`, margin, y); y += 3; }
  y += 1;

  // Notes
  if (quote.notes) {
    checkPage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text('Observações:', margin, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    const noteLines = doc.splitTextToSize(quote.notes, cw);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 3 + 2;
  }

  // Bank details + Signature side by side
  checkPage(18);
  y += 1;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 3;

  // Left: Bank details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 128, 128);
  doc.text('DADOS BANCÁRIOS', margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(50);
  doc.text('ITAÚ - Ag: 0366 | Cc: 71016-8 | Multicomercial e Importadora EIRELI | Pix (CNPJ): 05.502.390/0001-11', margin, y);
  y += 5;

  // Signature lines
  const sigX = margin;
  const sigW = 65;
  doc.setDrawColor(100);
  doc.line(sigX, y, sigX + sigW, y);
  doc.setFontSize(6);
  doc.setTextColor(60);
  doc.text('Data: ___/___/______', sigX, y + 3);

  const sigX2 = W - margin - sigW;
  doc.line(sigX2, y, sigX2 + sigW, y);
  doc.text('Aprovação do Cliente', sigX2 + sigW / 2, y + 3, { align: 'center' });

  // Confidentiality footer
  y += 7;
  doc.setFontSize(5);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'italic');
  const confText = 'O documento é confidencial e de propriedade da empresa. Não pode ser copiado, mesmo que em parte sem permissão por escrito da mesma.';
  doc.text(confText, W / 2, y, { align: 'center', maxWidth: cw });
  if (options?.returnBlob) {
    return doc.output('blob');
  }

  const clientName = client?.company_name || client?.name || '';
  const sanitized = clientName.replace(/[\/\\?%*:|"<>]/g, '').trim().substring(0, 30);
  const fileName = sanitized ? `${quote.quote_number} ${sanitized}.pdf` : `${quote.quote_number}.pdf`;
  doc.save(fileName);
}
