export const DEFAULT_WHATSAPP_NUMBER = '224656911019';

/**
 * Build a WhatsApp deep link with pre-filled message.
 */
export function buildWhatsAppLink(
  message: string,
  phoneNumber: string = DEFAULT_WHATSAPP_NUMBER,
): string {
  const encodedMessage = encodeURIComponent(message);
  const normalizedNumber = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${normalizedNumber}?text=${encodedMessage}`;
}

/**
 * Generate a formatted WhatsApp message for shift closing summary
 */
export function generateWhatsAppMessage({
  date,
  cashierName,
  totalRecettes,
  recettesEspeces,
  recettesOrangeMoney,
  recettesAssurance,
  totalDepenses,
  cashDifference,
}: {
  date: string;
  cashierName: string;
  totalRecettes: number;
  recettesEspeces: number;
  recettesOrangeMoney: number;
  recettesAssurance: number;
  totalDepenses: number;
  cashDifference: number;
}): string {
  const formatAmount = (amount: number): string => 
    `${amount.toFixed(2).replace('.', ',')} GNF`;

  return (
    `🚀 PharmaVault: Rapport de Clôture 🚀\n` +
    `\n` +
    `📅 Date: ${date}\n` +
    `👤 Caissier: ${cashierName}\n` +
    `\n` +
    `💼 RECETTES TOTALES: ${formatAmount(totalRecettes)}\n` +
    `  💵 Espèces: ${formatAmount(recettesEspeces)}\n` +
    `  📱 Orange Money: ${formatAmount(recettesOrangeMoney)}\n` +
    `  🏥 Assurance: ${formatAmount(recettesAssurance)}\n` +
    `\n` +
    `📉 Dépenses Approuvées: ${formatAmount(totalDepenses)}\n` +
    `\n` +
    `⚠️ ÉCART DE CAISSE: ${cashDifference >= 0 ? '+' : ''}${formatAmount(cashDifference)}\n` +
    `${cashDifference === 0 ? '✅ Parfait!' : cashDifference < 0 ? '❌ Manquant' : '✓ Surplus'}\n` +
    `\n` +
    `🔐 PharmaVault - Gestion Officinale Sécurisée`
  );
}

/**
 * Open WhatsApp with pre-filled message
 */
export function shareViaWhatsApp(message: string, phoneNumber?: string): void {
  const whatsappUrl = phoneNumber
    ? buildWhatsAppLink(message, phoneNumber)
    : buildWhatsAppLink(message);

  window.open(whatsappUrl, '_blank', 'width=600,height=400');
}
