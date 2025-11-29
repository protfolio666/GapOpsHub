import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import logoUrl from "@assets/IMG_3463-removebg-preview_1762618462943.png";
import puzzleIllustration from "@assets/generated_images/Modern_HR_teamwork_puzzle_illustration_79d97e82.png";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleContinue = () => {
    setShowForm(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Login Form (40%) */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center px-12 lg:px-20 bg-white">
        <div className="max-w-md mx-auto w-full space-y-12">
          {/* Logo and Title */}
          <div className="space-y-6">
            <div className="login-logo flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center bg-white">
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-10 w-10 object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Employee Experience
              </h1>
            </div>
            
            <div className="space-y-2">
              <h2 className="login-title text-3xl font-bold text-gray-900">
                Welcome back!
              </h2>
              <p className="login-description text-gray-600 text-base">
                Please enter your credentials to log in
              </p>
            </div>
          </div>

          {/* Login Form */}
          {!showForm ? (
            <div className="login-continue-btn">
              <Button 
                onClick={handleContinue}
                variant="secondary"
                className="w-full h-12 text-base font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all hover:shadow-md" 
                data-testid="button-continue"
              >
                Continue
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="login-form-container space-y-6">
              <div className="login-form-field space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input h-12 text-base rounded-lg border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="login-form-field space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input h-12 text-base rounded-lg border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                  disabled={isLoading}
                />
              </div>

              <Button 
                type="submit"
                className="login-button login-form-field w-full h-12 text-base font-medium bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg" 
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Right Side - Illustration (60%) */}
      <div className="hidden lg:flex lg:w-[60%] login-gradient-bg bg-gradient-to-br from-gray-50 to-white items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 via-orange-50/20 to-yellow-50/30"></div>
        <div className="login-illustration relative z-10 w-full h-full flex items-center justify-center">
          <img 
            src={puzzleIllustration} 
            alt="Team Collaboration - Assembling Puzzle" 
            className="w-full h-auto max-w-3xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}
