import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestHsn } from "../src/services/hsnSuggestService.js";

describe("hsn suggest", () => {
  it("suggests SAC for consulting / advocate fees", async () => {
    const hits = await suggestHsn("Advocate legal fees for notice reply", 3);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].hsn_sac, "9982");
  });

  it("flags catering-ish food descriptions with a SAC", async () => {
    const hits = await suggestHsn("Staff lunch catering", 3);
    assert.ok(hits.some((h) => h.hsn_sac === "9963"));
  });
});
