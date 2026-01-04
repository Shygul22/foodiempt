import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Refund() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Refund Policy</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl prose prose-sm dark:prose-invert">
        <h2>1. Refund Eligibility</h2>
        <p>You may be eligible for a refund in the following cases:</p>
        <ul>
          <li>Order not delivered</li>
          <li>Wrong items delivered</li>
          <li>Items missing from order</li>
          <li>Poor quality or damaged items</li>
          <li>Order cancelled before preparation</li>
        </ul>

        <h2>2. Refund Process</h2>
        <p>To request a refund:</p>
        <ul>
          <li>Contact support within 24 hours of delivery</li>
          <li>Provide your order ID and details of the issue</li>
          <li>Include photos if applicable (for damaged/wrong items)</li>
        </ul>

        <h2>3. Refund Timeline</h2>
        <p>Once approved, refunds will be processed within 5-7 business days:</p>
        <ul>
          <li><strong>Online Payments:</strong> Refunded to original payment method</li>
          <li><strong>Cash on Delivery:</strong> Credited to your app wallet</li>
        </ul>

        <h2>4. Non-Refundable Cases</h2>
        <p>Refunds will not be provided for:</p>
        <ul>
          <li>Change of mind after order is prepared</li>
          <li>Incorrect address provided by customer</li>
          <li>Customer unavailable at delivery</li>
          <li>Issues reported after 24 hours</li>
        </ul>

        <h2>5. Partial Refunds</h2>
        <p>In some cases, we may offer a partial refund or credits for future orders, depending on the nature of the issue.</p>

        <h2>6. Disputes</h2>
        <p>If you disagree with our refund decision, you can escalate the issue to our customer support team for further review.</p>

        <h2>7. Contact</h2>
        <p>For refund-related queries, please contact our support team with your order details.</p>

        <p className="text-muted-foreground text-sm mt-8">Last updated: January 2026</p>
      </div>
    </div>
  );
}
