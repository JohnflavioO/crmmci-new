export async function generateQuotePdf(quote: any, items: any[], client: any, options?: { returnBlob?: boolean }): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const margin = 12;
  const cw = W - margin * 2;
  let y = margin;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const resetTextSpacing = () => {
    const pdfDoc = doc as any;
    if (typeof pdfDoc.setCharSpace === 'function') pdfDoc.setCharSpace(0);
  };

  const normalizeCellText = (value: any) => {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    text = text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+-\s+/g, ' - ');
    text = text.replace(/B\s+L\s+A\s+I\s+R/gi, 'BLAIR');
    text = text.replace(/C\s+G/gi, 'CG');
    text = text.replace(/K\s+I\s+T\s+D\s+E\s+V\s+I\s+A\s+G\s+E\s+M/gi, 'KIT DE VIAGEM');
    return text;
  };

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

  // Quote info section - Layout optimization
  const infoY = y;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orçamento: ${quote.quote_number}`, margin, infoY);

  // Reseller badge next to quote number
  if (quote.is_reseller) {
    const qnWidth = doc.getTextWidth(`Orçamento: ${quote.quote_number}  `);
    const badgeX = margin + qnWidth;
    const badgeText = 'REVENDA';
    doc.setFontSize(7);
    const badgeW = doc.getTextWidth(badgeText) + 6;
    doc.setFillColor(139, 92, 246); // purple
    doc.roundedRect(badgeX, infoY - 3.5, badgeW, 5, 1.5, 1.5, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.text(badgeText, badgeX + 3, infoY);
    doc.setFontSize(9);
    doc.setTextColor(0);
  }

  doc.text(`Data: ${quote.quote_date ? quote.quote_date.split('-').reverse().join('/') : '-'}`, W - margin, infoY, { align: 'right' });
  
  if (quote.proposal_validity) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Validade da Proposta: ${quote.proposal_validity}`, W - margin, infoY + 4, { align: 'right' });
  }

  // Client Data - Two Column Layout to save space
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5); // Slightly smaller to be more compact
  doc.setTextColor(0);
  
  const midX = W / 2;
  let leftY = y;
  let rightY = y;

  if (client) {
    // Column 1: Identification
    doc.setFont('helvetica', 'bold');
    doc.text(`Cliente: ${client.company_name || client.name || ''}`, margin, leftY); 
    leftY += 3.5;
    doc.setFont('helvetica', 'normal');
    if (client.cpf_cnpj) { doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, margin, leftY); leftY += 3.5; }
    if (client.email) { doc.text(`Email: ${client.email}`, margin, leftY); leftY += 3.5; }
    if (client.phone) { doc.text(`Tel: ${client.phone}`, margin, leftY); leftY += 3.5; }
    
    // Column 2: Address & Salesperson
    const addrParts = [
      client.address,
      client.address_number ? `nº ${client.address_number}` : '',
      client.complement ? `(${client.complement})` : ''
    ].filter(Boolean).join(', ');
    
    if (addrParts) { 
      const addrLines = doc.splitTextToSize(`Endereço: ${addrParts}`, (W / 2) - margin);
      doc.text(addrLines, midX, rightY); 
      rightY += (addrLines.length * 3.5); 
    }
    
    const neighborhood = client.neighborhood;
    const cityState = [client.city, client.state].filter(Boolean).join(' - ');
    const zipCode = client.cep || client.zip_code;
    const zipCodeStr = zipCode ? `CEP: ${zipCode}` : '';
    const secondLine = [neighborhood, cityState, zipCodeStr].filter(Boolean).join(', ');
    
    if (secondLine) { 
      const cityLines = doc.splitTextToSize(secondLine, (W / 2) - margin);
      doc.text(cityLines, midX, rightY); 
      rightY += (cityLines.length * 3.5); 
    }
  }
  
  if (quote.salesperson) { 
    doc.text(`Vendedor: ${quote.salesperson}`, midX, rightY); 
    rightY += 3.5; 
  }

  y = Math.max(leftY, rightY) + 2;

  // Items table header - fixed positions prevent column overlap
  const cols = [
    { label: '#', w: 6 },
    { label: 'Foto', w: 10 },
    { label: 'Código', w: 13 },
    { label: 'Modelo / Descrição', w: 52 },
    { label: 'Marca', w: 16 },
    { label: 'Qtd', w: 7 },
    { label: 'Unit.', w: 19 },
    { label: 'Desc.', w: 8 },
    { label: 'V. Unit c/ Desc.', w: 24 },
    { label: 'Total', w: 31 }, 
  ];
  const colX = cols.reduce<number[]>((acc, col, idx) => {
    acc[idx] = idx === 0 ? margin + 1 : acc[idx - 1] + cols[idx - 1].w;
    return acc;
  }, []);
  const colRight = (idx: number) => (idx === cols.length - 1 ? W - margin - 1 : colX[idx] + cols[idx].w - 2);

  const checkPage = (needed: number) => {
    if (y + needed > 275) { 
      doc.addPage(); 
      y = margin + 12; 
    }
  };

  const headerH = 8;
  doc.setFillColor(0, 150, 136);
  doc.rect(margin, y, cw, headerH, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7.2); 
  doc.setFont('helvetica', 'bold');
  resetTextSpacing();

  cols.forEach((col, idx) => {
    const isLast = idx === cols.length - 1;
    doc.text(col.label, isLast ? colRight(idx) : colX[idx], y + 5.5, { align: isLast ? 'right' : 'left' });
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

  const wrapCellText = (text: string, maxWidth: number, maxLines: number) => {
    const words = normalizeCellText(text).split(' ').filter(Boolean);
    const lines: string[] = [];
    let current = '';

    const pushLongWord = (word: string) => {
      let chunk = '';
      Array.from(word).forEach((char) => {
        const candidate = chunk + char;
        if (doc.getTextWidth(candidate) <= maxWidth) {
          chunk = candidate;
        } else {
          if (chunk && lines.length < maxLines) lines.push(chunk);
          chunk = char;
        }
      });
      if (chunk && lines.length < maxLines) current = chunk;
    };

    for (const word of words) {
      if (lines.length >= maxLines) break;
      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (lines.length >= maxLines) {
          current = '';
          break;
        }
        if (doc.getTextWidth(word) > maxWidth) {
          pushLongWord(word);
        } else {
          current = word;
        }
      }
    }
    
    if (current && lines.length < maxLines) {
      lines.push(current);
    }

    // Add ellipsis ONLY if we actually truncated text
    if (lines.length === maxLines && words.length > lines.join(' ').split(' ').length) {
      const lastLine = lines[maxLines - 1];
      if (lastLine.length > 3) {
        lines[maxLines - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
      }
    }

    return lines;
  };

  // Items
  doc.setTextColor(30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const baseRowHeight = 10;
  
  items.forEach((item: any, i: number) => {
    const model = normalizeCellText(item.model || item.description || '');
    const specs = item.specifications ? `(${normalizeCellText(item.specifications)})` : '';
    
    // Compact, bounded description: show up to 2 lines of model + 1 line of specs
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    resetTextSpacing();
    
    // Show up to 3 lines for model if no specs, or 2 lines model + 1 line specs
    const splitModel = wrapCellText(model, cols[3].w - 3, specs ? 2 : 3); 
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    const splitSpecs = specs ? wrapCellText(specs, cols[3].w - 3, 1) : [];
    
    // Calculate required row height based on content
    const totalLines = Math.max(1, splitModel.length + splitSpecs.length);
    const lineHeight = 3.6; 
    const contentHeight = (totalLines * lineHeight) + 4; 
    const rowHeight = Math.max(baseRowHeight, contentHeight);

    checkPage(rowHeight + 2);
    
    const bg = i % 2 === 0;
    if (bg) { 
      doc.setFillColor(245, 245, 245); 
      doc.rect(margin, y - 5, cw, rowHeight, 'F'); 
    }
    
    // 1. Column #
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(30);
    resetTextSpacing();
    doc.text(String(item.item_number || i + 1), colX[0], y);

    // 2. Column Foto
    if (itemImages[i]) {
      try {
        doc.addImage(itemImages[i], 'JPEG', colX[1], y - 4, 10, 10);
      } catch { /* skip */ }
    }

    // 3. Column Código
    const codeLines = wrapCellText(item.product_code || '', cols[2].w - 2, 1);
    doc.text(codeLines, colX[2], y);

    // 4. Column Modelo / Descrição (Multi-line)
    const descX = colX[3];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    resetTextSpacing();
    doc.text(splitModel, descX, y);
    
    if (splitSpecs.length > 0) {
      doc.setFont('helvetica', 'normal'); 
      doc.setFontSize(7.1);
      doc.setTextColor(80);
      doc.text(splitSpecs, descX, y + (splitModel.length * 3.6));
      doc.setTextColor(30);
    }

    // Other Columns
    const isGift = item.is_gift === true;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const discPct = parseFloat(item.discount_percent) || 0;
    const priceWithDisc = unitPrice * (1 - discPct / 100);
    
    const remainingValues = [
      item.brand || '',
      String(item.quantity || 1),
      isGift ? 'BRINDE' : fmt(unitPrice),
      isGift ? '-' : (discPct ? `${Number(discPct.toFixed(2))}%` : ''),
      isGift ? 'BRINDE' : fmt(priceWithDisc),
      isGift ? 'BRINDE' : fmt(parseFloat(item.line_total || item.total_price) || 0),
    ];

    remainingValues.forEach((val, ci) => {
      const colIdx = ci + 4;
      const isLast = colIdx === cols.length - 1;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      resetTextSpacing();
      if (isGift && (ci === 2 || ci === 4 || ci === 5)) {
        doc.setTextColor(0, 150, 100);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(30);
      }

      const textVal = normalizeCellText(val);
      const alignRight = colIdx >= 6;
      const x = alignRight ? colRight(colIdx) : colX[colIdx];
      const maxW = cols[colIdx].w - 2;
      const safeText = doc.getTextWidth(textVal) > maxW ? wrapCellText(textVal, maxW, 1)[0] || '' : textVal;
      doc.text(safeText, x, y, { align: alignRight || isLast ? 'right' : 'left' });
    });

    y += rowHeight;
  });

  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 3;

  // Subtotal, Frete, Total
  const shippingCost = parseFloat(quote.shipping_cost) || 0;
  const totalWithShipping = parseFloat(quote.total_amount) || 0;
  const grandTotal = totalWithShipping;
  
  // The user wants to remove the discount from the bottom and only show Shipping and Total
  
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);

  if (shippingCost > 0) {
    const subtotalWithoutShipping = grandTotal - shippingCost;
    doc.text(`Subtotal: ${fmt(subtotalWithoutShipping)}`, W - margin, y, { align: 'right' });
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
