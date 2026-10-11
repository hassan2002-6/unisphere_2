import { ForgotPasswordForm } from "@/components/forgot-password-form";

/** Self-service password reset — same red-gradient shell as sign-in. */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-[#c8102e] to-[#9b0c23] p-5">
      <div className="w-full max-w-[400px] rounded-2xl bg-card p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
