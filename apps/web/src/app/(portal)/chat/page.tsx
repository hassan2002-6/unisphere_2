import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrCreateSession, getSessionMessages, listSessions, parseSources } from "@/server/ai/assistant";
import { aiStatus } from "@/server/ai/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { newSessionAction, sendMessageAction } from "./actions";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "When is my next class?",
  "How do I file a complaint about a faculty member?",
  "How do I request a GPU for my FYP?",
  "What happens after I submit an FYP application?",
  "How do mentorship sessions work?",
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
  } catch {
    dbError = true;
  }

  const status = aiStatus();
  const messages = thread?.messages ?? [];

  return (
    <main className="flex h-[calc(100vh-4rem)] gap-4 p-6">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 lg:flex">
        <form action={newSessionAction}>
          <Button type="submit" variant="secondary" className="w-full">
            + New chat
          </Button>
        </form>
        <div className="space-y-1 overflow-y-auto">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/chat?s=${session.id}`}
              className={`block truncate rounded-md px-3 py-2 text-sm ${
                session.id === sessionId ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {session.title ?? "New chat"}
              <span className="ml-1 text-xs text-muted-foreground">({session._count.messages})</span>
            </Link>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Grounded in the university knowledge base and your own UniSphere data.
            </p>
          </div>
          <Badge variant={status.configured ? "secondary" : "outline"}>
            {status.configured ? `${status.provider} · ${status.model}` : "offline (canned replies)"}
          </Badge>
        </div>

        {dbError ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assistant unavailable</CardTitle>
              <CardDescription>The database did not answer — check DATABASE_URL and the Neon project.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!status.configured && !dbError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No AI provider key is configured — replies come from the knowledge base via a canned fallback. Set{" "}
            <code className="rounded bg-amber-100 px-1">GROQ_API_KEY</code> to enable full answers.
          </div>
        ) : null}

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardContent className="flex-1 space-y-4 overflow-y-auto py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Ask me anything about UniSphere — try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((q) => (
                    <form key={q} action={sendMessageAction}>
                      <input type="hidden" name="sessionId" value={sessionId ?? ""} />
                      <input type="hidden" name="question" value={q} />
                      <Button type="submit" variant="outline" size="sm">
                        {q}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const sources = parseSources(m.sources);
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] space-y-2 rounded-lg px-4 py-3 text-sm ${
                        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {!isUser && sources.length > 0 ? (
                        <div className="space-y-1 border-t border-border/50 pt-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
                          {sources.map((src, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              [{i + 1}] {src.title}
                              {src.source ? ` — ${src.source}` : ""}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <form action={sendMessageAction} className="flex items-end gap-2">
          <input type="hidden" name="sessionId" value={sessionId ?? ""} />
          <Textarea
            name="question"
            rows={2}
            required
            minLength={2}
            maxLength={1000}
            placeholder="Ask about timetables, forms, FYP, GPU requests, internships…"
            className="flex-1 resize-none"
          />
          <Button type="submit" className="h-9">
            Send
          </Button>
        </form>
      </section>
    </main>
  );
}
