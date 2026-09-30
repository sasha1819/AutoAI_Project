import { z } from "zod";

/** What a hidden value is replaced with. The diagnosis prompt tells Claude not to guess what it was. */
export const REDACTED = "[REDACTED]";

// Text that went through redactSecrets. Only this file can create it, so a prompt builder that accepts only
// RedactedText cannot be handed raw failure text by mistake.
const Redacted = z.string().brand<"Redacted">();
export type RedactedText = z.infer<typeof Redacted>;

// Names of fields and keys that hold secrets. Deliberately broad: hiding a harmless value costs a little
// diagnosis detail; sending a password costs the user's trust.
const SECRET_FIELD = String.raw`(?:pass(?:word|wd|code|phrase)?|pwd|secret|token|api[ _-]?key|otp|cvv|cvc|card[ _-]?number)`;
const SECRET_KEY = String.raw`(?:${SECRET_FIELD}|credential|access[_-]?key|private[_-]?key|client[_-]?secret|session[_-]?id|cookie)`;

// Well-known key and token formats, hidden wherever they appear.
const TOKEN_FORMATS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];
const HEADER_NAME = String.raw`(["']?)\b(proxy-authorization|authorization|set-cookie|cookie|x-api-key|x-auth-token|api-key)\1(\s*:\s*)`;
// A header whose value is quoted (in code or JSON), and one whose value runs to the end of the line.
const QUOTED_HEADER = new RegExp(String.raw`${HEADER_NAME}(["'])((?:(?!\4)[^\n])*)\4`, "gi");
const BARE_HEADER = new RegExp(String.raw`${HEADER_NAME}(?![\s"'])([^\n,}]+)`, "gi");
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:"'<>]+:[^\s/@"'<>]+@/gi;
// A query parameter's value, in absolute and relative URLs alike (tokens hide in innocent names like "code").
const QUERY_VALUE = /(?<=\S)([?&])([A-Za-z0-9_.\-[\]]+)=([^&#\s"'<>`)]*)/g;
const QUOTED_ASSIGNMENT = new RegExp(
  String.raw`(["']?)\b([A-Za-z0-9_-]*?${SECRET_KEY}[A-Za-z0-9_-]*)\1(\s*[:=]\s*)(["'\`])((?:(?!\4)[^\n\\]|\\.)*)\4`,
  "gi",
);
const ENV_ASSIGNMENT =
  /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[A-Z0-9_]*)=([^\s"'`]+)/g;
// A value typed into a secret field in test code: getByLabel("Password").fill("...").
const TYPED_INTO_SECRET_FIELD = new RegExp(
  String.raw`((?:getBy\w+|locator)\([^\n]*?${SECRET_FIELD}[^\n]*?\)\s*\.\s*(?:fill|type|pressSequentially)\(\s*)(["'\`])((?:(?!\2)[^\n])*)\2`,
  "gi",
);
// A secret field's value in Playwright's page snapshot, which shows password fields in clear text.
const SNAPSHOT_TEXTBOX = /^(\s*-\s*textbox\s+"([^"]*)"[^:\n]*:\s*)(.+)$/gm;
const SECRET_FIELD_NAME = new RegExp(SECRET_FIELD, "i");
// A failed check's values, hidden when the check was on a secret field ("Locator: getByLabel('Password')").
const CHECK_ON_SECRET_FIELD = new RegExp(String.raw`Locator:[^\n]*${SECRET_FIELD}`, "i");
const CHECK_VALUE = /^((?:Expected|Received)[^:\n]*:\s*)(.+)$/gm;

/**
 * Hides secrets in text that will be sent to an AI provider: known key/token formats, auth and cookie headers,
 * URL credentials and query values, values assigned to secret-named keys, values typed into secret fields, and
 * secret fields' values in Playwright's page snapshot and check errors. Emails and other app text are kept: they
 * are the user's own data going to the user's own provider, and diagnoses need them. `count` is how many values
 * were hidden, so the user can be told.
 */
export function redactSecrets(text: string): {
  readonly text: RedactedText;
  readonly count: number;
} {
  let count = 0;
  // Replaces `value` with REDACTED unless it already is; counts each real replacement.
  const hide = (value: string): string => {
    if (value === REDACTED) return value;
    count += 1;
    return REDACTED;
  };
  let out = text;
  for (const format of TOKEN_FORMATS) out = out.replace(format, hide);
  out = out.replace(
    QUOTED_HEADER,
    (_m, q1: string, name: string, sep: string, q: string, value: string) =>
      `${q1}${name}${q1}${sep}${q}${hide(value)}${q}`,
  );
  out = out.replace(
    BARE_HEADER,
    (_m, q1: string, name: string, sep: string, value: string) =>
      `${q1}${name}${q1}${sep}${hide(value.trim())}`,
  );
  out = out.replace(URL_CREDENTIALS, (_m, scheme: string) => `${scheme}${hide("credentials")}@`);
  out = out.replace(QUERY_VALUE, (m, sep: string, key: string, value: string) =>
    value === "" ? m : `${sep}${key}=${hide(value)}`,
  );
  out = out.replace(
    QUOTED_ASSIGNMENT,
    (_m, q1: string, key: string, sep: string, q: string, value: string) =>
      `${q1}${key}${q1}${sep}${q}${hide(value)}${q}`,
  );
  out = out.replace(ENV_ASSIGNMENT, (_m, key: string, value: string) => `${key}=${hide(value)}`);
  out = out.replace(
    TYPED_INTO_SECRET_FIELD,
    (_m, call: string, q: string, value: string) => `${call}${q}${hide(value)}${q}`,
  );
  out = out.replace(SNAPSHOT_TEXTBOX, (m, head: string, name: string, value: string) =>
    SECRET_FIELD_NAME.test(name) ? `${head}${hide(value)}` : m,
  );
  if (CHECK_ON_SECRET_FIELD.test(out)) {
    out = out.replace(CHECK_VALUE, (_m, head: string, value: string) => `${head}${hide(value)}`);
  }
  return { text: Redacted.parse(out), count };
}
