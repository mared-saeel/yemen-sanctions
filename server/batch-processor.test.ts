import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadAllRecordsForBatch: vi.fn(),
  buildBatchFuseIndex: vi.fn(),
  batchSearchOne: vi.fn(),
}));

vi.mock("./search-engine", () => mocks);

import { createBatchJob, getBatchStatistics, getJob, processJobInBackground } from "./batch-processor";

describe("batch job processing", () => {
  it("reports progress and classifies a verified three-word match without dropping no-match rows", async () => {
    mocks.loadAllRecordsForBatch.mockResolvedValue([{ id: 1 }]);
    mocks.buildBatchFuseIndex.mockReturnValue({});
    mocks.batchSearchOne.mockImplementation((name: string) => {
      if (name === "حميد عبدالله الاحمر") {
        return [{
          id: 1,
          nameEn: "HAMID ABDULLAH AL AHMAR",
          nameAr: "حميد عبد الله الاحمر",
          alternativeNames: [],
          entityType: "individual",
          issuingBody: "OFAC",
          listingDate: "2024-01-01",
          matchScore: 92,
          matchType: "smart",
        }];
      }
      return [];
    });

    const jobId = createBatchJob(["حميد عبدالله الاحمر", "اسم غير موجود"]);
    await processJobInBackground(jobId, ["حميد عبدالله الاحمر", "اسم غير موجود"]);

    const job = getJob(jobId);
    expect(job).toMatchObject({ status: "done", total: 2, processed: 2, progress: 100 });
    expect(job?.results).toEqual([
      expect.objectContaining({ inputName: "حميد عبدالله الاحمر", status: "MATCH", matchScore: 92 }),
      expect.objectContaining({ inputName: "اسم غير موجود", status: "NO_MATCH", matchScore: 0 }),
    ]);
    expect(getBatchStatistics(job?.results ?? [])).toMatchObject({ total: 2, matches: 1, noMatches: 1 });
  });
});
