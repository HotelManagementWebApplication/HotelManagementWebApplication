import { describe, expect, it } from "vitest";
import { priceReviewDetails, proposedPrice } from "./servicePriceReview";

describe("service price review", () => {
  it("reads scalar/object proposals, preserves zero and rejects missing/invalid amounts", () => {
    expect(proposedPrice({payload:"180000"})).toBe(180000);
    expect(proposedPrice({payload:'{"price":180000}'})).toBe(180000);
    expect(proposedPrice({amount:0,payload:"999"})).toBe(0);
    for (const payload of ["null", "true", "{}", '""', "-1", "broken"])
      expect(proposedPrice({payload})).toBeNull();
  });

  it("shows the service, both prices, requester name, reason and expiry", () => {
    const lines=priceReviewDetails({payload:"180000",target_id:"COURT",requester:"KITCHEN",reason:"Chi phí tăng",expires_at:"2035-01-10T12:00:00"},
      [{id:"COURT",name:"Cầu lông",price:150000,unit:"giờ",stock:10,safety_threshold:0,low_stock:false}],
      [{employee_id:"KITCHEN",full_name:"Võ Minh"}]);
    expect(lines.join(" ")).toContain("Cầu lông (COURT)");
    expect(lines.join(" ")).toContain("Võ Minh (KITCHEN)");
    expect(lines[1]).toMatch(/150.000.*180.000/);
    expect(lines[3]).toContain("Chi phí tăng");
    expect(lines[4]).toContain("2035");
  });
});
