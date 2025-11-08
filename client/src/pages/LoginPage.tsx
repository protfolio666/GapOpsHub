import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import logoUrl from "@assets/IMG_3463-removebg-preview_1762618462943.png";
import puzzleIllustration from "@assets/stock_images/colorful_puzzle_piec_f5f048ad.jpg";

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLDAPLogin = async () => {
    setIsLoading(true);
    try {
      // For demo purposes, use default admin credentials
      await onLogin("admin@gapops.com", "Password123!");
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
            <div className="flex items-center gap-3">
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
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome back!
              </h2>
              <p className="text-gray-600 text-base">
                Please enter your credentials to log in
              </p>
            </div>
          </div>

          {/* LDAP Login Button */}
          <div>
            <Button 
              onClick={handleLDAPLogin}
              variant="secondary"
              className="w-full h-12 text-base font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors" 
              disabled={isLoading}
              data-testid="button-ldap-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Continue with Flipkart LDAP Login"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Illustration (60%) */}
      <div className="hidden lg:flex lg:w-[60%] bg-gradient-to-br from-gray-50 to-white items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 via-orange-50/20 to-yellow-50/30"></div>
        <div className="relative z-10 w-full h-full flex items-center justify-center">
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
