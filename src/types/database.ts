export type AppRole = 'super_admin' | 'restaurant_owner' | 'delivery_partner' | 'customer' | 'support_agent';

export type ShopCategory = 'food' | 'grocery' | 'fruits' | 'vegetables' | 'meat' | 'medicine' | 'bakery' | 'beverages';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  pincode: string | null;
  image_url: string | null;
  cuisine_type: string | null;
  category: string;
  lat: number | null;
  lng: number | null;
  is_verified: boolean;
  is_open: boolean;
  commission_rate: number;
  rating: number | null;
  estimated_delivery_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartner {
  id: string;
  user_id: string;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  vehicle_type: string | null;
  phone: string | null;
  phone_verified: boolean;
  verification_otp: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'cod' | 'gpay';

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  delivery_partner_id: string | null;
  status: OrderStatus;
  total_amount: number;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  notes: string | null;
  payment_method: string;
  delivery_otp: string | null;
  pickup_otp: string | null;
  scheduled_at: string | null;
  is_scheduled: boolean;
  delivery_fee: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface CustomerAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FavouriteShop {
  id: string;
  user_id: string;
  restaurant_id: string;
  created_at: string;
}

export interface AppSettings {
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export interface Settlement {
  id: string;
  delivery_partner_id: string | null;
  restaurant_id: string | null;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
  reference_no: string | null;
  processed_at: string | null;
  created_at: string;
  profiles?: Profile;
  restaurants?: Restaurant;
}


export interface DeliveryPincode {
  id: string;
  pincode: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantDeliveryPincode {
  id: string;
  restaurant_id: string;
  pincode: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
