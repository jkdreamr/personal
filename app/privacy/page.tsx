import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy — Harbor" };

const DO_CLAIM = [
  "Your saved work stays in this browser unless you export it.",
  "Harbor does not sell your content.",
  "External model providers may have their own retention policies.",
  "You decide what Harbor processes.",
];

const DONT_CLAIM = [
  "Zero data retention",
  "Enterprise-grade security",
  "HIPAA, legal, financial, or other compliance",
  "A guarantee that third parties never see your content",
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
        ← Back to Harbor
      </Link>

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">How Harbor handles your work</h1>

      <div className="mt-6 rounded-card border border-warning/30 bg-warning/[0.06] p-4">
        <p className="text-sm text-ink/90">
          Harbor is a private beta using free third-party AI providers. Do not upload confidential client material,
          non-public investment information, personal financial records, health records, or sensitive legal documents.
        </p>
      </div>

      <section className="prose-harbor mt-7 max-w-none">
        <h2 className="text-lg font-semibold">What stays on your device</h2>
        <p>
          Your tasks, drafts, attachments, voice profiles, and preferences are stored locally in your browser
          (IndexedDB). They are not uploaded to a Harbor account — there is no account. Clearing your browser data or
          using the “Clear all local data” button removes them.
        </p>

        <h2 className="text-lg font-semibold">What leaves your device, and when</h2>
        <p>
          When you run a task, Harbor sends the relevant text (your sentence, extracted document text, and any public
          pages it fetched) to a third-party model provider through a server request. Files like PDFs, Word documents,
          and images are read on your device first — only the extracted text is sent, never the original file. When you
          add a public link, Harbor fetches that page from its server (never from a logged-in session) to read its text.
        </p>

        <h2 className="text-lg font-semibold">What Harbor does</h2>
        <ul>
          {DO_CLAIM.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h2 className="text-lg font-semibold">What Harbor does not claim</h2>
        <p>To be honest with you, Harbor makes none of these promises:</p>
        <ul>
          {DONT_CLAIM.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h2 className="text-lg font-semibold">Untrusted content</h2>
        <p>
          Harbor treats every uploaded document, pasted text, email, and fetched web page as data to summarize, compare,
          or cite — never as instructions. Text inside those sources cannot change how Harbor behaves.
        </p>

        <h2 className="text-lg font-semibold">Sources and limits</h2>
        <p>
          Harbor reviews the sources you supply and public pages it can access. It is not a complete record of the
          internet, it respects robots rules and paywalls, and it will tell you what it could and couldn&apos;t cover.
        </p>
      </section>
    </div>
  );
}
