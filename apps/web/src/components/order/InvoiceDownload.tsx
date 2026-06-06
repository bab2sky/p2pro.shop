import { FileDown } from 'lucide-react';

interface OrderItem {
  product_title: string;
  option_label?: string | null;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
}

interface OrderData {
  order_number: string;
  created_at: string;
  recipient_name: string;
  seller_name: string;
  items: OrderItem[];
  subtotal: string | number;
  shipping_fee: string | number;
  total_amount: string | number;
}

export function InvoiceDownload({ order }: { order: OrderData }) {
  const handleDownload = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('P2PRO STORE', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('INVOICE / RECEIPT', 20, y);
    y += 12;

    // Invoice number & date
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Invoice No: ${order.order_number}`, 20, y);
    const dateStr = order.created_at
      ? new Date(order.created_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '-';
    doc.text(`Date: ${dateStr}`, pageWidth - 20, y, { align: 'right' });
    y += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Buyer info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Buyer', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${order.recipient_name}`, 20, y);
    y += 6;
    doc.text(`Seller: ${order.seller_name}`, 20, y);
    y += 12;

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Product', 22, y);
    doc.text('Qty', 120, y, { align: 'center' });
    doc.text('Unit Price', 145, y, { align: 'center' });
    doc.text('Subtotal', pageWidth - 22, y, { align: 'right' });
    y += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const item of order.items) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const title = item.option_label
        ? `${item.product_title} (${item.option_label})`
        : item.product_title;
      // Truncate long titles
      const truncated = title.length > 40 ? title.substring(0, 37) + '...' : title;
      doc.text(truncated, 22, y);
      doc.text(String(item.quantity), 120, y, { align: 'center' });
      doc.text(`${Number(item.unit_price).toLocaleString()} USDT`, 145, y, { align: 'center' });
      doc.text(`${Number(item.subtotal).toLocaleString()} USDT`, pageWidth - 22, y, { align: 'right' });
      y += 7;
    }

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    // Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 120, y);
    doc.text(`${Number(order.subtotal).toLocaleString()} USDT`, pageWidth - 22, y, { align: 'right' });
    y += 6;

    doc.text('Shipping:', 120, y);
    doc.text(`${Number(order.shipping_fee).toLocaleString()} USDT`, pageWidth - 22, y, { align: 'right' });
    y += 8;

    doc.setDrawColor(50, 50, 50);
    doc.line(120, y, pageWidth - 20, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total:', 120, y);
    doc.text(`${Number(order.total_amount).toLocaleString()} USDT`, pageWidth - 22, y, { align: 'right' });
    y += 20;

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('P2PRO Store - USDT Escrow P2P Marketplace', pageWidth / 2, y, { align: 'center' });

    doc.save(`P2PRO_Invoice_${order.order_number}.pdf`);
  };

  return (
    <button
      onClick={handleDownload}
      aria-label="영수증 PDF 다운로드"
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 py-3 text-[13px] font-bold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
    >
      <FileDown className="h-4 w-4" />
      영수증 다운로드
    </button>
  );
}
