import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  Users, 
  BarChart3, 
  Shield, 
  Headphones,
  Building2
} from "lucide-react";

const Schools = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: "Request Submitted!",
      description: "Our team will contact you within 1-2 business days.",
    });
    
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">For Institutions</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-secondary-foreground mb-4">
              CTE Skills for Schools & Districts
            </h1>
            <p className="text-lg text-muted-foreground">
              Empower your CTE programs with unlimited access to professional training videos. 
              Flexible licensing for any size institution.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Why Schools Choose CTE Skills
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Unlimited Users</h3>
              <p className="text-sm text-muted-foreground">
                One license covers all students and teachers in your CTE department.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Usage Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Track student engagement and video completion with detailed reports.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">FERPA Compliant</h3>
              <p className="text-sm text-muted-foreground">
                Student data is protected and never shared with third parties.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Headphones className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Priority Support</h3>
              <p className="text-sm text-muted-foreground">
                Dedicated account manager and technical support for your institution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Everything Your CTE Program Needs
              </h2>
              <ul className="space-y-4">
                {[
                  "Access to 150+ professional training videos",
                  "Coverage of 6 major CTE pathways",
                  "Teacher admin dashboard and controls",
                  "Student progress tracking",
                  "LMS integration (Canvas, Blackboard, etc.)",
                  "Custom playlist creation for courses",
                  "New content added monthly",
                  "Downloadable supplementary materials",
                  "Purchase order and invoice billing",
                  "Multi-year discount pricing",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Request a Quote
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Tell us about your institution and we'll prepare a custom proposal.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" required className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" required className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" type="email" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="institution">School / District Name</Label>
                  <Input id="institution" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="role">Your Role</Label>
                  <Input id="role" placeholder="e.g., CTE Director, Principal" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="students">Estimated # of Students</Label>
                  <Input id="students" type="number" placeholder="e.g., 500" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="message">Additional Information</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Tell us about your CTE programs and needs..."
                    className="mt-1"
                    rows={4}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Request Quote"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-xl md:text-2xl text-foreground mb-6 italic">
              "CTE Skills has been a game-changer for our district. The quality of videos and the ease 
              of integration into our curriculum has significantly improved student engagement in our 
              CTE programs."
            </blockquote>
            <div>
              <p className="font-semibold text-foreground">Dr. Maria Rodriguez</p>
              <p className="text-muted-foreground">Director of Career & Technical Education</p>
              <p className="text-muted-foreground text-sm">Clark County School District, Nevada</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Schools;
