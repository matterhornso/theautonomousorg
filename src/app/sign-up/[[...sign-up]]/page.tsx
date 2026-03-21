import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <SignUp />
    </div>
  );
}
