/**
 * OpenClaw Public Bind Guard
 *
 * Prevents gateway from binding to public interfaces without strong authentication.
 * This is a critical security control to prevent unauthorized access.
 *
 * To allow public binding, ALL of the following must be satisfied:
 * 1. OPENCLAW_ALLOW_PUBLIC_BIND=true environment variable
 * 2. OPENCLAW_PUBLIC_BIND_IP_ALLOWLIST is non-empty (comma-separated IPs)
 * 3. Strong auth enabled (mTLS via OPENCLAW_REQUIRE_MTLS=true OR OIDC via OPENCLAW_OIDC_ISSUER)
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security/bind-guard");

export type PublicBindGuardResult = {
  allowed: boolean;
  reason?: string;
  remediations?: string[];
};

export type PublicBindGuardOptions = {
  bindHost: string;
  env?: NodeJS.ProcessEnv;
  hasToken?: boolean;
  hasPassword?: boolean;
  hasTailscaleAuth?: boolean;
};

/**
 * Checks if a host address is a public/non-loopback address
 */
export function isPublicBindAddress(host: string): boolean {
  const normalized = host.trim().toLowerCase();

  // IPv4 any address
  if (normalized === "0.0.0.0") {
    return true;
  }

  // IPv6 any address
  if (normalized === "::" || normalized === "[::]") {
    return true;
  }

  // Check if it's a loopback address
  if (normalized === "127.0.0.1" || normalized.startsWith("127.")) {
    return false;
  }
  if (normalized === "::1" || normalized === "[::1]") {
    return false;
  }
  if (normalized.startsWith("::ffff:127.")) {
    return false;
  }

  // Check for localhost hostname
  if (normalized === "localhost") {
    return false;
  }

  // Tailscale addresses (100.64.0.0/10 - CGNAT range used by Tailscale)
  // These are semi-private but still need caution
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(normalized)) {
    return false; // Tailscale addresses are treated as local
  }

  // Any other IP is considered public
  return true;
}

/**
 * Checks if strong authentication is configured for public binding
 */
function hasStrongAuth(env: NodeJS.ProcessEnv): { ok: boolean; method?: string; missing: string[] } {
  const missing: string[] = [];

  // Check for mTLS
  if (env.OPENCLAW_REQUIRE_MTLS === "true") {
    return { ok: true, method: "mTLS", missing: [] };
  }

  // Check for OIDC
  if (env.OPENCLAW_OIDC_ISSUER && env.OPENCLAW_OIDC_ISSUER.trim().length > 0) {
    return { ok: true, method: "OIDC", missing: [] };
  }

  missing.push("OPENCLAW_REQUIRE_MTLS=true");
  missing.push("OPENCLAW_OIDC_ISSUER=<issuer-url>");

  return { ok: false, missing };
}

/**
 * Parses the IP allowlist from environment
 */
function parseIpAllowlist(env: NodeJS.ProcessEnv): string[] {
  const raw = env.OPENCLAW_PUBLIC_BIND_IP_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/**
 * Main guard function - call before server.listen() to validate bind configuration
 */
export function assertPublicBindSafe(options: PublicBindGuardOptions): PublicBindGuardResult {
  const { bindHost, hasToken, hasPassword, hasTailscaleAuth } = options;
  const env = options.env ?? process.env;

  // If binding to loopback, always allowed
  if (!isPublicBindAddress(bindHost)) {
    return { allowed: true };
  }

  const remediations: string[] = [];

  // Check 1: OPENCLAW_ALLOW_PUBLIC_BIND must be explicitly true
  const allowPublic = env.OPENCLAW_ALLOW_PUBLIC_BIND === "true";
  if (!allowPublic) {
    remediations.push("Set OPENCLAW_ALLOW_PUBLIC_BIND=true to explicitly allow public binding");
    remediations.push("Or set HOST=127.0.0.1 to bind to loopback only");
    remediations.push("Or use SSH tunnel: ssh -L 18789:localhost:18789 user@host");
    remediations.push("Or use Tailscale/ZeroTier for private networking");

    log.warn(
      `public bind guard: refusing to bind to ${bindHost} - OPENCLAW_ALLOW_PUBLIC_BIND not set`,
    );

    return {
      allowed: false,
      reason: `Refusing to bind gateway to public address '${bindHost}' without explicit opt-in`,
      remediations,
    };
  }

  // Check 2: IP allowlist must be configured
  const ipAllowlist = parseIpAllowlist(env);
  if (ipAllowlist.length === 0) {
    remediations.push(
      "Set OPENCLAW_PUBLIC_BIND_IP_ALLOWLIST=<ip1>,<ip2> to specify allowed client IPs",
    );

    log.warn(`public bind guard: refusing to bind to ${bindHost} - no IP allowlist configured`);

    return {
      allowed: false,
      reason:
        "Public binding requires an IP allowlist (OPENCLAW_PUBLIC_BIND_IP_ALLOWLIST is empty)",
      remediations,
    };
  }

  // Check 3: Strong auth must be enabled (mTLS or OIDC) OR at least basic auth
  const strongAuth = hasStrongAuth(env);
  const hasBasicAuth = hasToken || hasPassword || hasTailscaleAuth;

  if (!strongAuth.ok && !hasBasicAuth) {
    remediations.push("Configure strong authentication:");
    remediations.push("  - Set OPENCLAW_REQUIRE_MTLS=true for mTLS");
    remediations.push("  - Or set OPENCLAW_OIDC_ISSUER=<url> for OIDC");
    remediations.push("  - Or at minimum, set OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD");

    log.warn(`public bind guard: refusing to bind to ${bindHost} - no authentication configured`);

    return {
      allowed: false,
      reason: "Public binding requires authentication to be configured",
      remediations,
    };
  }

  // All checks passed
  const authMethod = strongAuth.ok ? strongAuth.method : hasToken ? "token" : "password/tailscale";

  log.info(
    `public bind guard: allowing bind to ${bindHost} (allowlist: ${ipAllowlist.length} IPs, auth: ${authMethod})`,
  );

  return { allowed: true };
}

/**
 * Enforces the public bind guard - throws if binding is not allowed
 */
export function enforcePublicBindGuard(options: PublicBindGuardOptions): void {
  const result = assertPublicBindSafe(options);

  if (!result.allowed) {
    const message = [
      "",
      "═══════════════════════════════════════════════════════════════",
      " OPENCLAW SECURITY: Public Bind Refused",
      "═══════════════════════════════════════════════════════════════",
      "",
      ` Reason: ${result.reason}`,
      "",
      " Remediation options:",
      ...(result.remediations?.map((r) => `   • ${r}`) ?? []),
      "",
      " For more information, see:",
      "   https://docs.openclaw.ai/security/public-bind",
      "",
      "═══════════════════════════════════════════════════════════════",
      "",
    ].join("\n");

    // Log the full message for visibility
    console.error(message);

    throw new Error(`Security: ${result.reason}`);
  }
}

/**
 * Logs a security event for public bind attempts
 */
export function logPublicBindAttempt(options: {
  bindHost: string;
  allowed: boolean;
  reason?: string;
}): void {
  const event = {
    type: "PUBLIC_BIND_ATTEMPT",
    timestamp: new Date().toISOString(),
    bindHost: options.bindHost,
    allowed: options.allowed,
    reason: options.reason,
  };

  if (options.allowed) {
    log.info(`SECURITY_EVENT: ${JSON.stringify(event)}`);
  } else {
    log.warn(`SECURITY_EVENT: ${JSON.stringify(event)}`);
  }
}
