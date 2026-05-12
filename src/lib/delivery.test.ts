import { describe, expect, it } from "vitest";
import { calculateDeliveryWindow, haversineDistanceKm } from "./delivery";

describe("haversineDistanceKm", () => {
  it("calculates the distance between Shenzhen and Chengdu", () => {
    const distance = haversineDistanceKm(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 30.5728, longitude: 104.0668 },
    );

    expect(distance).toBeGreaterThan(1300);
    expect(distance).toBeLessThan(1400);
  });
});

describe("calculateDeliveryWindow", () => {
  it("keeps same-city letters slow but not instant", () => {
    const result = calculateDeliveryWindow({ distanceKm: 8 });

    expect(result.minMinutes).toBe(10);
    expect(result.maxMinutes).toBe(60);
    expect(result.label).toBe("同城邮路");
  });

  it("uses a longer window for cross-province letters", () => {
    const result = calculateDeliveryWindow({ distanceKm: 1350 });

    expect(result.minMinutes).toBe(6 * 60);
    expect(result.maxMinutes).toBe(24 * 60);
    expect(result.label).toBe("跨省邮路");
  });
});
