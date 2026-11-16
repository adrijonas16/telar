export function find_front_man(config: unknown): string | null;
export function is_mcp_ref(ref: string): boolean;
export function is_external_agent(ref: string): boolean;
export function classify_tool(config: unknown, ref: unknown): "mcp" | "remote" | "missing" | "coded" | "toolbox" | "agent";
