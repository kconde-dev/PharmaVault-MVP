import { supabase } from '@/lib/supabase';

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

export const DEFAULT_SETTINGS: AppSettings = {
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

type AppSettingsRow = {
    pharmacy_name: string;
    pharmacy_address: string;
    pharmacy_phone: string;
    pharmacy_email: string;
    whatsapp_enabled: boolean;
    whatsapp_recipient_number: string;
};

function normalizeSettings(raw: unknown): AppSettings {
    if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
    const source = raw as Partial<AppSettings>;
    const pharmacy = source.pharmacy || {};
    const whatsapp = source.whatsapp || {};

    return {
        pharmacy: {
            name: typeof pharmacy.name === 'string' ? pharmacy.name : DEFAULT_SETTINGS.pharmacy.name,
            address: typeof pharmacy.address === 'string' ? pharmacy.address : DEFAULT_SETTINGS.pharmacy.address,
            phone: typeof pharmacy.phone === 'string' ? pharmacy.phone : DEFAULT_SETTINGS.pharmacy.phone,
            email: typeof pharmacy.email === 'string' ? pharmacy.email : DEFAULT_SETTINGS.pharmacy.email,
        },
        whatsapp: {
            enabled: typeof whatsapp.enabled === 'boolean' ? whatsapp.enabled : DEFAULT_SETTINGS.whatsapp.enabled,
            recipientNumber: typeof whatsapp.recipientNumber === 'string'
                ? whatsapp.recipientNumber
                : DEFAULT_SETTINGS.whatsapp.recipientNumber,
        },
    };
}

function rowToSettings(row: AppSettingsRow): AppSettings {
    return {
        pharmacy: {
            name: row.pharmacy_name,
            address: row.pharmacy_address,
            phone: row.pharmacy_phone,
            email: row.pharmacy_email,
        },
        whatsapp: {
            enabled: row.whatsapp_enabled,
            recipientNumber: row.whatsapp_recipient_number,
        },
    };
}

function settingsToRow(settings: AppSettings): AppSettingsRow {
    return {
        pharmacy_name: settings.pharmacy.name,
        pharmacy_address: settings.pharmacy.address,
        pharmacy_phone: settings.pharmacy.phone,
        pharmacy_email: settings.pharmacy.email,
        whatsapp_enabled: settings.whatsapp.enabled,
        whatsapp_recipient_number: settings.whatsapp.recipientNumber,
    };
}

export const getSettings = (): AppSettings => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    try {
        return normalizeSettings(JSON.parse(saved));
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const saveSettingsLocal = (settings: AppSettings): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const loadSettingsFromDatabase = async (): Promise<AppSettings> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('pharmacy_name, pharmacy_address, pharmacy_phone, pharmacy_email, whatsapp_enabled, whatsapp_recipient_number')
        .eq('id', 1)
        .single();

    if (error || !data) {
        return getSettings();
    }

    const settings = rowToSettings(data as AppSettingsRow);
    saveSettingsLocal(settings);
    return settings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    const normalized = normalizeSettings(settings);

    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                id: 1,
                ...settingsToRow(normalized),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
        );

    if (error) throw error;
    saveSettingsLocal(normalized);
};
