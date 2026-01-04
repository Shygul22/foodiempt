import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MessageCircle, 
  Clock, 
  MapPin,
  Send,
  Headphones,
  HelpCircle,
  FileText,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setSubmitted(true);
    toast.success('Your message has been sent! We\'ll get back to you soon.');
  };

  const quickLinks = [
    { icon: FileText, title: 'FAQs', desc: 'Find answers to common questions', link: '/terms' },
    { icon: AlertTriangle, title: 'Report Issue', desc: 'Report problems with orders', link: '/refund' },
    { icon: HelpCircle, title: 'Help Center', desc: 'Browse help articles', link: '/terms' }
  ];

  const contactMethods = [
    { 
      icon: Phone, 
      title: 'Phone Support', 
      value: '+91 1800-123-4567',
      desc: 'Toll-free number',
      action: 'tel:+911800123456'
    },
    { 
      icon: Mail, 
      title: 'Email Support', 
      value: 'support@deliveryapp.com',
      desc: 'Get response within 24 hrs',
      action: 'mailto:support@deliveryapp.com'
    },
    { 
      icon: MessageCircle, 
      title: 'WhatsApp', 
      value: '+91 98765-43210',
      desc: 'Chat with us',
      action: 'https://wa.me/919876543210'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Customer Support</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        {/* Hero Section */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">How can we help you?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We're here to help! Reach out to us through any of the channels below.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.action}
              target={method.action.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <method.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{method.title}</h3>
                  <p className="text-primary font-medium">{method.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{method.desc}</p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        {/* Support Hours */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Support Hours</h3>
                <p className="text-muted-foreground">Available 24/7 for order-related queries</p>
                <p className="text-sm text-muted-foreground mt-1">
                  General inquiries: Mon-Sat, 9 AM - 6 PM IST
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map((link, index) => (
            <Link key={index} to={link.link}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-all hover:border-primary/20 cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{link.title}</h3>
                    <p className="text-sm text-muted-foreground">{link.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Contact Form */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send us a Message
            </CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you within 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
                <p className="text-muted-foreground mb-4">
                  Thank you for reaching out. We'll get back to you soon.
                </p>
                <Button onClick={() => setSubmitted(false)} variant="outline">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 98765-43210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="What's this about?"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Describe your issue or question in detail..."
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Office Address */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Corporate Office</h3>
                <p className="text-muted-foreground">
                  123 Business Park, Tech City<br />
                  Bangalore, Karnataka - 560001<br />
                  India
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency */}
        <Card className="border-0 shadow-sm border-destructive/20 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Emergency Support</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  For urgent order issues or safety concerns
                </p>
                <a href="tel:+911800999888" className="text-destructive font-semibold hover:underline">
                  +91 1800-999-888
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
