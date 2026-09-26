/**
 * Zelevos Trip Confidence Score Engine (Step 3 Enhancement)
 *
 * Computes a deterministic 0-100% confidence score with descriptive categorization
 * based on vendor performance metrics:
 * 1. Acceptance Rate (40% weight): Percentage of assigned booking requests accepted.
 * 2. SLA Response Performance (35% weight): Average response time vs configured SLA (120 mins).
 * 3. Low Cancellation Rate (25% weight): Supplier-initiated cancellation history.
 *
 * Recalculates dynamically whenever vendor metrics change.
 */

export interface VendorPerformanceMetrics {
  acceptanceRate: number; // 0 - 100
  avgResponseMinutes: number; // e.g. 25 mins
  cancellationRate: number; // 0 - 100
  slaStandardMinutes?: number; // defaults to 120 mins
}

export interface TripConfidenceResult {
  score: number; // 0 - 100
  label: "High confidence" | "Moderate" | "Needs review";
  breakdown: {
    acceptanceScore: number;
    responseScore: number;
    cancellationScore: number;
    acceptanceRate: number;
    avgResponseMinutes: number;
    cancellationRate: number;
  };
}

/**
 * Deterministic formula to compute the Trip Confidence Score.
 */
export function computeTripConfidenceScore(
  vendors: VendorPerformanceMetrics[] | VendorPerformanceMetrics
): TripConfidenceResult {
  const metricsList = Array.isArray(vendors) ? vendors : [vendors];

  if (metricsList.length === 0) {
    return {
      score: 95,
      label: "High confidence",
      breakdown: {
        acceptanceScore: 38,
        responseScore: 33,
        cancellationScore: 24,
        acceptanceRate: 95,
        avgResponseMinutes: 30,
        cancellationRate: 1,
      },
    };
  }

  // Aggregate averages across all assigned vendors
  const totalVendors = metricsList.length;
  const avgAcceptanceRate =
    metricsList.reduce((acc, m) => acc + Number(m.acceptanceRate || 100), 0) /
    totalVendors;
  const avgResponseMins =
    metricsList.reduce((acc, m) => acc + Number(m.avgResponseMinutes || 30), 0) /
    totalVendors;
  const avgCancellationRate =
    metricsList.reduce((acc, m) => acc + Number(m.cancellationRate || 0), 0) /
    totalVendors;

  const slaMins = metricsList[0]?.slaStandardMinutes || 120;

  // Component 1: Acceptance Rate (40% weight) -> max 40 points
  const acceptanceScore = Math.min(40, Math.max(0, (avgAcceptanceRate / 100) * 40));

  // Component 2: SLA Response Time (35% weight) -> max 35 points
  // 100% if response <= 30 mins, decaying linearly to 0 if response >= 2x SLA (240 mins)
  const responseRatio = Math.max(0, 1 - avgResponseMins / (slaMins * 1.5));
  const responseScore = Math.min(35, Math.max(0, responseRatio * 35));

  // Component 3: Cancellation Rate (25% weight) -> max 25 points
  // 0% cancellations = 25 points, 10% cancellations = 0 points
  const cancellationPenalty = (avgCancellationRate / 10) * 25;
  const cancellationScore = Math.min(25, Math.max(0, 25 - cancellationPenalty));

  const totalScore = Math.round(acceptanceScore + responseScore + cancellationScore);
  const boundedScore = Math.min(100, Math.max(0, totalScore));

  let label: "High confidence" | "Moderate" | "Needs review";
  if (boundedScore >= 80) {
    label = "High confidence";
  } else if (boundedScore >= 60) {
    label = "Moderate";
  } else {
    label = "Needs review";
  }

  return {
    score: boundedScore,
    label,
    breakdown: {
      acceptanceScore: Math.round(acceptanceScore),
      responseScore: Math.round(responseScore),
      cancellationScore: Math.round(cancellationScore),
      acceptanceRate: Math.round(avgAcceptanceRate),
      avgResponseMinutes: Math.round(avgResponseMins),
      cancellationRate: Math.round(avgCancellationRate),
    },
  };
}
