import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import logoUrl from "@assets/IMG_3463-removebg-preview_1762617433762.png";
import puzzleIllustration from "@assets/stock_images/colorful_puzzle_piec_f5f048ad.jpg";

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
    <div className="min-h-screen flex bg-white dark:bg-background">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-12 lg:px-20 bg-white dark:bg-background">
        {/* Logo and Title */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              SolvExtra GO
            </h1>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Welcome back!
            </h2>
            <p className="text-muted-foreground">
              Please enter your credentials to log in
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 border-border bg-background"
              data-testid="input-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
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
              className="h-12 border-border bg-background"
              data-testid="input-password"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium" 
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

        {/* Demo Credentials Info */}
        <div className="mt-8 max-w-md">
          <Alert className="bg-muted/50 border-muted-foreground/20">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong className="font-medium">Demo Credentials:</strong>
              <div className="mt-2 space-y-1 font-mono text-xs">
                <div>admin@gapops.com</div>
                <div>manager@gapops.com</div>
                <div>qa@gapops.com</div>
                <div>poc@gapops.com</div>
                <div className="mt-1 text-muted-foreground">Password: Password123!</div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-white dark:bg-card items-center justify-center p-16 relative">
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src={puzzleIllustration} 
            alt="Team Collaboration - Puzzle Pieces" 
            className="w-full h-auto max-w-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}
