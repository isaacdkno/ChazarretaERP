
export const printHTML = (html: string) => {
  // 1. Limpiar cualquier rastro del método anterior en el DOM para asegurar que no rompa el diseño
  const oldContainer = document.getElementById('print-container');
  if (oldContainer) oldContainer.remove();
  const oldStyle = document.getElementById('print-style');
  if (oldStyle) oldStyle.remove();

  // 2. Abrir una nueva ventana para la impresión (método más seguro y compatible)
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (!printWindow) {
    alert("El navegador bloqueó la impresión. Por favor, permite las ventanas emergentes (pop-ups) para este sitio.");
    return;
  }

  // 3. Limpiar las clases CSS cacheadas del método anterior
  const cleanHtml = html.replace(/#print-container /g, '');

  // 4. Escribir el contenido en la nueva ventana
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Impresión de Ticket</title>
        <style>
          /* Configuración estricta para impresora térmica de 80mm */
          @page { 
            margin: 0; 
            size: 80mm auto; 
          }
          body { 
            margin: 0; 
            padding: 0; 
            background: white; 
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
            font-weight: 700 !important;
            font-size: 16px !important; 
            width: 80mm;
          }
          .thermal-ticket-wrapper * {
            font-family: Arial, sans-serif !important;
            font-weight: 700 !important;
            color: #000000 !important;
          }
          .thermal-ticket-wrapper {
            width: 80mm;
            box-sizing: border-box;
            padding: 2mm;
          }
          /* Asegurar que el contenido no desborde */
          img, table { max-width: 100%; }
        </style>
      </head>
      <body>
        <div class="thermal-ticket-wrapper">
          ${cleanHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
