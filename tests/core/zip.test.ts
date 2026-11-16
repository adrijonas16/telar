import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, createZip } from "../../src/core/bundle/zip.ts";
import { bundleZip } from "../../src/core/bundle/bundle.ts";
import { bakerySample } from "../../src/core/samples/bakery.ts";

describe("zip", () => {
  it("computes the standard CRC-32 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("produces an archive standard tools can read", () => {
    const zip = createZip([
      { path: "a.txt", content: "hello" },
      { path: "dir/ñ.json", content: "{}" },
    ]);
    const file = join(mkdtempSync(join(tmpdir(), "telar-")), "t.zip");
    writeFileSync(file, zip);
    const listing = execFileSync("python3", [
      "-c",
      "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.read('a.txt').decode());print(*z.namelist())",
      file,
    ]).toString();
    expect(listing).toContain("hello");
    expect(listing).toContain("dir/ñ.json");
  });

  it("bundles the site files under the network folder", () => {
    const text = new TextDecoder().decode(bundleZip(bakerySample()));
    for (const f of ["panaderia_sol.network.json", "agent-manifest.json", "links.json", "README.md"]) {
      expect(text).toContain(`panaderia_sol/${f}`);
    }
  });
});
