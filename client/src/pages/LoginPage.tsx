import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LoginPageProps {
  onLogin: (email: string, role: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && role) {
      onLogin(email, role);
      console.log("Login:", { email, role });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">GO</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold text-center">Welcome to GapOps</CardTitle>
          <CardDescription className="text-center">
            Process Gap Intelligence & Resolution Hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="role">Role (Demo)</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger id="role" data-testid="select-role">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                  <SelectItem value="QA/Ops">QA/Ops</SelectItem>
                  <SelectItem value="POC">POC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" data-testid="button-login">
              Sign In
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Demo credentials: Any email + select role</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
