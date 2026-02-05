import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - tempo-x402",
  description: "Complete documentation for tempo-x402 payment protocol",
};

const LLMS_TXT_URL =
  "https://raw.githubusercontent.com/compusophy/tempo-x402/main/llms.txt";

async function getDocs() {
  const res = await fetch(LLMS_TXT_URL, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.text();
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block start/end
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-sm my-4"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3);
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-3xl font-bold mt-8 mb-4">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-2xl font-semibold mt-8 mb-3 pt-4 border-t border-zinc-800"
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-xl font-medium mt-6 mb-2">
          {line.slice(4)}
        </h3>
      );
    }
    // List items
    else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 text-zinc-300">
          {formatInlineCode(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-zinc-300 list-decimal">
          {formatInlineCode(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={i} className="text-zinc-300 leading-relaxed">
          {formatInlineCode(line)}
        </p>
      );
    }
  }

  return elements;
}

function formatInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Handle links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        result.push(part.slice(lastIndex, match.index));
      }
      result.push(
        <a
          key={`link-${i}-${match.index}`}
          href={match[2]}
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < part.length) {
      result.push(part.slice(lastIndex));
    }
    return result.length > 0 ? result : part;
  });
}

export default async function DocsPage() {
  const content = await getDocs();

  if (!content) {
    return (
      <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Documentation</h1>
        <p className="text-zinc-400">Failed to load documentation.</p>
        <a
          href="https://github.com/compusophy/tempo-x402/blob/main/llms.txt"
          className="text-blue-400 underline"
        >
          View on GitHub
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <a href="/" className="text-zinc-500 hover:text-zinc-300">
          ← Demo
        </a>
        <a
          href="https://github.com/compusophy/tempo-x402/blob/main/llms.txt"
          className="text-zinc-500 hover:text-zinc-300 text-sm"
          target="_blank"
        >
          View source
        </a>
      </div>
      <article className="prose prose-invert max-w-none">
        {parseMarkdown(content)}
      </article>
    </main>
  );
}
