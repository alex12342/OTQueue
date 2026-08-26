import { Link } from "wouter";
import {
  ClipboardList,
  Users,
  Shield,
  Github,
  ArrowRight,
  RotateCcw,
  Calendar,
  Clock,
  Scale,
  Server,
  Code,
} from "lucide-react";
import { versionLabel } from "@/lib/version";

const GITHUB_URL = "https://github.com/alex12342/otqueue";

/* ------------------------------------------------------------------ */
/*  Landing page — the public root (/) for unauthenticated visitors   */
/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" />
            <span>OTQue</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                <span className="font-serif italic text-primary">Overtime</span>
                <br />
                rotation, managed
                <br />
                fairly.
              </h1>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                OTQue is a free, open-source overtime scheduling tool that keeps your team's rotation fair and transparent.
                Self-host it on your own server — no subscriptions, no data sharing.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-sm bg-primary text-primary-foreground font-medium text-sm border border-primary-border hover:bg-primary/90 transition-colors"
              >
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-sm border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              Free &amp; open-source · Self-hosted
            </p>
          </div>

          {/* Right — mock queue card */}
          <div className="relative">
            {/* Decorative glow */}
            <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full opacity-40 pointer-events-none" />
            <div className="relative bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Up Next — Team Alpha</span>
                </div>
              </div>
              {/* Card rows */}
              <div className="divide-y divide-border">
                {[
                  { rank: 1, initials: "SL", name: "Sara L.", seniority: 5, subclassName: "RN", fairnessScore: 12.5, hours: "18h" },
                  { rank: 2, initials: "MK", name: "Maria K.", seniority: 3, subclassName: "RN", fairnessScore: 14.0, hours: "24h" },
                  { rank: 3, initials: "AW", name: "Ana W.", seniority: 9, subclassName: "Tech", fairnessScore: 8.0, hours: "14h" },
                  { rank: 4, initials: "DP", name: "David P.", seniority: 12, subclassName: "Tech", fairnessScore: 10.0, hours: "16h" },
                  { rank: 5, initials: "JT", name: "James T.", seniority: 7, subclassName: "Tech", fairnessScore: 11.0, hours: "20h" },
                ].map((emp) => (
                  <div
                    key={emp.rank}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-secondary text-secondary-foreground font-bold text-xs">
                        {emp.rank}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{emp.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          Seniority #{emp.seniority}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {emp.subclassName && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                          {emp.subclassName}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-foreground">{emp.hours}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Card footer */}
              <div className="px-5 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>Sorted by priority → fairness → seniority</span>
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Why OTQue?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Built for teams that need a reliable, transparent way to manage overtime without expensive software.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Scale className="h-6 w-6" />,
                title: "Fair Rotation",
                desc: "Priority-based scheduling that considers past hours, seniority, and role to keep overtime distribution equitable.",
              },
              {
                icon: <Server className="h-6 w-6" />,
                title: "Self-Hosted",
                desc: "Run OTQue on your own infrastructure. Your team data never leaves your server. Docker Compose setup in minutes.",
              },
              {
                icon: <Code className="h-6 w-6" />,
                title: "Open Source",
                desc: "Free forever. Licensed under GPL 3.0. Contribute, fork, or adapt it for your team's specific needs.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: "Multi-Roster",
                desc: "Manage multiple teams or departments from a single installation. Each roster has its own rotation rules.",
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: "Event Log",
                desc: "Full audit trail of all overtime events. Search, filter, and track every shift with complete transparency.",
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "Role-Based Access",
                desc: "Admin, user, and viewer roles. Control who can log events, manage employees, and configure settings.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group bg-card border border-border rounded-sm p-6 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-primary/10 text-primary mb-4 group-hover:bg-primary/15 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Get your team's rotation running in three simple steps.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: <Users className="h-6 w-6" />,
              title: "Create a roster",
              desc: "A roster is a group of workers. Define your team, set roles, and configure rotation rules.",
            },
            {
              step: "02",
              icon: <Calendar className="h-6 w-6" />,
              title: "Add employees",
              desc: "Add workers with their names, seniority, and role. Update anytime as your team changes.",
            },
            {
              step: "03",
              icon: <RotateCcw className="h-6 w-6" />,
              title: "Rotate fairly",
              desc: "OTQue automatically ranks who's next based on priority, fairness hours, and seniority.",
            },
          ].map((item) => (
            <div key={item.step} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-primary/10 text-primary">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ready to manage overtime fairly?
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Either sign in to your instance or deploy your own in minutes with Docker Compose.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-sm bg-primary text-primary-foreground font-medium text-sm border border-primary-border hover:bg-primary/90 transition-colors"
            >
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-sm border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              <Github className="h-4 w-4" />
              Deploy Your Own
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>OTQue — free &amp; open-source overtime scheduling · GPL 3.0 · {versionLabel()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              alex12342/otqueue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
