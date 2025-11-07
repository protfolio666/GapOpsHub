import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export default function UserAvatar({ name, size = "md" }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <Avatar className={sizeClasses[size]} data-testid={`avatar-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <AvatarFallback className="bg-primary text-primary-foreground font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
