export function recoveryLinkError(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has("error") && !params.has("error_code")) return null;
  return "This password reset link has expired or is invalid. Request a new link.";
}

export function isRecoveryLink(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("type") === "recovery" && !recoveryLinkError(hash);
}