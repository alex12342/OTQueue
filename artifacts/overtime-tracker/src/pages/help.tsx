import React from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Calendar, Clock, RotateCcw, Settings, Scale } from "lucide-react";

const steps = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Create a Roster",
    text: "A roster is a group of workers. Go to Settings > Rosters and click 'Create Roster'.",
    link: "/settings",
    linkText: "Go to Rosters",
  },
  {
    icon: <BookOpen className="h-6 w-6" />,
    title: "Add Workers",
    text: "Click 'Add Employee' in the Employees page. Give each worker a name and seniority number.",
    link: "/employees",
    linkText: "Go to Employees",
  },
  {
    icon: <Calendar className="h-6 w-6" />,
    title: "Create Events",
    text: "An event is a work day. Click 'Log Event' to add a date, hours, and which workers are on duty.",
    link: "/events/new",
    linkText: "Log New Event",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "See Who Is Next",
    text: "The home page shows who should work next. It uses past hours to keep things fair.",
    link: "/",
    linkText: "Go to Home",
  },
];

const faqs = [
  {
    q: "What is a normalized hour total?",
    a: "It is a number that shows how much a worker has worked. The system uses this number to pick who works next. The goal is to keep things fair.",
  },
  {
    q: "How do I reset these totals?",
    a: "Go to Settings > Reset Hours. Click 'Reset All Totals to 0'. This creates a marker event in the event log. You can undo the reset by deleting that marker event.",
  },
  {
    q: "What is seniority?",
    a: (
      <>
        <p>Seniority shows how long a worker has been with the group compared to everyone else. It is used as a tie-breaker when two workers are otherwise equal.</p>
        <p className="mt-2">Your seniority is like your place in line:</p>
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li>Number 1 means you have the highest seniority (you have been here the longest).</li>
          <li>Higher numbers (like 2, 5, or 10) mean you are further back in line and have less seniority.</li>
        </ul>
        <p className="mt-2">Each roster can calculate seniority two ways (Settings &rarr; Criteria):</p>
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li><strong>Hire date</strong> (new rosters): the rank is computed automatically from hire date. The oldest hire is number 1. Workers hired the same day can be tie-broken with a priority value.</li>
          <li><strong>Manual number</strong> (legacy): you type each worker&rsquo;s seniority number by hand.</li>
        </ul>
        <p className="mt-2">You can always set both a hire date and a manual seniority number on a worker — the roster&rsquo;s mode just decides which one is used for ranking. Only the active mode&rsquo;s field is required.</p>
      </>
    ),
  },
  {
    q: "How do I add the same worker to two rosters?",
    a: "Open the Directory page — every worker is listed once with all the rosters they're in. Click 'Add to roster' and pick a roster they're not already in (rosters they're already in are marked and can't be re-added). Their name and hire details carry over so you don't retype them, but their hours, subclass, and role stay independent for each roster.",
  },
  {
    q: "What are roles?",
    a: "Roles are job titles. They help you see what kind of work each person does. Roles do not change who works next.",
  },
  {
    q: "What is the starting fairness value?",
    a: "When a new worker is added, their fairness value starts at 0. After the first hours reset, it is set to the average hours of their peer group (same subclass, or all active workers if no subclasses are used). This ensures fair rotation within their group. Changing a worker's subclass resets their baseline and recomputes it from the new group.",
  },
  {
    q: "What are subclasses?",
    a: "Subclasses let you sort workers into groups. For example, you can put all nurses in one group and all techs in another.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="text-muted-foreground mt-1">
          Learn how to use OTQue to manage your work schedule.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{step.text}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={step.link}>{step.linkText}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Common Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b pb-4 last:border-b-0 last:pb-0">
                <h3 className="font-semibold text-base">{faq.q}</h3>
                <p className="text-muted-foreground mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            If you have questions not answered here, please contact your system admin.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            Review the policies that apply when you use OTQue:
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <Link href="/privacy" className="text-sm text-primary hover:underline font-medium">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-primary hover:underline font-medium">
              Terms of Service
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
