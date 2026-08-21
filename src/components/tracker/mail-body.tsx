"use client";

// Renders a plain-text mailing-list message, preserving Pipermail archive
// fidelity while adding reader affordances:
//   - "> " quoting → nested blockquote-style indented blocks with the
//     "On ... wrote:" attribution line kept as the block's muted header
//   - URLs (single-line) → links; "user at host" obfuscated addresses →
//     mailto links (Pipermail rewrites @ this way)
//   - "<url\ncontinuation>" angle-bracketed wrapped URLs → re-joined and
//     linked (the angle brackets make this unambiguous vs bare wraps,
//     which stay verbatim)
//   - "-- \n" signature separator → muted remainder
import { Fragment, type ReactNode } from "react";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
const MAIL_AT_RE = /\b([A-Za-z0-9._%+-]+) at ([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

function linkifyText(text: string): ReactNode[] {
  // Interleave URL and obfuscated-email matches in order of appearance.
  type Match = { type: "url" | "mail"; start: number; end: number; href: string; label: string };
  const matches: Match[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    matches.push({ type: "url", start: m.index, end: m.index + url.length, href: url.startsWith("www.") ? `https://${url}` : url, label: url });
  }
  for (const m of text.matchAll(MAIL_AT_RE)) {
    matches.push({ type: "mail", start: m.index, end: m.index + m[0].length, href: `mailto:${m[1]}@${m[2]}`, label: m[0] });
  }
  matches.sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start < pos) continue; // overlapping (email inside url etc.) — keep first
    if (m.start > pos) nodes.push(text.slice(pos, m.start));
    nodes.push(
      <a key={m.start} href={m.href} target="_blank" rel="noopener noreferrer" className="break-all text-[#7c3aed] hover:underline dark:text-[#a78bfa]">
        {m.label}
      </a>,
    );
    pos = m.end;
  }
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

// Pipermail wraps long URLs as "<https://example.com/a-very-long-\npath>"
// (angle brackets around the wrapped token). Re-join those — safe because
// the delimiters mark exactly the wrapped span. Bare (unbracketed) wraps
// stay verbatim: joining them risks fabricating wrong URLs.
function rejoinAngledUrls(text: string): string {
  return text.replace(/<([a-z][a-z0-9+.-]*:\/\/[^\s>]*|[^\s>]*@[\w.-]+\.\w+)[ \t]*\n[ \t]*([^\s>]*)>/gi, (_all, first: string, second: string) => {
    const joined = `${first}${second}`;
    // Skip obvious non-URLs (e.g. "<mailto:x at y>" pairs already handled).
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(joined) || /@/.test(joined) ? joined : `<${first}\n${second}>`;
  });
}

type Block =
  | { kind: "quote"; depth: number; header: string | null; lines: string[] }
  | { kind: "text"; lines: string[] }
  | { kind: "signature"; lines: string[] };

// Split body into top-level blocks: quoted runs (all depths nested inside),
// regular text, and signature (after the "-- " separator at quote depth 0).
function parseBlocks(body: string): Block[] {
  const rawLines = rejoinAngledUrls(body).split("\n");
  const blocks: Block[] = [];
  let cur: Block = { kind: "text", lines: [] };
  let inSignature = false;
  const flush = () => {
    const isText = cur.kind === "text";
    if ((isText && cur.lines.length) || cur.kind !== "text") blocks.push(cur);
    cur = { kind: "text", lines: [] };
  };
  for (const line of rawLines) {
    if (!inSignature && line.trimEnd() === "--") {
      flush();
      inSignature = true;
      cur = { kind: "signature", lines: [] };
      continue;
    }
    if (inSignature) {
      (cur as { lines: string[] }).lines.push(line);
      continue;
    }
    const quoteMatch = line.match(/^((?:>\s?)*)>\s?(.*)$/);
    if (quoteMatch) {
      const level = (line.match(/>/g) || []).length;
      if (cur.kind === "quote" && cur.depth === level) {
        // The "On ... wrote:" line directly above a quote is its header.
        if (!cur.header) {
          const lastText = blocks.at(-1);
          if (lastText?.kind === "text" && lastText.lines.length) {
            const lastLine = lastText.lines[lastText.lines.length - 1] || "";
            if (/^on .*(wrote|said|schrieb)/i.test(lastLine.trim()) && lastLine.trim().length < 200) {
              lastText.lines.pop();
              cur.header = lastLine;
            }
          }
        }
        cur.lines.push(quoteMatch[2]);
      } else {
        flush();
        cur = { kind: "quote", depth: level, header: null, lines: [quoteMatch[2]] };
      }
    } else {
      if (cur.kind !== "text") flush();
      cur.lines.push(line);
    }
  }
  flush();
  return blocks;
}

function QuoteBlock({ depth, header, lines }: { depth: number; header: string | null; lines: string[] }) {
  // Recurse: deeper quotes inside this run are nested blocks.
  const nested = parseQuoteLines(lines, depth);
  return (
    <blockquote
      className={`my-2 border-l-2 pl-3 text-zinc-500 dark:text-zinc-400 ${depth === 1 ? "border-zinc-300 dark:border-zinc-700" : depth === 2 ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-100 dark:border-zinc-800/60"}`}
    >
      {header && <p className="mb-1 text-xs italic opacity-70">{linkifyText(header)}</p>}
      {nested}
    </blockquote>
  );
}

// Parse the stripped content of a quote at `depth` for deeper quotes.
function parseQuoteLines(lines: string[], depth: number): ReactNode {
  const out: ReactNode[] = [];
  let text: string[] = [];
  let sub: { lines: string[] } | null = null;
  const flushText = () => {
    if (text.length) {
      out.push(<p key={out.length} className="whitespace-pre-wrap break-words">{linkifyText(text.join("\n"))}</p>);
      text = [];
    }
  };
  for (const line of lines) {
    // A deeper quote starts when the original had `depth+1` markers; the
    // parent stripped `depth` of them, so anything beginning with ">" is
    // one level deeper.
    if (line.startsWith(">")) {
      if (!sub) { flushText(); sub = { lines: [] }; }
      sub.lines.push(line.replace(/^>\s?/, ""));
    } else {
      if (sub) {
        out.push(<QuoteBlock key={out.length} depth={depth + 1} header={null} lines={sub.lines} />);
        sub = null;
      }
      text.push(line);
    }
  }
  if (sub) out.push(<QuoteBlock key={out.length} depth={depth + 1} header={null} lines={sub.lines} />);
  flushText();
  return <>{out}</>;
}

export function MailBody({ body }: { body: string }) {
  const blocks = parseBlocks(body);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          b.lines.join("").trim() ? (
            <p key={i} className="whitespace-pre-wrap break-words">{linkifyText(b.lines.join("\n"))}</p>
          ) : null
        ) : b.kind === "signature" ? (
          <p key={i} className="whitespace-pre-wrap break-words border-t border-zinc-100 pt-2 text-xs text-zinc-400 dark:border-zinc-800/60 dark:text-zinc-500">{linkifyText(b.lines.join("\n"))}</p>
        ) : (
          <QuoteBlock key={i} depth={b.depth} header={b.header} lines={b.lines} />
        ),
      )}
    </div>
  );
}

// Framer-free helper export for consumers wanting plain fragments.
export function MailBodyFragment(props: { body: string }) {
  return <Fragment><MailBody {...props} /></Fragment>;
}
