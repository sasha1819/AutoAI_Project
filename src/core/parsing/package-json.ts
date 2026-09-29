import { z } from "zod";

export type PackageDependencies = { readonly names: readonly string[] };

const PackageJson = z.object({
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
});

/** The dependency names declared in a package.json text, or null when it cannot be read as one. */
export function parsePackageDependencies(text: string): PackageDependencies | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON: the caller only needs to know the dependencies are unknown.
    return null;
  }
  const parsed = PackageJson.safeParse(json);
  if (!parsed.success) return null;
  return {
    names: [
      ...Object.keys(parsed.data.dependencies ?? {}),
      ...Object.keys(parsed.data.devDependencies ?? {}),
    ],
  };
}
