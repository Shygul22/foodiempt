import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, addDays, setHours, setMinutes, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleDeliveryProps {
  isScheduled: boolean;
  scheduledAt: Date | null;
  onScheduleChange: (isScheduled: boolean, scheduledAt: Date | null) => void;
}

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

export function ScheduleDelivery({ isScheduled, scheduledAt, onScheduleChange }: ScheduleDeliveryProps) {
  const [date, setDate] = useState<Date | undefined>(scheduledAt || undefined);
  const [time, setTime] = useState<string>(scheduledAt ? format(scheduledAt, 'HH:mm') : '12:00');

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const defaultDate = addDays(new Date(), 1);
      setDate(defaultDate);
      const [hours, minutes] = time.split(':').map(Number);
      const scheduled = setMinutes(setHours(defaultDate, hours), minutes);
      onScheduleChange(true, scheduled);
    } else {
      onScheduleChange(false, null);
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduled = setMinutes(setHours(newDate, hours), minutes);
      onScheduleChange(true, scheduled);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const scheduled = setMinutes(setHours(date, hours), minutes);
      onScheduleChange(true, scheduled);
    }
  };

  const disabledDays = (day: Date) => {
    return isBefore(day, startOfDay(new Date()));
  };

  return (
    <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <Label htmlFor="schedule-toggle" className="font-medium">Schedule for later</Label>
        </div>
        <Switch
          id="schedule-toggle"
          checked={isScheduled}
          onCheckedChange={handleToggle}
        />
      </div>

      {isScheduled && (
        <div className="space-y-3 pt-2 animate-fade-in">
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  disabled={disabledDays}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={time} onValueChange={handleTimeChange}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scheduledAt && (
            <p className="text-sm text-muted-foreground">
              Your order will be delivered on{' '}
              <span className="font-medium text-foreground">
                {format(scheduledAt, 'EEEE, MMMM d')}
              </span>{' '}
              at{' '}
              <span className="font-medium text-foreground">
                {format(scheduledAt, 'h:mm a')}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
