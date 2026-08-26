import React from "react";
import { Link } from "wouter";
import { ClipboardList, Github, ArrowLeft } from "lucide-react";

const GITHUB_URL = "https://github.com/alex12342/otqueue";

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  related: { href: string; label: string };
}

/**
 * Standalone full-page layout for legal documents (Privacy Policy, Terms).
 * Renders its own header/footer so it looks complete both when the user
 * is signed out (no sidebar) and when they navigate from inside the app.
 */
export function LegalPage({ title, lastUpdated, intro, sections, related }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" />
            <span>OTQue</span>
          </Link>
          <nav className="flex items-center gap-6">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-10 md:py-14 space-y-10">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            <div className="text-[15px] leading-relaxed text-muted-foreground">{intro}</div>
          </div>

          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{section.heading}</h2>
              <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">{section.body}</div>
            </section>
          ))}

          <div className="border-t border-border pt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={related.href} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              {related.label}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </article>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>OTQue — free &amp; open-source overtime scheduling · GPL 3.0</span>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to OTQue
          </Link>
        </div>
      </footer>
    </div>
  );
}
