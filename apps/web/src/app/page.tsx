import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <span className="font-semibold tracking-tight">UniSphere</span>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton />
            <SignUpButton />
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight">UniSphere</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          The unified portal for Salim Habib University — timetable &amp; exams, forms, complaints,
          internships, mentorship, FYP applications, and GPU/resource allocation.
        </p>
        <Link
          href={userId ? "/dashboard" : "/sign-in"}
          className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:bg-primary/90"
        >
          {userId ? "Open dashboard" : "Sign in"}
        </Link>
        <p className="text-sm text-muted-foreground">FYP-II build — in active development.</p>
      </main>
    </div>
  );
}
