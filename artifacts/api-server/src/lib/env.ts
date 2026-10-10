import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadEnvironment(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof process.loadEnvFile === "function") {
          process.loadEnvFile(envPath);
        } else {
          const content = fs.readFileSync(envPath, "utf-8");
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (process.env[key] === undefined) {
                process.env[key] = val;
              }
            }
          }
        }
        break;
      } catch (err) {
        console.warn(`[EnvLoader] Failed loading ${envPath}:`, err);
      }
    }
  }

  // Ensure EMAIL_FROM and RESEND_FROM_EMAIL are both defined
  if (!process.env.EMAIL_FROM && process.env.RESEND_FROM_EMAIL) {
    process.env.EMAIL_FROM = process.env.RESEND_FROM_EMAIL;
  }
  if (!process.env.RESEND_FROM_EMAIL && process.env.EMAIL_FROM) {
    process.env.RESEND_FROM_EMAIL = process.env.EMAIL_FROM;
  }
}

// Execute immediately when module is evaluated
loadEnvironment();
