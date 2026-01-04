import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Privacy Policy</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl prose prose-sm dark:prose-invert">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including your name, email address, phone number, delivery address, and payment information when you create an account or place an order.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Process and deliver your orders</li>
          <li>Send you order confirmations and updates</li>
          <li>Respond to your comments and questions</li>
          <li>Send promotional communications (with your consent)</li>
          <li>Improve our services</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>We share your information with:</p>
        <ul>
          <li>Restaurants to fulfill your orders</li>
          <li>Delivery partners to deliver your orders</li>
          <li>Payment processors to process transactions</li>
        </ul>

        <h2>4. Data Security</h2>
        <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>

        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Delete your account and data</li>
          <li>Opt-out of marketing communications</li>
        </ul>

        <h2>6. Cookies</h2>
        <p>We use cookies and similar tracking technologies to track activity on our service and hold certain information to improve your experience.</p>

        <h2>7. Changes to This Policy</h2>
        <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>

        <h2>8. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact our support team.</p>

        <p className="text-muted-foreground text-sm mt-8">Last updated: January 2026</p>
      </div>
    </div>
  );
}
