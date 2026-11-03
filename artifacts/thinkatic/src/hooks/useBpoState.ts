import { useState, useEffect, useCallback } from "react";

export interface BpoChecklistItem {
  key: string;
  label: string;
  status: string;
  completed: boolean;
}

export interface BpoCentreVerificationSummary {
  id: number | null;
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "RESUBMISSION_REQUIRED";
  officeDetailsStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  officeDetailsComplete: boolean;
  missingOfficeDetails: string[];
  photosStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  photosUploadedCount: number;
  photosRequiredCount: number;
  photosComplete: boolean;
  missingPhotoCategories: string[];
  totalPhotosCount: number;
  videoStatus: "NOT_STARTED" | "RECORDING" | "UPLOADED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  videoRecorded: boolean;
  videoComplete: boolean;
  videoFileName: string | null;
  isApproved: boolean;
  isUnderReview: boolean;
  isRejected: boolean;
  rejectionReason: string | null;
  missingItems: string[];
  checklist: BpoChecklistItem[];
}

export interface BpoApplicationSummary {
  id: number;
  applicationNumber: string;
  status: string;
  currentStage: string;
  centreId?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  rejectionReason?: string | null;
}

export interface NavAction {
  label: string;
  href: string;
  portalLabel?: string;
  portalHref?: string;
}

export interface BpoState {
  authenticated: boolean;
  accountState:
    | "UNAUTHENTICATED"
    | "CLIENT"
    | "BPO_ONBOARDING"
    | "BPO_PENDING"
    | "BPO_APPROVED"
    | "BPO_ACTIVE"
    | "BPO_REJECTED"
    | "BPO_SUSPENDED"
    | "ADMIN";
  hasBpoApplication: boolean;
  canEnterPortal: boolean;
  application: BpoApplicationSummary | null;
  centreVerification: BpoCentreVerificationSummary | null;
  navAction: NavAction;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_STATE: BpoState = {
  authenticated: false,
  accountState: "UNAUTHENTICATED",
  hasBpoApplication: false,
  canEnterPortal: false,
  application: null,
  centreVerification: null,
  navAction: {
    label: "Become a BPO Partner",
    href: "/partner/apply",
  },
  isLoading: true,
  refetch: async () => {},
};

export function useBpoState(): BpoState {
  const [state, setState] = useState<BpoState>(DEFAULT_STATE);

  const fetchStatus = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;
    const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

    if (!token && !adminToken) {
      setState({
        ...DEFAULT_STATE,
        isLoading: false,
        refetch: fetchStatus,
      });
      return;
    }

    try {
      const headers: Record<string, string> = {};
      let url = "/api/bpo/status";

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else if (adminToken) {
        url += `?admin_token=${encodeURIComponent(adminToken)}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setState({
          authenticated: Boolean(data.authenticated),
          accountState: data.accountState || "UNAUTHENTICATED",
          hasBpoApplication: Boolean(data.hasBpoApplication),
          canEnterPortal: Boolean(data.canEnterPortal),
          application: data.application || null,
          centreVerification: data.centreVerification || null,
          navAction: data.navAction || {
            label: "Become a BPO Partner",
            href: "/partner/apply",
          },
          isLoading: false,
          refetch: fetchStatus,
        });
      } else {
        setState({
          ...DEFAULT_STATE,
          isLoading: false,
          refetch: fetchStatus,
        });
      }
    } catch {
      setState({
        ...DEFAULT_STATE,
        isLoading: false,
        refetch: fetchStatus,
      });
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Listen for storage changes across tabs or login/logout events
    function handleStorageChange(e: StorageEvent) {
      if (e.key === "user_token" || e.key === "admin_token") {
        fetchStatus();
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchStatus]);

  return state;
}
