import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Audio context for notification sounds
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
<<<<<<< HEAD
    audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
=======
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
  }
  return audioContext;
};

// Play notification sound
const playNotificationSound = (type: 'order' | 'status' = 'order') => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'order') {
      // More urgent sound for new orders
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } else {
      // Softer sound for status updates
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

// Hook for restaurant owners to get notified of new orders
export const useRestaurantOrderNotifications = (restaurantId: string | undefined) => {
  const previousOrdersRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`restaurant-notifications-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (!initialLoadRef.current) {
            playNotificationSound('order');
            toast.success('🔔 New order received!', {
              description: 'A customer has placed a new order',
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    // Mark initial load complete after a short delay
    setTimeout(() => {
      initialLoadRef.current = false;
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);
};

// Hook for customers to get notified of order status changes
export const useCustomerOrderNotifications = (orderId: string | undefined) => {
  const previousStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
<<<<<<< HEAD
        (payload: unknown) => {
          const p = payload as { new: { status: string } };
          const newStatus = p.new?.status;
          if (previousStatusRef.current && newStatus !== previousStatusRef.current) {
            playNotificationSound('status');

=======
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (previousStatusRef.current && newStatus !== previousStatusRef.current) {
            playNotificationSound('status');
            
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
            const statusMessages: Record<string, string> = {
              confirmed: '✅ Order confirmed by restaurant!',
              preparing: '👨‍🍳 Your order is being prepared',
              ready_for_pickup: '📦 Order ready for pickup',
              picked_up: '🚴 Delivery partner picked up your order',
              on_the_way: '🛵 Your order is on the way!',
              delivered: '🎉 Order delivered successfully!',
              cancelled: '❌ Order has been cancelled',
            };

            const message = statusMessages[newStatus] || `Order status: ${newStatus}`;
            toast.info(message, { duration: 4000 });
          }
          previousStatusRef.current = newStatus;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);
};

// Hook for delivery partners to get notified of available orders
export const useDeliveryPartnerNotifications = (partnerId: string | undefined, isAvailable: boolean) => {
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!partnerId || !isAvailable) return;

    const channel = supabase
      .channel(`delivery-notifications-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
<<<<<<< HEAD
        (payload) => {
          const p = payload as unknown as { new: { status: string; delivery_partner_id: string | null }; old: { status: string } };
          // Notify when an order becomes ready for pickup
          if (
            !initialLoadRef.current &&
            p.new?.status === 'ready_for_pickup' &&
            p.old?.status !== 'ready_for_pickup' &&
            !p.new?.delivery_partner_id
=======
        (payload: any) => {
          // Notify when an order becomes ready for pickup
          if (
            !initialLoadRef.current &&
            payload.new?.status === 'ready_for_pickup' &&
            payload.old?.status !== 'ready_for_pickup' &&
            !payload.new?.delivery_partner_id
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
          ) {
            playNotificationSound('order');
            toast.success('🚴 New delivery available!', {
              description: 'An order is ready for pickup',
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    // Mark initial load complete after a short delay
    setTimeout(() => {
      initialLoadRef.current = false;
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, isAvailable]);
};

// Export the playNotificationSound for manual triggers if needed
export { playNotificationSound };
