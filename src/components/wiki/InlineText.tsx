import type { ReactNode } from "react";

/**
 * Renders simple inline `**bold**` markers as <strong> elements.
 * Only non-nested bold is supported; everything else passes through
 * as plain text, so no HTML from content is ever injected.
 */
export function renderInlineText(text: string): ReactNode {
  if (!text.includes("**")) {
    return text;
  }

  const parts = text.split(/\*\*([^*]+)\*\*/g);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
