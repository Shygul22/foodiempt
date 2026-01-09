import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const useHaptics = () => {
    const isAvailable = Capacitor.isNativePlatform();

    const impact = async (style: ImpactStyle = ImpactStyle.Light) => {
        if (isAvailable) {
            try {
                await Haptics.impact({ style });
            } catch (error) {
                console.error('Haptics impact error:', error);
            }
        }
    };

    const notification = async (type: NotificationType = NotificationType.Success) => {
        if (isAvailable) {
            try {
                await Haptics.notification({ type });
            } catch (error) {
                console.error('Haptics notification error:', error);
            }
        }
    };

    const selection = async () => {
        if (isAvailable) {
            try {
                await Haptics.selectionStart();
                await Haptics.selectionChanged();
                await Haptics.selectionEnd();
            } catch (error) {
                console.error('Haptics selection error:', error);
            }
        }
    };

    return {
        impact,
        notification,
        selection,
        isAvailable
    };
};
