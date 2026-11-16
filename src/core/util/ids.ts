let counter = 0;

/** Short, collision-resistant id for nodes created in this session. */
export function newId(prefix = "n"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
