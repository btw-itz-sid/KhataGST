import { test } from "node:test";
import assert from "node:assert/strict";
import { containsTerm, knowledgeService } from "../src/services/knowledgeService.js";

test("terms match whole words and plurals only", () => {
  assert.equal(containsTerm("Company car insurance", "car"), true);
  assert.equal(containsTerm("Two cars serviced", "car"), true);
  assert.equal(containsTerm("Credit card processing fee", "car"), false);
  assert.equal(containsTerm("Cargo freight charges", "car"), false);
  assert.equal(containsTerm("Woollen scarf", "car"), false);
  assert.equal(containsTerm("Office cabinet", "cab"), false);
  assert.equal(containsTerm("Spare parts for CNC machine", "spa"), false);
});

const blocked = (description: string) => knowledgeService.checkBlockedCredit(description);

test("Section 17(5) blocks the expenses it should", () => {
  assert.equal(blocked("Company car insurance premium").section, "Section 17(5)(a)");
  assert.equal(blocked("Staff lunch during client review").section, "Section 17(5)(b)(i)");
  assert.equal(blocked("Annual gym membership").section, "Section 17(5)(b)(ii)");
  assert.equal(blocked("Diwali gifts for dealers").section, "Section 17(5)(h)");
});

test("ordinary business expenses are not caught by substring matches", () => {
  for (const description of [
    "Credit card processing fee",
    "Cargo freight charges",
    "Office cabinet",
    "Spare parts for CNC machine",
    "Personal protective equipment for workers",
  ]) {
    assert.equal(blocked(description).isBlocked, false, description);
  }
});

test("keyword search still finds sections without embeddings", () => {
  const [top] = knowledgeService.keywordSearch("Can I claim ITC on car insurance?");
  assert.equal(top.section_number, "17(5)(a)");
});
