import Link from "next/link";
import { BookOpen, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrCreateSession, getSessionMessages, listSessions, parseSources } from "@/server/ai/assistant";
import { aiStatus } from "@/server/ai/provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { newSessionAction, sendMessageAction } from "./actions";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "When is my next class?",
  "How do I file a complaint about a faculty member?",
  "How do I request a GPU for my FYP?",
  "What happens after I submit an FYP application?",
];

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { s, error } = await searchParams;

  let sessionId = s;
  let sessions: Awaited<ReturnType<typeof listSessions>> = [];
  let thread: Awaited<ReturnType<typeof getSessionMessages>> = null;
  let dbError = false;

  try {
    const session = await getOrCreateSession(user, sessionId);
    sessionId = session.id;
    [sessions, thread] = await Promise.all([listSessions(user), getSessionMessages(user, sessionId)]);
  } catch (error) {
    console.error("chat load failed:", error);
    dbError = true;
  }

  const status = aiStatus();
  const messages = thread?.messages ?? [];
  const active = sessions.find((x) => x.id === sessionId);

  const sessionList = (
    <div className="space-y-1 overflow-y-auto lg:max-h-[60vh]">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/chat?s=${session.id}`}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            session.id === sessionId
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="truncate">{session.title ?? "New chat"}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{session._count.messages}</span>
        </Link>
      ))}
      {sessions.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</p> : null}
    </div>
  );

  return (
    <div className="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Sessions sidebar (desktop) */}
      <aside className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-3">
        <form action={newSessionAction}>
          <SubmitButton variant="secondary" className="w-full justify-start" pendingLabel="Starting…">
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </SubmitButton>
        </form>
        {sessionList}
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Campus Assistant</h1>
              <p className="text-sm text-primary-foreground/85">
                Grounded in the university knowledge base and your own UniSphere data — every answer cites its sources.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-transparent bg-white/15 font-normal text-primary-foreground">
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", status.configured ? "bg-[#7ee2a8]" : "bg-white/60")}
            />
            {status.configured ? `${status.provider} · ${status.model}` : "offline fallback"}
          </Badge>
        </div>

        {/* Mobile session picker */}
        <details className="rounded-lg border bg-card px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            Conversations <span className="text-muted-foreground">({sessions.length})</span>
          </summary>
          <div className="mt-3 space-y-3">
            <form action={newSessionAction}>
              <SubmitButton variant="secondary" size="sm" className="w-full" pendingLabel="Starting…">
                <MessageSquarePlus className="h-4 w-4" />
                New chat
              </SubmitButton>
            </form>
            {sessionList}
          </div>
        </details>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {dbError ? (
          <Alert variant="destructive">
            <AlertTitle>Assistant unavailable</AlertTitle>
            <AlertDescription>The database did not answer — check the Neon project and DATABASE_URL.</AlertDescription>
          </Alert>
        ) : null}

        {!status.configured && !dbError ? (
          <Alert variant="muted">
            <AlertTitle>No AI provider key configured</AlertTitle>
            <AlertDescription>
              Replies fall back to knowledge-base excerpts. Set <code className="rounded bg-muted px-1">COMMANDCODE_API_KEY</code>{" "}
              (or <code className="rounded bg-muted px-1">AI_FALLBACK_MODE=1</code> to stay offline) to control this.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="min-h-[24rem] gap-0 py-0">
          <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-7 w-7" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">Ask me anything about UniSphere</h2>
                  <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    Timetables, forms, FYP, GPU requests and internships — I read the same system you do and
                    cite my sources.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((q) => (
                    <form key={q} action={sendMessageAction}>
                      <input type="hidden" name="sessionId" value={sessionId ?? ""} />
                      <input type="hidden" name="question" value={q} />
                      <SubmitButton variant="outline" size="sm" className="rounded-full font-normal" pendingLabel="Asking…">
                        {q}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const sources = parseSources(m.sources);
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
                    {!isUser ? (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    <div className="max-w-[85%] space-y-2">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm leading-6",
                          isUser
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border bg-muted/50",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      {!isUser && sources.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-card px-3.5 py-2.5">
                          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            Sources
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {sources.map((src, i) => (
                              <li key={i} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">[{i + 1}]</span> {src.title}
                                {src.source ? ` — ${src.source}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Composer — sticky so long threads stay answerable */}
        <form action={sendMessageAction} className="sticky bottom-4 z-10">
          <div className="flex items-end gap-2 rounded-2xl border bg-card/95 p-2 shadow-lg backdrop-blur">
            <input type="hidden" name="sessionId" value={sessionId ?? ""} />
            <Textarea
              name="question"
              rows={2}
              required
              minLength={2}
              maxLength={1000}
              placeholder={`Message the assistant${active?.title ? ` · ${active.title}` : ""}…`}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <SubmitButton className="mb-0.5 h-9 rounded-xl" pendingLabel="Thinking…">
              <Send className="h-4 w-4" />
              Send
            </SubmitButton>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Answers are generated from seeded university documents and your records — verify critical decisions with the
            relevant office.
          </p>
        </form>
      </section>
    </div>
  );
}
