import { describe, expect, it } from "vitest";
import {
  createWritingQuotaReserver,
  type WritingSlotStore,
} from "@/lib/security/writing-quota-core";

describe("Writing learner quota concurrency boundary", () => {
  it("cannot reserve more than two same-day learner slots concurrently", async () => {
    const occupied = new Map<string, string>();
    let nextId = 0;
    const store: WritingSlotStore = {
      async tryCreateSlot({ userId, quotaKey, slotNumber }) {
        const key = `${userId}:${quotaKey}:${slotNumber}`;
        if (occupied.has(key)) return null;
        occupied.set(key, `reservation-${++nextId}`);
        return { id: occupied.get(key)! };
      },
    };
    const reserve = createWritingQuotaReserver(store, {
      now: () => new Date("2026-07-28T12:00:00.000Z"),
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserve("learner-1")),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect(
      results.filter(
        (result) => !result.allowed && result.reason === "quota-exceeded",
      ),
    ).toHaveLength(6);
    expect(occupied.size).toBe(2);
  });

  it("atomically recycles FAILED slots without exceeding two occupied slots", async () => {
    const rows = new Map<
      string,
      { id: string; status: "PENDING" | "COMPLETED" | "FAILED" }
    >([
      [
        "learner-1:2026-07-28:1",
        { id: "legacy-invalid-response", status: "FAILED" },
      ],
      [
        "learner-1:2026-07-28:2",
        { id: "legacy-provider-failure", status: "FAILED" },
      ],
    ]);
    const store: WritingSlotStore = {
      async tryCreateSlot({ userId, quotaKey, slotNumber }) {
        const key = `${userId}:${quotaKey}:${slotNumber}`;
        const row = rows.get(key);
        if (row && row.status !== "FAILED") return null;
        if (row) {
          row.status = "PENDING";
          return { id: row.id };
        }
        const created = { id: `new-${slotNumber}`, status: "PENDING" as const };
        rows.set(key, created);
        return { id: created.id };
      },
    };
    const reserve = createWritingQuotaReserver(store, {
      now: () => new Date("2026-07-28T12:00:00.000Z"),
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserve("learner-1")),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect(
      [...rows.values()].filter(
        (row) => row.status === "PENDING" || row.status === "COMPLETED",
      ),
    ).toHaveLength(2);
    expect([...rows.values()].every((row) => row.status === "PENDING")).toBe(
      true,
    );
  });
});
