import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation - tempo-x402",
  description: "Complete documentation for tempo-x402 payment protocol",
};

const LLMS_TXT_URL =
  "https://raw.githubusercontent.com/compusophy/tempo-x402/main/llms.txt";

interface Section {
  id: string;
  title: string;
  level: number;
}

async function getDocs(): Promise<{ content: string; sections: Section[] } | null> {
  const res = await fetch(LLMS_TXT_URL, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const content = await res.text();

  // Extract sections for sidebar
  const sections: Section[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      const title = line.slice(3);
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      sections.push({ id, title, level: 2 });
    } else if (line.startsWith("### ")) {
      const title = line.slice(4);
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      sections.push({ id, title, level: 3 });
    }
  }

  return { content, sections };
}

function renderContent(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-sm my-4 font-mono"
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

    if (line.startsWith("# ")) {
      const title = line.slice(2);
      elements.push(
        <h1 key={i} className="text-4xl font-bold mb-6">
          {title}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      const title = line.slice(3);
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      elements.push(
        <h2
          key={i}
          id={id}
          className="text-2xl font-semibold mt-12 mb-4 pt-6 border-t border-zinc-800 scroll-mt-4"
        >
          {title}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      const title = line.slice(4);
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      elements.push(
        <h3 key={i} id={id} className="text-lg font-medium mt-8 mb-3 text-zinc-200 scroll-mt-4">
          {title}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 text-zinc-300 leading-relaxed">
          {formatInline(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-zinc-300 list-decimal leading-relaxed">
          {formatInline(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-zinc-300 leading-relaxed">
          {formatInline(line)}
        </p>
      );
    }
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  // Handle inline code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-emerald-400 font-mono"
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
    let partStr = part;
    while ((match = linkRegex.exec(partStr)) !== null) {
      if (match.index > lastIndex) {
        result.push(partStr.slice(lastIndex, match.index));
      }
      result.push(
        <a
          key={`link-${i}-${match.index}`}
          href={match[2]}
          className="text-blue-400 hover:text-blue-300 underline"
          target={match[2].startsWith("http") ? "_blank" : undefined}
          rel={match[2].startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < partStr.length) {
      result.push(partStr.slice(lastIndex));
    }
    return result.length > 0 ? result : part;
  });
}

export default async function DocsPage() {
  const data = await getDocs();

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-12 max-w-4xl mx-auto">
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

  const { content, sections } = data;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-zinc-800 p-6 sticky top-0 h-screen overflow-y-auto">
        <Link href="/" className="text-zinc-400 hover:text-white text-sm mb-6 block">
          ← Back to Demo
        </Link>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Documentation
        </h2>
        <nav className="space-y-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`block text-sm hover:text-white transition-colors ${
                section.level === 2
                  ? "text-zinc-300 font-medium py-1.5"
                  : "text-zinc-500 pl-3 py-1"
              }`}
            >
              {section.title}
            </a>
          ))}
        </nav>
        <div className="mt-8 pt-6 border-t border-zinc-800">
          <a
            href="https://github.com/compusophy/tempo-x402"
            className="text-zinc-500 hover:text-zinc-300 text-sm block mb-2"
            target="_blank"
          >
            GitHub
          </a>
          <a
            href="https://crates.io/crates/tempo-x402"
            className="text-zinc-500 hover:text-zinc-300 text-sm block"
            target="_blank"
          >
            crates.io
          </a>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-zinc-950 border-b border-zinc-800 p-4 z-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-zinc-400 hover:text-white text-sm">
            ← Demo
          </Link>
          <span className="text-zinc-300 font-medium">Docs</span>
          <a
            href="https://github.com/compusophy/tempo-x402/blob/main/llms.txt"
            className="text-zinc-500 hover:text-zinc-300 text-sm"
            target="_blank"
          >
            Source
          </a>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 py-12 lg:px-12 max-w-3xl lg:pt-12 pt-20">
        <article>{renderContent(content)}</article>
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-zinc-500 text-sm">
          <p>
            Source:{" "}
            <a
              href="https://github.com/compusophy/tempo-x402/blob/main/llms.txt"
              className="underline hover:text-zinc-300"
              target="_blank"
            >
              llms.txt
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
