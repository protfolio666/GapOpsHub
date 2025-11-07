import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin(email, password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center mb-2">
            <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">GO</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold text-center">Welcome to GapOps</CardTitle>
          <CardDescription className="text-center">
            Process Gap Intelligence & Resolution Hub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" data-testid="button-login">
              Sign In
            </Button>
          </form>
          
          <Alert className="bg-muted/50 border-muted-foreground/20">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong className="font-medium">Demo Credentials:</strong>
              <div className="mt-2 space-y-1">
                <div>admin@gapops.com</div>
                <div>manager@gapops.com</div>
                <div>qa@gapops.com</div>
                <div>poc@gapops.com</div>
                <div className="mt-1 text-muted-foreground">Password: <span className="font-mono">Password123!</span></div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
