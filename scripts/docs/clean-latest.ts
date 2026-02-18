import { existsSync, rmSync } from "fs";
import { join } from "path";

const target = join(process.cwd(), "apps/web/content/docs/reference/latest");

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
