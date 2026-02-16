export const BIZMAP_SUPPORT_URL =
  'https://wa.me/224XXXXXXXXX?text=Bonjour%20BIZMAP%2C%20j%27ai%20besoin%20d%27assistance%20sur%20PharmaVault%20pour%20Pharmacie%20Djoma.';

export function openBizmapSupportChat(): void {
  window.open(BIZMAP_SUPPORT_URL, '_blank', 'noopener,noreferrer');
}
