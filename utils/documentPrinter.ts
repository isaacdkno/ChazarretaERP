import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { PaymentReceipt, CreditNote, Order, Product, CashSession, PriceList } from '../types';
import { printHTML } from './print';

const safeFormatDate = (dateInput?: string | Date, fmt = 'dd/MM/yyyy HH:mm'): string => {
  if (!dateInput) return 'Fecha N/A';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return isNaN(d.getTime()) ? 'Fecha N/A' : format(d, fmt);
};

export const printPaymentReceiptThermal = (receipt: PaymentReceipt, orders: Order[]) => {
  const dateStr = safeFormatDate(receipt.createdAt, 'dd/MM/yyyy HH:mm');

  const html = `
    <style>
      #print-container .thermal-ticket-wrapper { 
        font-family: 'Courier New', Courier, monospace; 
        width: 80mm; 
        padding: 5mm; 
        font-size: 12px;
        line-height: 1.25;
        color: #000;
        background: white;
        margin: 0;
      }
      #print-container .center { text-align: center; }
      #print-container .bold { font-weight: bold; }
      #print-container .line { border-bottom: 1px dashed #000; margin: 6px 0; }
      #print-container .flex { display: flex; justify-content: space-between; }
      #print-container .title { font-size: 16px; margin-bottom: 4px; }
    </style>
    <div class="center bold title">CHAZARRETA ERP</div>
    <div class="center">COMPROBANTE DE PAGO</div>
    <div class="line"></div>
    <div class="flex"><span>FECHA:</span> <span>${dateStr}</span></div>
    <div class="flex"><span>RECIBO:</span> <span>#${String(receipt.id).substring(0, 8).toUpperCase()}</span></div>
    <div class="flex"><span>COBRADO POR:</span> <span>${receipt.collectedBy || 'N/A'}</span></div>
    <div class="line"></div>
    <div class="bold">CLIENTE:</div>
    <div>${receipt.customerName}</div>
    <div class="line"></div>
    <div class="bold">DETALLE DE PAGO:</div>
    <div class="flex"><span>EFECTIVO:</span> <span>$${Number(receipt.cashAmount || 0).toLocaleString()}</span></div>
    <div class="flex"><span>TRANSF:</span> <span>$${Number(receipt.transferAmount || 0).toLocaleString()}</span></div>
    ${receipt.ivaBoletasAmount && receipt.ivaBoletasAmount > 0 ? `<div class="flex"><span>IVA BOLETAS:</span> <span>$${Number(receipt.ivaBoletasAmount).toLocaleString()}</span></div>` : ''}
    <div class="line"></div>
    <div class="flex bold" style="font-size: 14px;">
      <span>TOTAL COBRADO:</span> 
      <span>$${Number(receipt.amount || 0).toLocaleString()}</span>
    </div>
    <div class="line"></div>
    <div class="bold">COMANDAS AFECTADAS:</div>
    ${(receipt.details && receipt.details.length > 0) ? receipt.details.map(detail => {
      const order = orders.find(o => o.id === detail.orderId);
      return `
        <div style="margin-bottom: 8px;">
          <div class="flex bold">
            <span>#ORD-${String(detail.orderId).substring(0, 6).toUpperCase()}</span>
            <span>$${Number(detail.amountApplied || 0).toLocaleString()}</span>
          </div>
          <div class="flex" style="font-size: 10px; color: #444;">
            <span>Total Comanda:</span>
            <span>$${order?.totalAmount.toLocaleString() || '0'}</span>
          </div>
          <div class="flex" style="font-size: 10px; color: #444;">
            <span>Saldo Restante:</span>
            <span>$${Number(detail.remainingAfter || 0).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('') : (receipt.orderIds || []).map(id => {
      const order = orders.find(o => o.id === id);
      return `
        <div class="flex">
          <span>#ORD-${String(id).substring(0, 6).toUpperCase()}</span>
          <span>$${order?.totalAmount.toLocaleString() || '0'}</span>
        </div>
      `;
    }).join('')}
    <div class="line"></div>
    <div class="center" style="margin-top: 16px;">
      GRACIAS POR SU PAGO
    </div>
  `;

  printHTML(html);
};

export const exportPaymentReceiptPDF = (receipt: PaymentReceipt) => {
  const doc = new jsPDF();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CHAZARRETA ERP', 14, 24);

  doc.setFontSize(10);
  doc.text('COMPROBANTE OFICIAL DE PAGO', 135, 24);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Comprobante: REC-#${String(receipt.id).substring(0, 8).toUpperCase()}`, 14, 52);
  doc.text(`Fecha: ${safeFormatDate(receipt.createdAt, 'dd/MM/yyyy HH:mm')}`, 14, 60);
  doc.text(`Cobrado por: ${receipt.collectedBy || 'Administración'}`, 14, 68);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 74, 196, 74);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / DISTRIBUIDOR:', 14, 83);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(receipt.customerName.toUpperCase(), 14, 92);

  const paymentData = [
    ['Efectivo', `$${Number(receipt.cashAmount || 0).toLocaleString()}`],
    ['Transferencia', `$${Number(receipt.transferAmount || 0).toLocaleString()}`],
    ...(receipt.ivaBoletasAmount && receipt.ivaBoletasAmount > 0
      ? [['IVA Boletas', `$${Number(receipt.ivaBoletasAmount).toLocaleString()}`]]
      : []),
    ['TOTAL RECIBIDO', `$${Number(receipt.amount || 0).toLocaleString()}`]
  ];

  autoTable(doc, {
    startY: 102,
    head: [['Concepto', 'Importe']],
    body: paymentData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' }
    }
  });

  if (receipt.details && receipt.details.length > 0) {
    const startY = ((doc as any).lastAutoTable?.finalY || 140) + 14;
    doc.setFontSize(10);
    doc.text('IMPUTACIÓN A COMANDAS:', 14, startY);

    const orderData = receipt.details.map(d => [
      `#ORD-${String(d.orderId).substring(0, 8).toUpperCase()}`,
      `$${Number(d.remainingBefore || 0).toLocaleString()}`,
      `$${Number(d.amountApplied || 0).toLocaleString()}`,
      `$${Number(d.remainingAfter || 0).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [['Comanda', 'Saldo Anterior', 'Monto Aplicado', 'Saldo Restante']],
      body: orderData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento emitido por Chazarreta ERP - Comprobante de recepción de fondos.', 105, finalY + 25, { align: 'center' });

  doc.save(`Recibo_${String(receipt.id).substring(0, 8).toUpperCase()}.pdf`);
};

export const exportCreditNotePDF = (cn: CreditNote, orders: Order[], products: Product[]) => {
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('CHAZARRETA ERP', 14, 22);

  doc.setFontSize(14);
  doc.setTextColor(180, 83, 9);
  doc.text('NOTA DE CRÉDITO', 14, 32);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`NÚMERO: #NC-${String(cn.id).substring(0, 8).toUpperCase()}`, 14, 45);
  doc.text(`FECHA NC: ${safeFormatDate(cn.createdAt, 'dd/MM/yyyy HH:mm')}`, 14, 51);
  doc.text(`CLIENTE: ${cn.customerName.toUpperCase()}`, 14, 57);

  const refOrder = orders.find(o => o.id === cn.orderId);
  const orderDateStr = refOrder ? safeFormatDate(refOrder.createdAt, 'dd/MM/yyyy') : '---';
  doc.text(`COMANDA REF: #ORD-${String(cn.orderId).substring(0, 8).toUpperCase()} (Fecha: ${orderDateStr})`, 14, 63);

  if (cn.reason) {
    doc.text(`MOTIVO: ${cn.reason}`, 14, 71);
  }

  const tableData = cn.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    return [
      product?.name || 'Producto Desconocido',
      item.quantity.toString(),
      `$${Number(item.unitPrice || 0).toLocaleString()}`,
      `$${Number(item.total || 0).toLocaleString()}`
    ];
  });

  autoTable(doc, {
    startY: 78,
    head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    foot: [[
      { content: 'TOTAL ACREDITADO', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: `$${Number(cn.totalAmount || 0).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] } }
    ]]
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Este documento es un comprobante interno de crédito a favor del cliente.', 14, finalY + 18);
  doc.text('El monto ha sido descontado del saldo de la cuenta corriente.', 14, finalY + 24);

  doc.save(`Nota_Credito_${String(cn.id).substring(0, 8).toUpperCase()}.pdf`);
};

export const printCreditNoteThermal = (cn: CreditNote, orders: Order[], products: Product[]) => {
  const refOrder = orders.find(o => o.id === cn.orderId);
  const orderDateStr = refOrder ? safeFormatDate(refOrder.createdAt, 'dd/MM/yyyy') : '---';
  const cnDateStr = safeFormatDate(cn.createdAt, 'dd/MM/yyyy HH:mm');

  const html = `
    <style>
      #print-container .thermal-ticket-wrapper { 
        width: 80mm; 
        padding: 5mm; 
        line-height: 1.25;
        background: white;
        margin: 0;
      }
      #print-container .center { text-align: center; }
      #print-container .bold { font-weight: bold; }
      #print-container .line { border-bottom: 1px dashed #000; margin: 5px 0; }
      #print-container .flex { display: flex; justify-content: space-between; }
      #print-container .title { font-size: 16px; margin-bottom: 5px; }
      #print-container .item-row { margin-bottom: 4px; }
    </style>
    <div class="center bold title">CHAZARRETA ERP</div>
    <div class="center">NOTA DE CRÉDITO</div>
    <div class="line"></div>
    <div class="flex"><span>FECHA NC:</span> <span>${cnDateStr}</span></div>
    <div class="flex"><span>NÚMERO:</span> <span>#NC-${String(cn.id).substring(0, 8).toUpperCase()}</span></div>
    <div class="line"></div>
    <div class="bold">CLIENTE:</div>
    <div>${cn.customerName}</div>
    <div class="flex"><span>COMANDA REF:</span> <span>#ORD-${String(cn.orderId).substring(0, 6).toUpperCase()}</span></div>
    <div class="flex"><span>FECHA REF:</span> <span>${orderDateStr}</span></div>
    <div class="line"></div>
    <div class="bold">DETALLE DE DEVOLUCIÓN:</div>
    <div class="line"></div>
    ${cn.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return `
        <div class="item-row">
          <div>${product?.name || 'Producto'}</div>
          <div class="flex">
            <span>${item.quantity} x $${Number(item.unitPrice || 0).toLocaleString()}</span>
            <span class="bold">-$${Number(item.total || 0).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('')}
    <div class="line"></div>
    <div class="flex bold" style="font-size: 14px;">
      <span>TOTAL ACREDITADO:</span>
      <span>-$${Number(cn.totalAmount || 0).toLocaleString()}</span>
    </div>
    <div class="line"></div>
    ${cn.reason ? `<div style="font-style: italic; font-size: 10px;">MOTIVO: ${cn.reason}</div><div class="line"></div>` : ''}
    <div class="center" style="font-size: 10px; margin-top: 10px;">
      Comprobante interno de crédito.<br/>Descontado de su cuenta corriente.
    </div>
  `;

  printHTML(html);
};

export const printCashClosingThermal = (session: CashSession, sessionReceipts: PaymentReceipt[]) => {
  let receiptsHtml = '';
  if (sessionReceipts.length > 0) {
    receiptsHtml = `
      <hr style="border-top: 1px dashed #000; margin: 10px 0;" />
      <h3 style="text-align: center; margin-bottom: 5px; font-size: 14px;">DETALLE DE COBROS</h3>
      <table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px dashed #000;">
            <th style="padding-bottom: 3px;">HORA</th>
            <th style="padding-bottom: 3px;">CLIENTE</th>
            <th style="padding-bottom: 3px; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${sessionReceipts.map(r => `
            <tr>
              <td style="padding: 3px 0; vertical-align: top;">${safeFormatDate(r.createdAt, 'HH:mm')}</td>
              <td style="padding: 3px 0; vertical-align: top;">
                ${r.customerName.substring(0, 15)}
                <div style="font-size: 9px; color: #555;">
                  ${r.cashAmount > 0 ? `EFE: $${r.cashAmount.toLocaleString()} ` : ''}
                  ${r.transferAmount > 0 ? `TRF: $${r.transferAmount.toLocaleString()} ` : ''}
                </div>
              </td>
              <td style="padding: 3px 0; vertical-align: top; text-align: right;">$${r.amount.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const html = `
    <div style="width: 80mm; padding: 5mm; font-size: 14px; line-height: 1.25; background: white; margin: 0;">
      <h2 style="text-align: center; margin-bottom: 5px;">CIERRE DE CAJA</h2>
      <hr style="border-top: 1px dashed #000; margin: 5px 0;" />
      <p><strong>Apertura:</strong> ${safeFormatDate(session.openedAt)}</p>
      <p><strong>Cierre:</strong> ${safeFormatDate(session.closedAt || new Date())}</p>
      <hr style="border-top: 1px dashed #000; margin: 5px 0;" />
      <p><strong>Efectivo Inicial:</strong> $${session.initialCash.toLocaleString()}</p>
      <p><strong>Cobros Efectivo:</strong> $${session.totalCashPayments.toLocaleString()}</p>
      <p><strong>Cobros Transf:</strong> $${session.totalTransferPayments.toLocaleString()}</p>
      <hr style="border-top: 1px dashed #000; margin: 5px 0;" />
      <p><strong>Efectivo Esperado:</strong> $${session.expectedCash?.toLocaleString()}</p>
      <p><strong>Efectivo Declarado:</strong> $${session.finalCashReported?.toLocaleString()}</p>
      <p><strong>Diferencia:</strong> $${((session.finalCashReported || 0) - (session.expectedCash || 0)).toLocaleString()}</p>
      ${receiptsHtml}
      <hr style="border-top: 1px dashed #000; margin: 15px 0;" />
      ${session.notes ? `<p style="font-size: 10px;">NOTAS: ${session.notes}</p>` : ''}
      <p style="text-align: center; font-size: 10px;">Cerrado por: ${session.closedBy}</p>
    </div>
  `;
  printHTML(html);
};

export const exportPriceListPDF = (list: PriceList, products: Product[]) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('CHAZARRETA ERP', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Lista de Precios: ${list.name.toUpperCase()}`, 14, 32);
  doc.text(`Vigente desde: ${safeFormatDate(list.updatedAt)}`, 14, 40);

  const tableData = products.map(p => [
    p.name,
    p.brand,
    p.category,
    `$${(p.prices[list.id] || 0).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Producto', 'Marca', 'Categoría', 'Precio']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 50 }
  });

  doc.save(`Lista_Precios_${list.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
