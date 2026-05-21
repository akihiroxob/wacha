import { Fragment } from "hono/jsx";

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string }
  | { type: "paragraph"; text: string };

const renderInline = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={`code-${index}`}
          class="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.9em] text-stone-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
};

const parseMarkdown = (source: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !(lines[index]?.trim().startsWith("```") ?? false)) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "code", code: codeLines.join("\n") });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        const currentMatch = current.match(/^[-*]\s+(.+)$/);
        if (!currentMatch) break;
        items.push(currentMatch[1]);
        index += 1;
      }

      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index]?.trimEnd() ?? "";
      const currentTrimmed = current.trim();

      if (
        currentTrimmed === "" ||
        currentTrimmed.startsWith("```") ||
        /^(#{1,3})\s+/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed)
      ) {
        break;
      }

      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
};

export const Markdown = ({ text }: { text: string }) => {
  const blocks = parseMarkdown(text);

  return (
    <div class="flex flex-col gap-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 1) {
            return (
              <h3 key={index} class="text-base font-semibold text-stone-900">
                {renderInline(block.text)}
              </h3>
            );
          }

          if (block.level === 2) {
            return (
              <h4 key={index} class="text-sm font-semibold text-stone-900">
                {renderInline(block.text)}
              </h4>
            );
          }

          return (
            <h5 key={index} class="text-sm font-medium text-stone-900">
              {renderInline(block.text)}
            </h5>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} class="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              class="overflow-x-auto rounded-xl bg-stone-900 px-3 py-2 text-sm text-stone-100"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        return (
          <p key={index} class="text-sm leading-6 text-stone-700">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
};
