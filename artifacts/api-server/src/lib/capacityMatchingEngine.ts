// ─────────────────────────────────────────────────────────────────────────────
// THINKATIC BPO PLATFORM — PHASE 7: DETERMINISTIC MATCHING ENGINE
// Server-Side Deterministic Rule Evaluator (Zero AI Decision Making)
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchingCriteriaResult {
  criterion: string;
  passed: boolean;
  required: string | number | boolean;
  actual: string | number | boolean;
  detail: string;
}

export interface CandidateCentreProfile {
  centreId: number;
  centreName: string;
  partnerId: string;
  partnerName: string;
  partnerStatus: string;
  centreStatus: string;
  location: string;
  totalSeats: number;
  operationalSeats: number;
  occupiedSeats: number;
  reservedSeats: number;
  availableSeats: number;
  utilizationPercentage: number;
  capacityStatus: string;
  availableFrom: string; // YYYY-MM-DD
  minimumCommitment: number;
  maximumCommitment: number;
  supportedProcesses: string[];
  supportedChannels: string[];
  supportedLanguages: string[];
  supportedTimezones: string[];
  supportedShifts: string[];
  workingDays: string[];
}

export interface CapacityRequirementCriteria {
  requirementId: number;
  requirementCode: string;
  clientId: string;
  title: string;
  requiredSeats: number;
  processType: string;
  channels: string[];
  languages: string[];
  timezone: string;
  shift: string;
  locationRequirement: string;
  startDate: string; // YYYY-MM-DD
  expectedDurationMonths: number;
  minimumExperienceYears?: number;
  workingDays?: string;
}

export interface MatchEvaluationResult {
  centreId: number;
  centreName: string;
  partnerId: string;
  partnerName: string;
  isEligible: boolean;
  availableSeats: number;
  requiredSeats: number;
  passedCount: number;
  totalCriteria: number;
  compatibilityScore: number; // Informational percentage
  scoreType: "INFORMATIONAL_COMPATIBILITY";
  decisionAuthority: "HUMAN_OPERATIONS";
  automaticSelection: false;
  criteriaResults: MatchingCriteriaResult[];
  disqualificationReasons: string[];
  explanation: string;
  analysisDisclaimer: string;
}

/**
 * Normalizes text for case-insensitive matching.
 */
function norm(val: unknown): string {
  return String(val ?? "").trim().toLowerCase();
}

/**
 * Checks if candidate array contains an item (case-insensitive).
 */
function includesIgnoreCase(arr: string[], target: string): boolean {
  const t = norm(target);
  return arr.some((item) => norm(item) === t || norm(item).includes(t) || t.includes(norm(item)));
}

/**
 * Evaluates a single candidate centre against a capacity requirement using
 * strict, explainable, deterministic server-side rules.
 */
