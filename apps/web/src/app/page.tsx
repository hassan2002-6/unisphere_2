import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">UniSphere</h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        The unified portal for Salim Habib University — timetable &amp; exams, forms, complaints,
        internships, mentorship, FYP applications, and GPU/resource allocation.
      </p>
      <Link
        href={userId ? "/dashboard" : "/sign-in"}
        className="rounded-md bg-black px-5 py-2.5 text-white dark:bg-white dark:text-black"
      >
        {userId ? "Open dashboard" : "Sign in"}
      </Link>
      <p className="text-sm text-zinc-500">FYP-II build — in active development.</p>
    </main>
  );
}
