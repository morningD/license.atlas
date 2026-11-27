// SPDX-License-Identifier: MulanPSL-2.0

import React from "react";

function stripMdEscapes(text: string): string {
  return text.replace(/\\([.!)(*_#[\]`~>|])/g, "$1");
}

function renderInline(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let key = baseKey * 1000;
  const regex = /(https?:\/\/[^\s)<>"']+)|(\*\*(.+?)\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1]) {
      parts.push(
        <a
          key={key++}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7c3aed] hover:underline"
        >
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      parts.push(<strong key={key++}>{match[3]}</strong>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function LicenseBody({ text }: { text: string }) {
  const cleaned = stripMdEscapes(text);

  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rest = headingMatch[2];
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      elements.push(
        React.createElement(
          Tag,
          {
            key: `h${i}`,
            className:
              "font-bold text-zinc-950 dark:text-zinc-50 mt-4 first:mt-0",
          },
          renderInline(rest, i)
        )
      );
    } else {
      elements.push(
        React.createElement("span", { key: `l${i}` }, renderInline(line, i))
      );
    }
    if (i < lines.length - 1) {
      elements.push("\n");
    }
  }

  return (
    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      {elements}
    </div>
  );
}
