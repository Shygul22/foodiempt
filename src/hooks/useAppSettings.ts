import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
    enable_phone_login: boolean;
    [key: string]: any;
}

const defaultSettings: AppSettings = {
    enable_phone_login: true,
};

export const useAppSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial fetch
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('*');

                if (error) {
                    console.error('Error fetching app settings:', error);
                    return;
                }

                if (data) {
                    const newSettings = { ...defaultSettings };
                    data.forEach((item: any) => {
                        newSettings[item.key] = item.value;
                    });
                    setSettings(newSettings);
                }
            } catch (err) {
                console.error('Failed to fetch app settings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();

        // Real-time subscription
        const channel = supabase
            .channel('app_settings_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'app_settings'
                },
                async (payload) => {
                    console.log('App setting changed:', payload);
                    // Refresh all settings on any change for simplicity, or update specific key
                    fetchSettings();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const isPhoneLoginEnabled = () => {
        return settings.enable_phone_login === true; // Strict check or just truthy
    };

    return {
        settings,
        loading,
        isPhoneLoginEnabled
    };
};
