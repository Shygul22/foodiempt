import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Clock, Calendar, Save } from 'lucide-react';

interface ScheduleConfig {
    enabled: boolean;
    startTime: string;
    endTime: string;
    maxDays: number;
}

const DEFAULT_CONFIG: ScheduleConfig = {
    enabled: true,
    startTime: '09:00',
    endTime: '22:00',
    maxDays: 2
};

interface OperatingHoursConfig {
    isOpen: boolean;
    startTime: string;
    endTime: string;
}

const DEFAULT_OPERATING_HOURS: OperatingHoursConfig = {
    isOpen: true,
    startTime: '08:00',
    endTime: '23:00'
};

export function ScheduleSettings() {
    const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
    const [operatingHours, setOperatingHours] = useState<OperatingHoursConfig>(DEFAULT_OPERATING_HOURS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const saveScheduleSettings = useCallback(async (newConfig: ScheduleConfig) => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'schedule_config',
                value: newConfig as any
            });
        if (error) throw error;
    }, []);

    const saveOperatingHours = useCallback(async (newConfig: OperatingHoursConfig) => {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'operating_hours',
                value: newConfig as any
            });
        if (error) throw error;
    }, []);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const { data: scheduleData, error: scheduleError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'schedule_config')
                .maybeSingle();

            if (scheduleData?.value) {
                const parsed = typeof scheduleData.value === 'string' ? JSON.parse(scheduleData.value) : scheduleData.value;
                setConfig({ ...DEFAULT_CONFIG, ...parsed });
            } else {
                await saveScheduleSettings(DEFAULT_CONFIG);
            }

            const { data: opData, error: opError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'operating_hours')
                .maybeSingle();

            if (opData?.value) {
                const parsed = typeof opData.value === 'string' ? JSON.parse(opData.value) : opData.value;
                setOperatingHours({ ...DEFAULT_OPERATING_HOURS, ...parsed });
            } else {
                await saveOperatingHours(DEFAULT_OPERATING_HOURS);
            }

        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, [saveScheduleSettings, saveOperatingHours]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                saveScheduleSettings(config),
                saveOperatingHours(operatingHours)
            ]);
            toast.success('All settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof ScheduleConfig, value: string | number | boolean) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleOpChange = (field: keyof OperatingHoursConfig, value: string | boolean) => {
        setOperatingHours(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return <div className="p-4">Loading settings...</div>;
    }

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Platform Time Settings
                </CardTitle>
                <CardDescription>
                    Configure operating hours and scheduled order constraints.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Operating Hours Section */}
                <div className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Platform Operating Hours
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">Store Open Status</Label>
                            <p className="text-sm text-muted-foreground">
                                Manually open or close the platform for immediate orders.
                            </p>
                        </div>
                        <Switch
                            checked={operatingHours.isOpen}
                            onCheckedChange={(checked) => handleOpChange('isOpen', checked)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Opening Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={operatingHours.startTime}
                                    onChange={(e) => handleOpChange('startTime', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Closing Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={operatingHours.endTime}
                                    onChange={(e) => handleOpChange('endTime', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scheduled Orders Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Future Scheduling Constraints
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">Enable Scheduled Orders</Label>
                            <p className="text-sm text-muted-foreground">
                                Allow customers to place orders for a future time/date
                            </p>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) => handleChange('enabled', checked)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Scheduling Start Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={config.startTime}
                                    onChange={(e) => handleChange('startTime', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Earliest slot available for booking</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Scheduling End Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={config.endTime}
                                    onChange={(e) => handleChange('endTime', e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Latest slot available for booking</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Max Days in Advance</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={config.maxDays}
                                    onChange={(e) => handleChange('maxDays', parseInt(e.target.value))}
                                    className="pl-9"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">How far ahead can customers book?</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>Saving...</>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save All Changes
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
