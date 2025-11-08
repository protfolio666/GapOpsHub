import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import logoUrl from "@assets/IMG_3463-removebg-preview_1762617433762.png";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      setIsLoading(true);
      try {
        await onLogin(email, password);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background animate-in fade-in slide-in-from-left duration-700">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Title */}
          <div className="text-center space-y-4 animate-in fade-in slide-in-from-top duration-500">
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt="SolvExtra GO Logo" 
                className="h-24 w-24 object-contain animate-in zoom-in duration-700"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                SolvExtra GO
              </h1>
              <p className="text-lg text-muted-foreground">
                Welcome back!
              </p>
              <p className="text-sm text-muted-foreground">
                Please enter your credentials to log in
              </p>
            </div>
          </div>

          {/* Login Form */}
          <Card className="border-none shadow-xl animate-in fade-in slide-in-from-bottom duration-700" data-testid="card-login">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary"
                    data-testid="input-password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
              
              <Alert className="mt-6 bg-muted/50 border-muted-foreground/20 animate-in fade-in duration-1000">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong className="font-medium">Demo Credentials:</strong>
                  <div className="mt-2 space-y-1 font-mono text-xs">
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

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground animate-in fade-in duration-1000">
            Process Gap Intelligence & Resolution Hub
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-blue-500/5 to-background items-center justify-center p-12 animate-in fade-in slide-in-from-right duration-700">
        <div className="max-w-xl space-y-6 text-center">
          <div className="space-y-4">
            <div className="inline-flex p-4 bg-primary/10 rounded-2xl">
              <img 
                src={logoUrl} 
                alt="SolvExtra GO" 
                className="h-32 w-32 object-contain animate-in zoom-in duration-1000 delay-300"
              />
            </div>
            <h2 className="text-4xl font-bold tracking-tight animate-in slide-in-from-bottom duration-700 delay-200">
              Streamline Your Operations
            </h2>
            <p className="text-lg text-muted-foreground animate-in slide-in-from-bottom duration-700 delay-300">
              Identify, track, and resolve process gaps with AI-powered intelligence. 
              Enhance efficiency and ensure compliance across your organization.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-8 animate-in fade-in duration-1000 delay-500">
            <div className="p-4 bg-card rounded-lg border shadow-sm hover-elevate transition-all duration-300">
              <div className="text-3xl font-bold text-primary">AI-Powered</div>
              <div className="text-sm text-muted-foreground mt-1">Smart Gap Detection</div>
            </div>
            <div className="p-4 bg-card rounded-lg border shadow-sm hover-elevate transition-all duration-300">
              <div className="text-3xl font-bold text-primary">Real-Time</div>
              <div className="text-sm text-muted-foreground mt-1">Live Collaboration</div>
            </div>
            <div className="p-4 bg-card rounded-lg border shadow-sm hover-elevate transition-all duration-300">
              <div className="text-3xl font-bold text-primary">Complete</div>
              <div className="text-sm text-muted-foreground mt-1">Full Audit Trail</div>
            </div>
            <div className="p-4 bg-card rounded-lg border shadow-sm hover-elevate transition-all duration-300">
              <div className="text-3xl font-bold text-primary">RBAC</div>
              <div className="text-sm text-muted-foreground mt-1">Role-Based Access</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
