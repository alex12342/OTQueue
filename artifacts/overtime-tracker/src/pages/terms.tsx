import React from "react";
import { LegalPage, LegalSection } from "@/components/legal-page";

const GITHUB_URL = "https://github.com/alex12342/otqueue";
const LICENSE_URL = "https://www.gnu.org/licenses/gpl-3.0.html";

const sections: LegalSection[] = [
  {
    heading: "1. Acceptance of terms",
    body: (
      <p>
        By accessing or using OTQue (the &ldquo;service&rdquo;), you agree to be bound by these Terms of Service
        (&ldquo;terms&rdquo;). If you use the service on behalf of an organization, you are agreeing to these terms
        on that organization&rsquo;s behalf.
      </p>
    ),
  },
  {
    heading: "2. About the service",
    body: (
      <p>
        OTQue is a free, open-source web application for tracking and fairly distributing overtime at
        shift-based jobs. It is provided at no cost and without any subscription.
      </p>
    ),
  },
  {
    heading: "3. License",
    body: (
      <p>
        OTQue is licensed under the GNU General Public License v3.0 (GPL 3.0). You are free to use, study, modify,
        and redistribute the software in accordance with the license terms, available at{" "}
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {LICENSE_URL}
        </a>{" "}
        and in the repository at{" "}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {GITHUB_URL}
        </a>.
      </p>
    ),
  },
  {
    heading: "4. No warranty; provided “as is”",
    body: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;,
          WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, RELIABILITY, AND
          NON-INFRINGEMENT.
        </p>
        <p>
          The authors and contributors do not warrant that the service will be uninterrupted, error-free, or that
          results produced by the service — including rotation order and fairness calculations — are accurate or
          suitable for any particular purpose.
        </p>
        <p>
          The service is scheduling software, not legal, HR, or compliance advice. You are solely responsible for
          complying with all labor, employment, wage-and-hour, and recordkeeping laws and regulations that apply
          to you and your workforce.
        </p>
      </>
    ),
  },
  {
    heading: "5. Limitation of liability",
    body: (
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE AUTHORS, CONTRIBUTORS, OR THE ORGANIZATION
        OPERATING THIS INSTANCE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
        DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATING TO YOUR USE OF, OR
        INABILITY TO USE, THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
    ),
  },
  {
    heading: "6. Indemnification",
    body: (
      <p>
        You agree to defend, indemnify, and hold harmless the authors, contributors, and the organization
        operating this instance from and against any claims, liabilities, damages, losses, and expenses
        (including reasonable attorneys&rsquo; fees) arising from your use of the service or your violation of
        these terms.
      </p>
    ),
  },
  {
    heading: "7. Acceptable use",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Do not use the service for any unlawful purpose</li>
        <li>Do not attempt to disrupt, overload, or impair the service or its infrastructure</li>
        <li>Do not attempt to gain unauthorized access to the service or any system connected to it</li>
        <li>Do not use the service in a way that infringes the rights of others</li>
      </ul>
    ),
  },
  {
    heading: "8. Your responsibilities",
    body: (
      <p>
        If you operate an OTQue instance, you are responsible for securing it, maintaining backups, managing
        user access and roles, and complying with applicable data protection laws (such as GDPR) and
        labor and employment regulations in your jurisdiction.
      </p>
    ),
  },
  {
    heading: "9. Accounts and access",
    body: (
      <p>
        Accounts on this instance are created and managed by your instance administrator, who may assign roles
        (admin, user, or viewer) and may suspend or terminate access at their discretion.
      </p>
    ),
  },
  {
    heading: "10. Termination",
    body: (
      <p>
        You may stop using the service at any time. The organization operating this instance may suspend or
        terminate your access if you violate these terms.
      </p>
    ),
  },
  {
    heading: "11. Changes to these terms",
    body: (
      <p>
        We may update these terms from time to time. The updated version will be posted on this page with a
        revised &ldquo;Last updated&rdquo; date.
      </p>
    ),
  },
  {
    heading: "12. Governing law",
    body: (
      <p>
        These terms are governed by the laws of the jurisdiction in which the organization operating this
        service is located, without regard to its conflict-of-law principles. Disputes arising out of or
        relating to these terms will be resolved in the courts of that jurisdiction.
      </p>
    ),
  },
  {
    heading: "13. Contact",
    body: (
      <>
        <p>
          For account or access questions, contact your OTQue instance administrator.
        </p>
        <p>
          For questions about these terms or the OTQue project, visit{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {GITHUB_URL}
          </a>{" "}
          and open an issue.
        </p>
      </>
    ),
  },
];

export default function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="August 22, 2026"
      intro={
        <p>
          OTQue is a free, open-source tool (GPL 3.0) that you are welcome to use without cost.
          It is provided as-is, with no warranty, and your use of it is governed by the terms below.
        </p>
      }
      sections={sections}
      related={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
