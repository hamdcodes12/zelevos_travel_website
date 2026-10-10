import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateHaversineDistanceKm,
  evaluateDeviceStatus,
  realtimeBroadcaster,
  TRACKING_CONFIG,
} from "../src/services/tracking-service";

test("Tracking Safety Engine: Haversine distance calculations", async (t) => {
  await t.test("accurately calculates distance between Srinagar Airport and Dal Lake", () => {
    // Srinagar Airport (SXR): 33.9871, 74.7744
    // Dal Lake Ghat (Srinagar): 34.0837, 74.8370
    const distanceKm = calculateHaversineDistanceKm(33.9871, 74.7744, 34.0837, 74.8370);
    // Real distance is approximately 12.2 km
    assert.ok(distanceKm >= 11.5 && distanceKm <= 13.0, `Calculated distance ${distanceKm}km is in expected range ~12.2km`);
  });

  await t.test("calculates zero distance for identical coordinates", () => {
    const distance = calculateHaversineDistanceKm(34.0837, 74.837, 34.0837, 74.837);
    assert.strictEqual(distance, 0);
  });

  await t.test("calculates distance between Delhi and Agra accurately", () => {
    // Connaught Place Delhi: 28.6315, 77.2167
    // Taj Mahal Agra: 27.1751, 78.0421
    const distance = calculateHaversineDistanceKm(28.6315, 77.2167, 27.1751, 78.0421);
    // Real geodesic distance is ~178 km
    assert.ok(distance >= 170 && distance <= 185, `Calculated distance ${distance}km is in expected range ~178km`);
  });

  await t.test("throws on invalid or NaN coordinates", () => {
    assert.throws(() => calculateHaversineDistanceKm(NaN, 74.837, 34.0837, 74.837));
    assert.throws(() => calculateHaversineDistanceKm(34.0837, 74.837, "34" as any, 74.837));
  });
});

test("Tracking Safety Engine: Device Status Evaluation (LIVE / STALE / OFFLINE)", async (t) => {
  const now = Date.now();

  await t.test("evaluates update from 10 seconds ago as LIVE", () => {
    const tenSecAgo = new Date(now - 10000);
    const { status, secondsAgo } = evaluateDeviceStatus(true, tenSecAgo, now);
    assert.strictEqual(status, "LIVE");
    assert.strictEqual(secondsAgo, 10);
  });

  await t.test("evaluates update from 75 seconds ago as STALE", () => {
    const seventyFiveSecAgo = new Date(now - 75000);
    const { status, secondsAgo } = evaluateDeviceStatus(true, seventyFiveSecAgo, now);
    assert.strictEqual(status, "STALE");
    assert.strictEqual(secondsAgo, 75);
  });

  await t.test("evaluates update from 180 seconds ago as OFFLINE", () => {
    const threeMinAgo = new Date(now - 180000);
    const { status, secondsAgo } = evaluateDeviceStatus(true, threeMinAgo, now);
    assert.strictEqual(status, "OFFLINE");
    assert.strictEqual(secondsAgo, 180);
  });

  await t.test("evaluates disabled tracking as DISABLED regardless of timestamp", () => {
    const recent = new Date(now - 2000);
    const { status, secondsAgo } = evaluateDeviceStatus(false, recent, now);
    assert.strictEqual(status, "DISABLED");
    assert.strictEqual(secondsAgo, null);
  });

  await t.test("evaluates missing timestamp as DISABLED", () => {
    const { status, secondsAgo } = evaluateDeviceStatus(true, null, now);
    assert.strictEqual(status, "DISABLED");
    assert.strictEqual(secondsAgo, null);
  });
});

test("Tracking Safety Engine: Realtime Broadcaster session scoping", async (t) => {
  await t.test("broadcasts only to subscribers of the matching session ID", () => {
    const targetSessionId = "session-test-alpha-001";
    const unrelatedSessionId = "session-test-beta-002";

    let targetReceived: any = null;
    let unrelatedReceived: any = null;

    const unsubTarget = realtimeBroadcaster.subscribe(targetSessionId, (data) => {
      targetReceived = data;
    });

    const unsubUnrelated = realtimeBroadcaster.subscribe(unrelatedSessionId, (data) => {
      unrelatedReceived = data;
    });

    realtimeBroadcaster.broadcast(targetSessionId, "location_update", {
      latitude: 34.0837,
      longitude: 74.837,
    });

    assert.ok(targetReceived !== null, "Target session received the broadcast");
    assert.strictEqual(targetReceived.event, "location_update");
    assert.strictEqual(targetReceived.payload.latitude, 34.0837);
    assert.strictEqual(unrelatedReceived, null, "Unrelated session must NOT receive another session's data");

    unsubTarget();
    unsubUnrelated();
  });
});
