import React from "react";
import { LegalPage, LegalSection } from "@/components/legal-page";

const GITHUB_URL = "https://github.com/alex12342/otqueue";

const sections: LegalSection[] = [
  {
    heading: "1. Who we are",
    body: (
      <>
        <p>
          This privacy policy describes how the organization operating this OTQue instance
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) handles personal information when you use the service.
          OTQue is a free, open-source overtime scheduling tool (see{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{GITHUB_URL}</a>),
          and this instance is self-hosted on our own infrastructure.
        </p>
        <p>
          This policy applies only to this instance. Other OTQue deployments are operated by other organizations
          and are governed by their own policies.
        </p>
      </>
    ),
  },
  {
    heading: "2. Information we collect",
    body: (
      <>
        <p>We collect only the minimum information needed to operate the service:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Name</strong> — used to identify you in rosters, events, and reports.</li>
          <li><strong className="text-foreground">Email address</strong> — used as your login identifier and for account management.</li>
          <li><strong className="text-foreground">Account role</strong> (admin, user, or viewer) — assigned by your administrator to control access.</li>
        </ul>
        <p>
          If you sign in with Google, Google shares the following with us through its sign-in service:
          your name, your email address, whether that email is verified, a unique Google account identifier,
          and (if applicable) your Google Workspace domain. We do not request or receive your profile photo,
          contacts, calendar, or any other Google data.
        </p>
        <p>
          We do not collect any other personal information. There is no analytics, no advertising,
          no device fingerprinting, and no collection of financial, health, or location data.
        </p>
      </>
    ),
  },
  {
    heading: "3. Information you enter",
    body: (
      <p>
        You or your administrator may enter scheduling data, such as rosters, worker names, event dates, and hours.
        This information is provided by you, used solely to power the scheduling features, and remains under your organization&rsquo;s control.
      </p>
    ),
  },
  {
    heading: "4. How we use information",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>To authenticate you and keep your session active</li>
        <li>To create and manage your account</li>
        <li>To provide the scheduling features (rosters, events, reports, and fairness calculations)</li>
        <li>To operate the service securely and reliably</li>
      </ul>
    ),
  },
  {
    heading: "5. How we share information",
    body: (
      <>
        <p>We do not sell, rent, or share personal information with third parties for any purpose.</p>
        <p>
          The only exception is the sign-in flow when Google sign-in is enabled: that flow runs through Google&rsquo;s
          OAuth service, which sees your email address for the purpose of authenticating you. Google&rsquo;s own privacy policy
          applies to that interaction.
        </p>
      </>
    ),
  },
  {
    heading: "6. Cookies and local storage",
    body: (
      <>
        <p>We do not use tracking cookies, analytics, or advertising pixels.</p>
        <p>
          Your browser stores the following in local storage, nothing more:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A session token that keeps you signed in</li>
          <li>A small cache of your account details (email, name, role)</li>
        </ul>
        <p>Clearing your browser data will sign you out of the service.</p>
      </>
    ),
  },
  {
    heading: "7. Data retention",
    body: (
      <p>
        Personal information is stored on our servers for as long as your account is active.
        When your account is deleted, your associated personal information is deleted as well,
        unless we are required to retain certain records by law (for example, work-hour records that may be
        subject to local labor or employment regulations).
      </p>
    ),
  },
  {
    heading: "8. Security",
    body: (
      <p>
        We take reasonable security measures, including hashed password storage, token-based sessions, and hosting
        on private infrastructure that we control. However, no method of transmission or storage over the internet
        is 100% secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    heading: "9. Your rights",
    body: (
      <>
        <p>
          Depending on your jurisdiction (for example, under GDPR or CCPA), you may have the right to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your personal information</li>
          <li>Export a copy of your information</li>
          <li>Withdraw consent for processing where consent is the basis</li>
        </ul>
        <p>
          We process your personal information based on your consent, the performance of the service we provide,
          and our legitimate interest in operating a secure service. To exercise any of these rights,
          contact your OTQue instance administrator (see Section 12). We will respond within a reasonable timeframe.
        </p>
      </>
    ),
  },
  {
    heading: "10. Children",
    body: (
      <p>
        The service is workplace scheduling software and is not intended for anyone under the age of 16.
        We do not knowingly collect personal information from children.
      </p>
    ),
  },
  {
    heading: "11. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. The updated version will be posted on this page
        with a revised &ldquo;Last updated&rdquo; date.
      </p>
    ),
  },
  {
    heading: "12. Contact",
    body: (
      <>
        <p>
          For privacy questions or data subject requests, contact your OTQue instance administrator.
        </p>
        <p>
          For questions about the OTQue project itself, visit{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {GITHUB_URL}
          </a>{" "}
          and open an issue.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="August 22, 2026"
      intro={
        <p>
          The short version: we collect only your name and email address to create and maintain your account.
          We do not sell or share your data with anyone, we run no tracking or analytics,
          and everything is stored on our own servers.
        </p>
      }
      sections={sections}
      related={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
