import UserAvatar from "../UserAvatar";

export default function UserAvatarExample() {
  return (
    <div className="flex items-center gap-4 p-4">
      <UserAvatar name="John Doe" size="sm" />
      <UserAvatar name="Jane Smith" size="md" />
      <UserAvatar name="Robert Johnson" size="lg" />
    </div>
  );
}
