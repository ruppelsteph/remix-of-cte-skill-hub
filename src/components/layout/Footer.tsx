import { Link } from "react-router-dom";
import { Facebook, Twitter, Linkedin, Youtube, Mail } from "lucide-react";

const footerLinks = {
  platform: [
    { label: "Video Library", href: "/videos" },
    { label: "CTE Pathways", href: "/pathways" },
    { label: "Pricing", href: "/pricing" },
    { label: "For Schools", href: "/schools" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/about#contact" },
    { label: "Careers", href: "/about#careers" },
    { label: "Blog", href: "/blog" },
  ],
  support: [
    { label: "Help Center", href: "/support" },
    { label: "FAQs", href: "/support#faq" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="container-wide py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-primary-foreground"
                  fill="currentColor"
                >
                  <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              </div>
              <span className="text-lg font-heading font-bold">CTE Skills</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-secondary-foreground/80">
              High-quality training videos for Career & Technical Education. Empowering students, teachers, and schools with real-world skills.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="text-secondary-foreground/60 transition-colors hover:text-primary"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Platform</h4>
            <ul className="space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-secondary-foreground/70 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-secondary-foreground/10 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-secondary-foreground/60">
            © {new Date().getFullYear()} CTE Skills. All rights reserved.
          </p>
          <a
            href="mailto:support@cteskills.com"
            className="flex items-center gap-2 text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
          >
            <Mail className="h-4 w-4" />
            support@cteskills.com
          </a>
        </div>
      </div>
    </footer>
  );
}
