/**
 * Environment Variable Validation
 * 
 * Validates critical environment variables at server startup
 * to prevent runtime errors due to misconfiguration.
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ===== Port Configuration =====
  const rawPort = process.env.PORT || "3000";
  if (isNaN(Number(rawPort))) {
    errors.push(`PORT must be a number, got: ${process.env.PORT}`);
  } else if (!process.env.PORT) {
    warnings.push("PORT environment variable not provided; defaulting to 3000");
  }

  // ===== JWT Secrets =====
  // Seamless fallback so deployments with a single session secret work out-of-the-box
  if (!process.env.USER_SESSION_SECRET && process.env.SESSION_SECRET) {
    process.env.USER_SESSION_SECRET = process.env.SESSION_SECRET;
  } else if (!process.env.SESSION_SECRET && process.env.USER_SESSION_SECRET) {
    process.env.SESSION_SECRET = process.env.USER_SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      errors.push("SESSION_SECRET must be set in production for admin authentication");
    } else if (process.env.SESSION_SECRET.length < 32) {
      warnings.push("SESSION_SECRET should be at least 32 characters for security");
    }

    if (!process.env.USER_SESSION_SECRET) {
      errors.push("USER_SESSION_SECRET must be set in production for user authentication");
    } else if (process.env.USER_SESSION_SECRET.length < 32) {
      warnings.push("USER_SESSION_SECRET should be at least 32 characters for security");
    }
  } else {
    if (!process.env.SESSION_SECRET) {
      warnings.push("SESSION_SECRET not set - using development default");
    }
    if (!process.env.USER_SESSION_SECRET) {
      warnings.push("USER_SESSION_SECRET not set - using development default");
    }
  }

  // ===== Database Configuration (PostgreSQL / Supabase) =====
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (databaseUrl) {
    if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
      errors.push(`Invalid DATABASE_URL format: must start with postgresql:// or postgres://`);
    }
  }

  if (supabaseUrl) {
    if (!supabaseUrl.startsWith("https://") && !supabaseUrl.startsWith("http://")) {
      errors.push(`Invalid Supabase URL format: ${supabaseUrl}`);
    }
  }

  if (!databaseUrl && !supabaseKey) {
    // Check if publishable key fallback is available
    if (process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      warnings.push("Using VITE_SUPABASE_PUBLISHABLE_KEY for Supabase access");
      supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    } else {
      errors.push("Database configuration missing: Set DATABASE_URL or SUPABASE_SECRET_KEY");
    }
  } else if (supabaseKey) {
    // Validate key format: accepts JWT (eyJ...) or Supabase prefixed key (sb_...)
    const isValidFormat = supabaseKey.startsWith("eyJ") || supabaseKey.startsWith("sb_");
    if (!isValidFormat) {
      if (process.env.NODE_ENV === "production" && !databaseUrl) {
        errors.push("Supabase key appears invalid (must be JWT 'eyJ...' or prefixed 'sb_...')");
      } else {
        warnings.push("Supabase key has non-standard format; verifying via direct database access");
      }
    }
  }

  // ===== PayPal Configuration (warnings only) =====
  if (!process.env.PAYPAL_CLIENT_ID) {
    warnings.push("PAYPAL_CLIENT_ID not set - payment features will not work");
  }
  if (!process.env.PAYPAL_CLIENT_SECRET) {
    warnings.push("PAYPAL_CLIENT_SECRET not set - payment features will not work");
  }

  // ===== CORS Configuration =====
  if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS) {
    warnings.push("CORS_ORIGINS not set in production - using defaults may cause CORS issues");
  }

  // ===== Supabase Storage & Database Configuration =====
  if (process.env.NODE_ENV === "production" && !supabaseUrl) {
    errors.push("SUPABASE_URL must be configured in production for database and storage");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function logValidationResults(result: ValidationResult): void {
  if (result.warnings.length > 0) {
    console.warn("=".repeat(80));
    console.warn("⚠️  ENVIRONMENT CONFIGURATION WARNINGS");
    console.warn("=".repeat(80));
    result.warnings.forEach((warning, i) => {
      console.warn(`${i + 1}. ${warning}`);
    });
    console.warn("=".repeat(80));
  }

  if (result.errors.length > 0) {
    console.error("=".repeat(80));
    console.error("❌ ENVIRONMENT CONFIGURATION ERRORS");
    console.error("=".repeat(80));
    result.errors.forEach((error, i) => {
      console.error(`${i + 1}. ${error}`);
    });
    console.error("=".repeat(80));
    console.error("🛑 Server cannot start with configuration errors.");
    console.error("=".repeat(80));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("✅ Environment configuration validated successfully");
  }
}
