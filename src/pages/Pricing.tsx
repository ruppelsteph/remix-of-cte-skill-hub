import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

const Pricing = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that works best for you. Full access to all CTE pathways and training videos.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Monthly Plan */}
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Monthly</h3>
              <p className="text-muted-foreground text-sm mb-6">For individuals exploring CTE</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-card-foreground">$49.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Access all 150+ videos",
                  "All 6 CTE pathways",
                  "New content monthly",
                  "Cancel anytime",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>

            {/* Annual Plan - Featured */}
            <div className="bg-card rounded-2xl p-8 border-2 border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Best Value
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Annual</h3>
              <p className="text-muted-foreground text-sm mb-6">Save 20% with yearly billing</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-card-foreground">$39.99</span>
                <span className="text-muted-foreground">/month</span>
                <p className="text-sm text-muted-foreground mt-1">Billed annually at $479.99</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Access all 150+ videos",
                  "All 6 CTE pathways",
                  "New content monthly",
                  "Priority support",
                  "Downloadable resources",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>

            {/* School/District Plan */}
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <h3 className="text-xl font-semibold text-card-foreground mb-2">School / District</h3>
              <p className="text-muted-foreground text-sm mb-6">Multi-seat licenses for institutions</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-card-foreground">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited student access",
                  "Teacher admin dashboard",
                  "Usage analytics & reports",
                  "LMS integration support",
                  "Dedicated account manager",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link to="/schools">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: "Can I try before I subscribe?",
                a: "Yes! You can browse our entire video library and preview video details before subscribing. Some sample content is available for free.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards, PayPal, and purchase orders for school/district subscriptions.",
              },
              {
                q: "Can I cancel my subscription anytime?",
                a: "Absolutely. You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
              },
              {
                q: "Do you offer discounts for students?",
                a: "Yes, we offer special pricing for students with a valid .edu email address. Contact us for details.",
              },
              {
                q: "How do school/district licenses work?",
                a: "School licenses provide access for all students and teachers in your CTE program. We offer flexible pricing based on your needs. Contact our sales team to get started.",
              },
            ].map((faq, index) => (
              <div key={index} className="bg-card rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-card-foreground mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-secondary-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of students and educators already using CTE Skills.
          </p>
          <Button asChild size="lg">
            <Link to="/auth?mode=signup">
              Start Learning Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
