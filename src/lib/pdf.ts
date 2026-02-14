/**
 * Generate a printable HTML receipt for a shift
 */
export function generateShiftReceipt({
  date,
  cashierName,
  expectedCash,
  actualCash,
  cashDifference,
}: {
  date: string;
  cashierName: string;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
}): string {
  const discrepancyStatus =
    cashDifference === 0
      ? 'Parfait'
      : cashDifference < 0
        ? 'Manquant'
        : 'Surplus';

  const discrepancyColor =
    cashDifference === 0
      ? '#22c55e'
      : cashDifference < 0
        ? '#ef4444'
        : '#f97316';

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reçu de Clôture - ${date}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: white;
          padding: 20px;
        }
        .receipt {
          max-width: 600px;
          margin: 0 auto;
          border: 2px solid #333;
          padding: 30px;
          background: white;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .brand {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }
        .title {
          font-size: 13px;
          color: #444;
          margin-bottom: 2px;
        }
        .subtitle {
          font-size: 11px;
          color: #666;
        }
        .section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #ddd;
        }
        .section:last-child {
          border-bottom: none;
        }
        .section-title {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .label {
          color: #666;
        }
        .value {
          font-weight: 600;
          text-align: right;
        }
        .amount {
          min-width: 120px;
          text-align: right;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
          font-size: 16px;
          font-weight: bold;
        }
        .discrepancy {
          margin-top: 15px;
          padding: 15px;
          border-radius: 4px;
          text-align: center;
          color: white;
          background-color: ${discrepancyColor};
        }
        .discrepancy-status {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .discrepancy-amount {
          font-size: 24px;
          font-weight: bold;
        }
        footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #999;
        }
        @media print {
          body {
            padding: 0;
          }
          .receipt {
            border: none;
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="brand">PHARMAVAULT - REÇU OFFICIEL</div>
          <div class="title">🔐 PharmaVault</div>
          <div class="subtitle">Gestion Officinale Sécurisée</div>
        </div>

        <div class="section">
          <div class="section-title">Informations de Clôture</div>
          <div class="row">
            <span class="label">Date:</span>
            <span class="value">${date}</span>
          </div>
          <div class="row">
            <span class="label">Caissier:</span>
            <span class="value">${cashierName}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Rapprochement de Caisse</div>
          <div class="row">
            <span class="label">Espèces Attendues:</span>
            <span class="amount">${expectedCash.toFixed(2).replace('.', ',')} GNF</span>
          </div>
          <div class="row">
            <span class="label">Espèces Réelles:</span>
            <span class="amount">${actualCash.toFixed(2).replace('.', ',')} GNF</span>
          </div>
          <div class="total-row">
            <span>Écart:</span>
            <span class="amount">${cashDifference >= 0 ? '+' : ''}${cashDifference.toFixed(2).replace('.', ',')} GNF</span>
          </div>
        </div>

        <div class="discrepancy">
          <div class="discrepancy-status">${discrepancyStatus}</div>
          <div class="discrepancy-amount">${cashDifference >= 0 ? '+' : ''}${cashDifference.toFixed(2).replace('.', ',')} GNF</div>
        </div>

        <footer>
          <p>Généré le ${new Date().toLocaleString('fr-FR')} - Document certifié par l'administration.</p>
        </footer>
      </div>
    </body>
    </html>
  `;
}

/**
 * Download a shift receipt as PDF by opening print dialog
 */
export function downloadShiftReceiptPDF({
  date,
  cashierName,
  expectedCash,
  actualCash,
  cashDifference,
}: {
  date: string;
  cashierName: string;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
}): void {
  const html = generateShiftReceipt({
    date,
    cashierName,
    expectedCash,
    actualCash,
    cashDifference,
  });

  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Impossible d\'ouvrir le fichier. Vérifiez les paramètres de votre navigateur.');
    return;
  }

  newWindow.document.write(html);
  newWindow.document.close();

  // Wait for content to load, then trigger print
  newWindow.onload = () => {
    newWindow.print();
  };
}
