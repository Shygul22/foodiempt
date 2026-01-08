import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Terms & Conditions</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl prose prose-sm dark:prose-invert">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using this food delivery application, you accept and agree to be bound by the terms and provisions of this agreement.</p>

        <h2>2. Use of Service</h2>
        <p>You agree to use the service only for lawful purposes. You must not use the service in any way that causes, or may cause, damage to the service or impairment of the availability or accessibility of the service.</p>

        <h2>3. User Accounts</h2>
        <p>When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding the password and for all activities that occur under your account.</p>

        <h2>4. Orders and Payments</h2>
        <p>All orders are subject to availability. We reserve the right to refuse any order you place with us. Prices for products are subject to change without notice.</p>

        <h2>5. Delivery</h2>
        <p>Delivery times provided are estimates only. We are not responsible for delays caused by factors outside our control, including but not limited to traffic, weather conditions, and restaurant preparation times.</p>

        <h2>6. Cancellation Policy</h2>
        <p>Orders may be cancelled within a limited timeframe after placement. Once the restaurant has started preparing your order, cancellation may not be possible.</p>

        <h2>7. Liability</h2>
        <p>We are not liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.</p>

        <h2>8. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. Your continued use of the service following any changes constitutes acceptance of the new terms.</p>

        <h2>9. Contact</h2>
        <p>If you have any questions about these Terms, please contact our support team.</p>

        <p className="text-muted-foreground text-sm mt-8">Last updated: January 2026</p>
      </div>
    </div>
  );
}
