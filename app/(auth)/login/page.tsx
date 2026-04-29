import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { LoginHero } from "@/components/auth/login-hero";
import { ValueOrbitStrip } from "@/components/auth/value-orbit-strip";

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginHero />
      <div className="w-full">
        <LoginForm />
        <ValueOrbitStrip />
      </div>
    </AuthLayout>
  );
}
