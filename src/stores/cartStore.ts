import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, MenuItem } from '@/types/database';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (menuItem: MenuItem, restaurantId: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,

      addItem: (menuItem: MenuItem, restaurantId: string) => {
        const { items, restaurantId: currentRestaurantId } = get();
        
        // If adding from a different restaurant, clear cart first
        if (currentRestaurantId && currentRestaurantId !== restaurantId) {
          set({ items: [{ menuItem, quantity: 1 }], restaurantId });
          return;
        }

        const existingItem = items.find((item) => item.menuItem.id === menuItem.id);
        
        if (existingItem) {
          set({
            items: items.map((item) =>
              item.menuItem.id === menuItem.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
            restaurantId,
          });
        } else {
          set({
            items: [...items, { menuItem, quantity: 1 }],
            restaurantId,
          });
        }
      },

      removeItem: (menuItemId: string) => {
        const { items } = get();
        const newItems = items.filter((item) => item.menuItem.id !== menuItemId);
        set({
          items: newItems,
          restaurantId: newItems.length === 0 ? null : get().restaurantId,
        });
      },

      updateQuantity: (menuItemId: string, quantity: number) => {
        const { items } = get();
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set({
          items: items.map((item) =>
            item.menuItem.id === menuItemId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({ items: [], restaurantId: null });
      },

      getTotalAmount: () => {
        return get().items.reduce(
          (total, item) => total + Number(item.menuItem.price) * item.quantity,
          0
        );
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
