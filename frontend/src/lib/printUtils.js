export function printElementById(elementId, title = 'Impression') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const source = document.getElementById(elementId);
  if (!source) return false;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=1200');
  if (!printWindow) return false;

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  const baseStyle = `
    <style>
      @page { margin: 12mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-shell {
        padding: 24px;
      }
      .no-print {
        display: none !important;
      }
      ${title ? '.print-title{display:block;}' : ''}
    </style>
  `;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        ${styles}
        ${baseStyle}
      </head>
      <body>
        <div class="print-shell">${source.outerHTML}</div>
      </body>
    </html>`);
  printWindow.document.close();

  const triggerPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      setTimeout(() => {
        try {
          printWindow.close();
        } catch {
          // noop
        }
      }, 250);
    }
  };

  setTimeout(triggerPrint, 300);
  return true;
}
