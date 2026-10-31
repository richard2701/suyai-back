/**
 * Copy only the allowlisted keys from untrusted input. Used by the public form
 * mutations to prevent mass assignment of server-managed fields (e.g.
 * `emailSent`) or anything else the GraphQL input type happens to expose.
 * Keys whose value is `undefined` are skipped so they don't overwrite defaults.
 */
export const pickFields = <K extends string>(
  input: Record<string, unknown> | null | undefined,
  allowed: readonly K[]
): Partial<Record<K, unknown>> => {
  const output: Partial<Record<K, unknown>> = {};
  if (!input) return output;
  for (const key of allowed) {
    if (input[key] !== undefined) {
      output[key] = input[key];
    }
  }
  return output;
};
