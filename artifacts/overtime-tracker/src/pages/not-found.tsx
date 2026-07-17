import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home, LogIn } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex flex-col items-center">
            <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">OTQue</h1>
            <CardTitle className="text-2xl font-bold text-foreground">Page Not Found</CardTitle>
            <CardDescription>
              The page you are looking for doesn't exist or has been moved.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/">
            <button className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2">
              <Home className="h-4 w-4" />
              Go to Home
            </button>
          </Link>
          <Link href="/login">
            <button className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
