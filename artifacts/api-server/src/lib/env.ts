import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnvironment(): void {
  const envNames = [".env", "..env"];
  const candidates: string[] = [];

  for (const envName of envNames) {
    candidates.push(path.resolve(process.cwd(), envName));
    candidates.push(path.resolve(process.cwd(), `../${envName}`));
    candidates.push(path.resolve(process.cwd(), `../../${envName}`));
    candidates.push(path.resolve(process.cwd(), `artifacts/api-server/${envName}`));
    candidates.push(path.resolve(__dirname, `../${envName}`));
    candidates.push(path.resolve(__dirname, `../../${envName}`));
    candidates.push(path.resolve(__dirname, `../../../${envName}`));
  }

  // Walk up from current directory to workspace root
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    for (const envName of envNames) {
      candidates.push(path.resolve(curr, envName));
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof (process as any).loadEnvFile === "function") {
          (process as any).loadEnvFile(envPath);
        }
      } catch {
        // Fallback to manual parsing below
      }

      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            // Populate if not set or empty in process.env
            if (!process.env[key] || process.env[key]?.trim() === "") {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // Continue if unable to read file
      }
    }
  }
}

// Automatically load on import
loadEnvironment();
