import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/offer-pricing.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { offerPrice, currentOffer, normalizeVoucherCode } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("percentage discounts round half cents like PostgreSQL numeric", () => {
  assert.equal(offerPrice(19.99, 50), 10);
  assert.equal(offerPrice(10.05, 10), 9.05);
  assert.equal(offerPrice(1000.99, 20), 800.79);
  assert.equal(offerPrice(1000.99, 15), 850.84);
});
test("small and large prices retain cents", () => {
  assert.equal(offerPrice(0.01, 90), 0);
  assert.equal(offerPrice(9999999999.99, 1), 9899999999.99);
});
test("an offer is invalid at its exact expiry time", () => {
  const offer = { expires_at: "2026-10-02T12:00:00.000Z" };
  const expiry = Date.parse(offer.expires_at);
  assert.equal(currentOffer(offer, expiry - 1), offer);
  assert.equal(currentOffer(offer, expiry), null);
  assert.equal(currentOffer(offer, expiry + 1), null);
  assert.equal(currentOffer(null, expiry), null);
});
test("voucher matching ignores surrounding spaces and case", () => {
  assert.equal(normalizeVoucherCode("  save15  "), "SAVE15");
  assert.equal(normalizeVoucherCode(""), "");
});
