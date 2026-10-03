// Every error and warning code a screen can receive, in one place (ADR 0007: closed lists). Each list mirrors a
// union in core or services. The check goes one way: a code a service can return but missing here does not compile
// (the handlers' replies are typed by these lists); a code left here after core dropped it is only dead.

export const AI_CODES = [
  "AI_AUTH_FAILED",
  "AI_RATE_LIMITED",
  "AI_UNAVAILABLE",
  "AI_MODEL_NOT_FOUND",
  "AI_BAD_REQUEST",
  "AI_REFUSED",
  "AI_OUTPUT_TRUNCATED",
] as const;

export const SECRET_STORE_CODES = ["SECRET_STORE_UNAVAILABLE", "SECRET_STORE_FAILED"] as const;

export const REPO_READ_CODES = [
  "PATH_NOT_FOUND",
  "NOT_A_DIRECTORY",
  "NOT_A_FILE",
  "PATH_UNREADABLE",
  "PATH_OUTSIDE_ROOT",
] as const;

/** Things a finished scan reports without failing (a file it could not read, an area it could not match). */
export const SCAN_WARNING_CODES = [
  "SOURCE_FILE_UNREADABLE",
  "NO_PRD_FILES",
  "BATCH_NOT_SCANNED",
] as const;

/** Main reads only folders the user chose in the system dialog (ADR 0007); any other path is refused. */
export const FOLDER_CODES = ["FOLDER_NOT_PICKED"] as const;

/** Reading a PRD folder (mirrors ExtractRequirementsError): no PRD files in it, or a read failure. */
export const PRD_READ_CODES = ["NO_PRD_FILES", ...REPO_READ_CODES] as const;
