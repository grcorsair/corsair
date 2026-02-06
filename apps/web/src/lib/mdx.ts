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
  published: boolean;
}

export interface DocMeta {
  slug: string[];
  title: string;
  description: string;
  order: number;
  section: string;
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
      if (entry.isFile() && entry.name.endsWith(".mdx")) {
        const raw = fs.readFileSync(path.join(dir, entry.name), "utf8");
        const { data } = matter(raw);
        const slug = [...slugPrefix, entry.name.replace(".mdx", "")];
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
  const filePath = path.join(contentDir, "docs", ...slug.slice(0, -1), `${slug[slug.length - 1]}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    meta: {
      slug,
      title: data.title ?? "",
      description: data.description ?? "",
      order: data.order ?? 999,
      section: data.section ?? "",
    },
    content,
  };
}
