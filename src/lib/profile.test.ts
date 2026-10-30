import { describe, expect, it } from "vitest";
import { validateProfileSelection } from "./profile";

const cities = [
  {
    id: "shenzhen",
    name: "深圳",
    postOffices: [{ id: "shenzhen-central", name: "深圳中央邮政局" }],
  },
];

describe("validateProfileSelection", () => {
  it("accepts a post office that belongs to the selected city", () => {
    const result = validateProfileSelection({
      cityId: "shenzhen",
      postOfficeId: "shenzhen-central",
      cities,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a post office outside the selected city", () => {
    const result = validateProfileSelection({
      cityId: "shenzhen",
      postOfficeId: "chengdu-central",
      cities,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("请选择该城市下的邮政局");
    }
  });
});
