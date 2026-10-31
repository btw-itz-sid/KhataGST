import { test } from "node:test";
import assert from "node:assert/strict";
import { containsTerm, knowledgeService } from "../src/services/knowledgeService.js";
import { buildItcDecision } from "../src/agents/taxClassifierAgent.js";

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

test("ITC decision reports blocked rupees instead of claimable rupees", () => {
  const blockedLunch = buildItcDecision("Staff lunch during client review", 100000, 18000);
  assert.equal(blockedLunch.itcEligibility, "blocked");
  assert.equal(blockedLunch.claimablePaise, 0);
  assert.equal(blockedLunch.blockedPaise, 18000);

  const eligibleSteel = buildItcDecision("Mild steel sheets for trading stock", 100000, 18000);
  assert.equal(eligibleSteel.itcEligibility, "eligible");
  assert.equal(eligibleSteel.claimablePaise, 18000);
  assert.equal(eligibleSteel.blockedPaise, 0);

  const rcmLegal = buildItcDecision("Advocate legal fees for GST notice", 50000, 9000);
  assert.equal(rcmLegal.itcEligibility, "rcm_applicable");
  assert.equal(rcmLegal.claimablePaise, 0);
});