export function evaluateCentreEligibility(
  centre: CandidateCentreProfile,
  req: CapacityRequirementCriteria
): MatchEvaluationResult {
  const criteriaResults: MatchingCriteriaResult[] = [];
  const disqualificationReasons: string[] = [];

  // 1. Centre & Partner Verification Status
  const isVerifiedActive =
    norm(centre.partnerStatus) === "active" &&
    norm(centre.centreStatus) === "active" &&
    norm(centre.capacityStatus) !== "inactive" &&
    norm(centre.capacityStatus) !== "temporarily_unavailable";

  criteriaResults.push({
    criterion: "Verified Active Centre Status",
    passed: isVerifiedActive,
    required: "Active & Verified",
    actual: `${centre.partnerStatus} / ${centre.centreStatus} (${centre.capacityStatus})`,
    detail: isVerifiedActive
      ? "Centre and Partner are actively verified and operational"
      : `Centre verification check failed: Partner is ${centre.partnerStatus}, Centre is ${centre.centreStatus}, Capacity is ${centre.capacityStatus}`,
  });
  if (!isVerifiedActive) {
    disqualificationReasons.push("Centre or Partner is not active/verified in the delivery network");
  }

  // 2. Available Seats Headroom
  const hasEnoughSeats = centre.availableSeats >= req.requiredSeats;
  criteriaResults.push({
    criterion: "Seat Availability Headroom",
    passed: hasEnoughSeats,
    required: req.requiredSeats,
    actual: centre.availableSeats,
    detail: hasEnoughSeats
      ? `Sufficient available capacity: ${centre.availableSeats} available vs ${req.requiredSeats} required`
      : `Insufficient available capacity: only ${centre.availableSeats} available vs ${req.requiredSeats} required`,
  });
  if (!hasEnoughSeats) {
    disqualificationReasons.push(
      `Insufficient available seats (${centre.availableSeats} available vs ${req.requiredSeats} required)`
    );
  }

  // 3. Minimum & Maximum Commitment Window
  const satisfiesMinCommit = req.requiredSeats >= (centre.minimumCommitment || 1);
  const satisfiesMaxCommit = req.requiredSeats <= (centre.maximumCommitment || 99999);
  const commitmentPassed = satisfiesMinCommit && satisfiesMaxCommit;
  criteriaResults.push({
    criterion: "Seat Commitment Range",
    passed: commitmentPassed,
    required: `${centre.minimumCommitment} - ${centre.maximumCommitment} seats`,
    actual: `${req.requiredSeats} seats`,
    detail: commitmentPassed
      ? `Required seats (${req.requiredSeats}) falls within centre commitment policy`
      : `Requirement outside commitment window (Min: ${centre.minimumCommitment}, Max: ${centre.maximumCommitment})`,
  });
  if (!commitmentPassed) {
    disqualificationReasons.push(
      `Requirement seats (${req.requiredSeats}) outside centre commitment range (${centre.minimumCommitment}-${centre.maximumCommitment})`
    );
  }

  // 4. Process Type Support
  const supportsProcess =
    centre.supportedProcesses.length === 0 ||
    includesIgnoreCase(centre.supportedProcesses, req.processType) ||
    includesIgnoreCase(centre.supportedProcesses, "General") ||
    includesIgnoreCase(centre.supportedProcesses, "Customer Support");

  criteriaResults.push({
    criterion: "Supported Process",
    passed: supportsProcess,
    required: req.processType,
    actual: centre.supportedProcesses.join(", ") || "General Support",
    detail: supportsProcess
      ? `Centre supports process domain: ${req.processType}`
      : `Centre does not support requested process domain (${req.processType})`,
  });
  if (!supportsProcess) {
    disqualificationReasons.push(`Process "${req.processType}" is not supported by centre`);
  }

  // 5. Channel Support
  const missingChannels = (req.channels || []).filter(
    (ch) => !includesIgnoreCase(centre.supportedChannels, ch)
  );
  const channelsPassed = missingChannels.length === 0;
  criteriaResults.push({
    criterion: "Supported Communication Channels",
    passed: channelsPassed,
    required: (req.channels || []).join(", "),
    actual: (centre.supportedChannels || []).join(", "),
    detail: channelsPassed
      ? `All required channels supported: ${(req.channels || []).join(", ")}`
      : `Missing required channels: ${missingChannels.join(", ")}`,
  });
  if (!channelsPassed) {
    disqualificationReasons.push(`Channels not supported: ${missingChannels.join(", ")}`);
  }

  // 6. Language Capabilities
  const missingLanguages = (req.languages || []).filter(
    (lang) => !includesIgnoreCase(centre.supportedLanguages, lang)
  );
  const languagesPassed = missingLanguages.length === 0;
  criteriaResults.push({
    criterion: "Supported Languages",
    passed: languagesPassed,
    required: (req.languages || []).join(", "),
    actual: (centre.supportedLanguages || []).join(", "),
    detail: languagesPassed
      ? `All required languages supported: ${(req.languages || []).join(", ")}`
      : `Missing required languages: ${missingLanguages.join(", ")}`,
  });
  if (!languagesPassed) {
    disqualificationReasons.push(`Languages not supported: ${missingLanguages.join(", ")}`);
  }

  // 7. Shift Compatibility
  const supportsShift =
    !req.shift ||
    centre.supportedShifts.length === 0 ||
    includesIgnoreCase(centre.supportedShifts, req.shift) ||
    includesIgnoreCase(centre.supportedShifts, "24/7 Rotational");

  criteriaResults.push({
    criterion: "Operational Shift",
    passed: supportsShift,
    required: req.shift || "Any",
    actual: centre.supportedShifts.join(", ") || "Standard Shifts",
    detail: supportsShift
      ? `Shift capability verified: ${req.shift}`
      : `Centre does not operate during requested shift (${req.shift})`,
  });
  if (!supportsShift) {
    disqualificationReasons.push(`Shift "${req.shift}" is not operated by centre`);
  }

  // 8. Timezone Alignment
  const supportsTimezone =
    !req.timezone ||
    centre.supportedTimezones.length === 0 ||
    includesIgnoreCase(centre.supportedTimezones, req.timezone) ||
    includesIgnoreCase(centre.supportedTimezones, "Global");

  criteriaResults.push({
    criterion: "Timezone Alignment",
    passed: supportsTimezone,
    required: req.timezone || "Any",
    actual: centre.supportedTimezones.join(", ") || "Global Coverage",
    detail: supportsTimezone
      ? `Timezone coverage verified: ${req.timezone}`
      : `Centre operational window does not cover timezone (${req.timezone})`,
  });
  if (!supportsTimezone) {
    disqualificationReasons.push(`Timezone "${req.timezone}" not supported`);
  }

  // 9. Available Start Date Timeline
  const centreAvailDate = centre.availableFrom ? new Date(centre.availableFrom) : new Date(0);
  const reqStartDate = req.startDate ? new Date(req.startDate) : new Date();
  const timelinePassed = centreAvailDate <= reqStartDate;
  criteriaResults.push({
    criterion: "Available Start Date Timeline",
    passed: timelinePassed,
    required: `Available by ${req.startDate}`,
    actual: `Available from ${centre.availableFrom}`,
    detail: timelinePassed
      ? `Centre is available on or before project start date (${centre.availableFrom} <= ${req.startDate})`
      : `Centre capacity is not available in time (Available from ${centre.availableFrom} vs Required ${req.startDate})`,
  });
  if (!timelinePassed) {
    disqualificationReasons.push(
      `Centre capacity not available until ${centre.availableFrom} (requirement starts ${req.startDate})`
    );
  }

  // 10. Location / Geography Requirements
  const locReq = norm(req.locationRequirement);
  const centreLoc = norm(centre.location);
  const locationPassed =
    !locReq ||
    locReq === "any" ||
    locReq === "flexible" ||
    centreLoc.includes(locReq) ||
    locReq.includes(centreLoc);

  criteriaResults.push({
    criterion: "Location & Geography",
    passed: locationPassed,
    required: req.locationRequirement || "Any",
    actual: centre.location || "Global Centre",
    detail: locationPassed
      ? `Geographic requirement satisfied: ${centre.location || "Unrestricted"}`
      : `Centre location (${centre.location}) does not match client geography requirement (${req.locationRequirement})`,
  });
  if (!locationPassed) {
    disqualificationReasons.push(
      `Location mismatch: Centre in ${centre.location}, requirement is ${req.locationRequirement}`
    );
  }

  // 11. Utilization Headroom Check
  const utilizationPassed = centre.utilizationPercentage <= 98.0 && centre.availableSeats > 0;
  criteriaResults.push({
    criterion: "Current Capacity Utilization Headroom",
    passed: utilizationPassed,
    required: "< 98% utilization",
    actual: `${centre.utilizationPercentage}%`,
    detail: utilizationPassed
      ? `Acceptable utilization (${centre.utilizationPercentage}%) with sufficient seat headroom`
      : `Centre near or at 100% saturation (${centre.utilizationPercentage}% utilized)`,
  });
  if (!utilizationPassed) {
    disqualificationReasons.push(`Centre utilization saturated (${centre.utilizationPercentage}%)`);
  }

  // Aggregate Decision
  const passedCount = criteriaResults.filter((c) => c.passed).length;
  const isEligible = disqualificationReasons.length === 0;

  const totalCriteria = criteriaResults.length;
  const compatibilityScore = totalCriteria > 0 ? Math.round((passedCount / totalCriteria) * 100) : 0;

  let explanation = "";
  if (isEligible) {
    explanation = `✓ FULLY ELIGIBLE: Centre meets all ${totalCriteria} deterministic operational criteria with ${centre.availableSeats} available seats.`;
  } else {
    explanation = `✗ NOT ELIGIBLE: Centre failed ${disqualificationReasons.length} criteria: ${disqualificationReasons.join("; ")}.`;
  }

  return {
    centreId: centre.centreId,
    centreName: centre.centreName,
    partnerId: centre.partnerId,
    partnerName: centre.partnerName,
    isEligible,
    availableSeats: centre.availableSeats,
    requiredSeats: req.requiredSeats,
    passedCount,
    totalCriteria,
    compatibilityScore,
    scoreType: "INFORMATIONAL_COMPATIBILITY",
    decisionAuthority: "HUMAN_OPERATIONS",
    automaticSelection: false,
    criteriaResults,
    disqualificationReasons,
    explanation,
    analysisDisclaimer: "Compatibility score is an informational decision-support indicator only. Thinkatic Operations must manually select the BPO centre.",
  };
}

/**
 * Runs deterministic matching across a list of candidate centres for a requirement.
 * Returns sorted list: eligible candidates first (ordered deterministically by availableSeats descending),
 * followed by ineligible candidates with detailed explanations.
 * NO AI-generated ranking or best-centre scores.
 */
export function runDeterministicMatching(
  centres: CandidateCentreProfile[],
  requirement: CapacityRequirementCriteria
): MatchEvaluationResult[] {
  const results = centres.map((centre) => evaluateCentreEligibility(centre, requirement));

  // Deterministic stable sorting:
  // 1. Eligible first (true > false)
  // 2. High available seats first (deterministic headroom)
  // 3. Centre ID ascending as tie-breaker
  return results.sort((a, b) => {
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }
    if (a.isEligible && b.isEligible) {
      if (b.availableSeats !== a.availableSeats) {
        return b.availableSeats - a.availableSeats;
      }
      return a.centreId - b.centreId;
    }
    // For ineligible, sort by highest criteria passed
    if (b.passedCount !== a.passedCount) {
      return b.passedCount - a.passedCount;
    }
    return a.centreId - b.centreId;
  });
}
