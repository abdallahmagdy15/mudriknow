import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { Plugin } from "unified";
import type { Root, Node } from "hast";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Stray raw HTML in the model's markdown (e.g. an un-backticked <div>) would
// otherwise be silently dropped by react-markdown, making the tags and their
// text vanish. Convert raw hast nodes to escaped text so they show up as
// literal `<tag>` content instead — safe (never rendered as live HTML) and
// lossless. Code spans/blocks are unaffected (they're `code` nodes, not raw).
const rehypeEscapeRawHtml: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const walk = (node: Node): void => {
      const parent = node as Node & { children?: Node[] };
      if (Array.isArray(parent.children)) {
        parent.children = parent.children.map((child) => {
          if (child.type === "raw") {
            return { type: "text", value: (child as { value?: string }).value ?? "" } as Node;
          }
          walk(child);
          return child;
        });
      }
    };
    walk(tree);
  };
};

const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (typeof href === "string" && /^https?:\/\//i.test(href)) {
            e.preventDefault();
            window.hoverbuddy?.openExternal?.(href);
          }
        }}
      >
        {children}
      </a>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeEscapeRawHtml, rehypeHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
