export interface PharmacyInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
}

export interface WhatsAppSettings {
    enabled: boolean;
    recipientNumber: string;
}

export interface AppSettings {
    pharmacy: PharmacyInfo;
    whatsapp: WhatsAppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
    pharmacy: {
        name: 'PharmaVault Officine',
        address: 'Conakry, Guinée',
        phone: '+224 000 00 00 00',
        email: 'contact@pharmavault.gn',
    },
    whatsapp: {
        enabled: true,
        recipientNumber: '+224622000000',
    },
};

const STORAGE_KEY = 'pharmavault_settings';

export const getSettings = (): AppSettings => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    try {
        return JSON.parse(saved);
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const saveSettings = (settings: AppSettings): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
