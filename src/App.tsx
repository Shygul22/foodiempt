import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RestaurantDetail from "./pages/RestaurantDetail";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import OrderTracking from "./pages/OrderTracking";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import Offers from "./pages/Offers";
import Refer from "./pages/Refer";
import Promotions from "./pages/Promotions";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import MainLayout from "./components/MainLayout";
import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public/Auth routes */}
              <Route path="/auth" element={<Auth />} />

              {/* Admin/Dashboard routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/restaurant" element={<RestaurantDashboard />} />
              <Route path="/delivery" element={<DeliveryDashboard />} />

              {/* Main App Layout for Consumer Routes */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/restaurant/:id" element={<RestaurantDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/order/:orderId" element={<OrderTracking />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/offers" element={<Offers />} />
                <Route path="/refer" element={<Refer />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
