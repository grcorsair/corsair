import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDir = path.join(process.cwd(), "content");

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  author: string;
  published: boolean;
}

export interface DocMeta {
  slug: string[];
  title: string;
  description: string;
  order: number;
  section: string;
  typedoc?: string[];
}

type TypedocIndexEntry = {
  root: string;
  baseUrl: string;
};

let typedocIndexCache: TypedocIndexEntry[] | null = null;

function findRepoRoot(): string {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, "docs", "typedoc"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function buildTypedocIndex(): TypedocIndexEntry[] {
  if (typedocIndexCache) return typedocIndexCache;
  const repoRoot = findRepoRoot();
  const typedocDir = path.join(repoRoot, "docs", "typedoc");
  if (!fs.existsSync(typedocDir)) {
    typedocIndexCache = [];
    return typedocIndexCache;
  }

  const docsRoot = path.join(repoRoot, "apps", "web", "content", "docs");
  const configs = fs.readdirSync(typedocDir).filter((f) => f.endsWith(".json"));
  const index: TypedocIndexEntry[] = [];

  for (const configName of configs) {
    const raw = fs.readFileSync(path.join(typedocDir, configName), "utf8");
    let data: { entryPoints?: string[]; out?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!data.entryPoints || !data.out) continue;

    const outPath = path.isAbsolute(data.out) ? data.out : path.join(repoRoot, data.out);
    const relativeOut = path.relative(docsRoot, outPath).replace(/\\/g, "/");
    const baseUrl = `/docs/${relativeOut}`;

    for (const entryPoint of data.entryPoints) {
      const normalized = entryPoint.replace(/\\/g, "/").replace(/^\.\//, "");
      const root = normalized.endsWith(".ts") ? path.posix.dirname(normalized) + "/" : normalized;
      index.push({ root, baseUrl });
    }
  }

  typedocIndexCache = index;
  return index;
}

function normalizeTypedocRefs(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function resolveTypedocRef(ref: string): { label: string; href: string } {
  const [pathPart, symbol] = ref.split("#");
  const normalizedPath = pathPart.replace(/\\/g, "/").replace(/^\.\//, "");
  const index = buildTypedocIndex();
  const match = index.find((entry) => normalizedPath.startsWith(entry.root));
  if (!match) {
    throw new Error(`Typedoc reference not found for "${ref}". Add a docs/typedoc config that covers "${pathPart}".`);
  }
  const label = symbol ? symbol : pathPart;
  const href = symbol ? `${match.baseUrl}#${symbol}` : match.baseUrl;
  return { label, href };
}

function injectTypedoc(content: string, frontmatterValue: unknown): string {
  const refsFromFrontmatter = normalizeTypedocRefs(frontmatterValue);
  let updated = content;
  const hasInlineTypedoc = /<!--\s*typedoc:[^\s]+?\s*-->/.test(content);
  if (refsFromFrontmatter.length === 0 && !hasInlineTypedoc) {
    return updated;
  }
  const typedocIndex = buildTypedocIndex();
  if (typedocIndex.length === 0) {
    return updated;
  }

  const inlinePattern = /<!--\s*typedoc:([^\s]+)\s*-->/g;
  updated = updated.replace(inlinePattern, (_match, ref: string) => {
    const resolved = resolveTypedocRef(ref);
    return `\n> TypeDoc: [${resolved.label}](${resolved.href})\n`;
  });

  if (refsFromFrontmatter.length > 0) {
    const items = refsFromFrontmatter
      .map((ref) => {
        const resolved = resolveTypedocRef(ref);
        return `- [${resolved.label}](${resolved.href})`;
      })
      .join("\n");
    updated += `\n\n## TypeDoc References\n${items}\n`;
  }

  return updated;
}

export function getBlogPosts(): PostMeta[] {
  const blogDir = path.join(contentDir, "blog");
  if (!fs.existsSync(blogDir)) return [];

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(blogDir, file), "utf8");
      const { data } = matter(raw);
      return {
        slug: file.replace(".mdx", ""),
        title: data.title ?? "",
        description: data.description ?? "",
        date: data.date ?? "",
        tag: data.tag ?? "",
        author: data.author ?? "Ayoub Fandi",
        published: data.published !== false,
      };
    })
    .filter((p) => p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPost(slug: string): { meta: PostMeta; content: string } | null {
  const filePath = path.join(contentDir, "blog", `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    meta: {
      slug,
      title: data.title ?? "",
      description: data.description ?? "",
      date: data.date ?? "",
      tag: data.tag ?? "",
      author: data.author ?? "Ayoub Fandi",
      published: data.published !== false,
    },
    content,
  };
}

export function getDocPages(): DocMeta[] {
  const docsDir = path.join(contentDir, "docs");
  if (!fs.existsSync(docsDir)) return [];

  const pages: DocMeta[] = [];

  function scanDir(dir: string, slugPrefix: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const isDocFile = entry.isFile() && (entry.name.endsWith(".mdx") || entry.name.endsWith(".md"));
      if (isDocFile) {
        const raw = fs.readFileSync(path.join(dir, entry.name), "utf8");
        const { data } = matter(raw);
        const name = entry.name.replace(/\.(mdx|md)$/i, "");
        if (name === "index" && slugPrefix.length === 0) continue;
        const slug = name === "index" ? slugPrefix : [...slugPrefix, name];
        pages.push({
          slug,
          title: data.title ?? "",
          description: data.description ?? "",
          order: data.order ?? 999,
          section: data.section ?? "",
        });
      } else if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), [...slugPrefix, entry.name]);
      }
    }
  }

  scanDir(docsDir, []);
  return pages.sort((a, b) => a.order - b.order);
}

export function getDocPage(slug: string[]): { meta: DocMeta; content: string } | null {
  const docsDir = path.join(contentDir, "docs");
  const basePath = path.join(docsDir, ...slug);
  const candidates = [
    `${basePath}.mdx`,
    `${basePath}.md`,
  ];

  let filePath: string | null = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath && fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    const indexMdx = path.join(basePath, "index.mdx");
    const indexMd = path.join(basePath, "index.md");
    if (fs.existsSync(indexMdx)) filePath = indexMdx;
    if (!filePath && fs.existsSync(indexMd)) filePath = indexMd;
  }

  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const contentWithTypedoc = injectTypedoc(content, data.typedoc);

  return {
    meta: {
      slug,
      title: data.title ?? "",
      description: data.description ?? "",
      order: data.order ?? 999,
      section: data.section ?? "",
      typedoc: normalizeTypedocRefs(data.typedoc),
    },
    content: contentWithTypedoc,
  };
}
