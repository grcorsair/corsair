import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

const root = join(process.cwd(), "apps/web/content/docs/reference/latest");

const overrides: Record<string, {
  title: string;
  description: string;
  order: number;
  section: string;
}> = {
  "api/index.md": {
    title: "API Reference",
    description: "Generated API reference from source.",
    order: 10,
    section: "reference",
  },
  "sdk/index.md": {
    title: "SDK Reference",
    description: "Generated SDK reference from source.",
    order: 20,
    section: "reference",
  },
  "cli/index.md": {
    title: "CLI Reference",
    description: "Generated CLI reference from source.",
    order: 30,
    section: "reference",
  },
};

const docExtensions = new Set([".md", ".mdx"]);

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (docExtensions.has(ext)) files.push(fullPath);
  }
  return files;
}

function yamlEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

function extractTitle(content: string, fallback: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim() || fallback;
    }
  }
  return fallback;
}

function addFrontmatter(filePath: string): void {
  const raw = readFileSync(filePath, "utf8");
  if (raw.startsWith("---")) return;

  const rel = relative(root, filePath).replace(/\\/g, "/");
  const override = overrides[rel];
  const fileName = filePath.split("/").pop() || "Reference";
  const fallbackTitle = fileName.replace(/\.(md|mdx)$/i, "").replace(/-/g, " ");
  const title = override?.title || extractTitle(raw, fallbackTitle);
  const description = override?.description || "";
  const order = override?.order ?? 999;
  const section = override?.section ?? "";

  const frontmatterLines = [
    "---",
    `title: "${yamlEscape(title)}"`,
    `description: "${yamlEscape(description)}"`,
    `order: ${order}`,
  ];
  if (section) {
    frontmatterLines.push(`section: "${yamlEscape(section)}"`);
  }
  frontmatterLines.push("---", "");

  const next = frontmatterLines.join("\n") + raw;
  writeFileSync(filePath, next, "utf8");
}

if (existsSync(root) && statSync(root).isDirectory()) {
  for (const filePath of walk(root)) {
    addFrontmatter(filePath);
  }
}
