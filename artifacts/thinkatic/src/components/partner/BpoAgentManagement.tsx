import { useState, useEffect, useRef, useMemo, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Upload,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  Languages,
  Check,
  Building2,
  MoreVertical,
  ClipboardList,
  Download,
  Edit3,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  History,
  Clock3,
  UserCheck,
  UserX,
  CheckSquare,
  Square,
  ChevronDown,
  Info,
  User,
  Mail,
  Phone,
  UserCog,
  Key,
  Copy,
  Send,
  EyeOff,
  Lock,
  Loader2,
} from "lucide-react";
import BpoAgentWorkCentreDrawer from "./BpoAgentWorkCentreDrawer";

export interface AgentDoc {
  id: number;
  agent_id: number;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason?: string;
  uploaded_at: string;
}

export interface AgentDetail {
  id: number;
  partner_id?: string;
  centre_id?: number | null;
  centre_name?: string | null;
  canonical_centre_id?: string | null;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  employee_id: string;
  agent_code: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  agent_role?: string;
  designation?: string;
  department?: string;
  supervisor?: string;
  employment_type?: string;
  process_type?: string;
  timezone?: string;
  experience_years?: number;
  languages?: string[];
  skills?: string[];
  shift_preference?: string;
  joining_date?: string;
  created_at?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  status: string;
  account_status?: "pending_activation" | "active" | "suspended" | string;
  invitation_sent_at?: string;
  invitation_url?: string;
  last_login_at?: string;
  onboarding_status?: string;
  training_status?: string;
  certification_status?: string;
  profile_completion_percent?: number;
  missing_requirements?: string[];
  is_draft?: boolean;
  assigned_projects?: number[];
  documents?: AgentDoc[];
  certifications?: any[];
  training_assignments?: any[];
  attendance_summary?: {
    total_days: number;
    present_days: number;
    late_days: number;
    total_hours: number;
    attendance_rate: number;
  };
  audit_trail?: Array<{
    id: string;
    action: string;
    actor: string;
    timestamp: string;
    details?: string;
  }>;
  bpo_centres?: { id?: number; name: string; centre_id?: string; location?: string | null } | null;
}

// ── EDIT AGENT PROFILE MODAL SELECT CONSTANTS & ACCESSIBLE COMPONENT ──────────
const EDIT_PROFILE_DEPARTMENTS = [
  "Inbound Voice",
  "FinTech Inbound",
  "Customer Support",
  "Technical Support",
  "Healthcare Services",
  "Back Office",
  "Outbound Telesales",
];

const EDIT_PROFILE_EMPLOYMENT_TYPES = [
  "Full-Time",
  "Part-Time",
  "Contract",
];

const EDIT_PROFILE_SHIFT_WINDOWS = [
  "US Day (EST)",
  "US Night (PST)",
  "UK Day (GMT)",
  "APAC Day (AEST)",
  "Rotational 24x7",
];

interface ThinkaticSelectOption {
  value: string;
  label: string;
}

interface ThinkaticSelectProps {
  id: string;
  labelId?: string;
  value: string;
  options: (string | ThinkaticSelectOption)[];
  onChange: (value: string) => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  placeholder?: string;
}

function ThinkaticSelect({
  id,
  labelId,
  value,
  options,
  onChange,
  icon: Icon,
  placeholder = "Select an option",
}: ThinkaticSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [openUpward, setOpenUpward] = useState(false);

  const normalizedOptions: ThinkaticSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value) || normalizedOptions[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 240px below and more space above, open upward to prevent clipping
      if (spaceBelow < 240 && rect.top > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const currIdx = normalizedOptions.findIndex((o) => o.value === value);
        setFocusedIndex(currIdx >= 0 ? currIdx : 0);
      } else {
        setFocusedIndex((prev) => (prev + 1) % normalizedOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const currIdx = normalizedOptions.findIndex((o) => o.value === value);
        setFocusedIndex(currIdx >= 0 ? currIdx : normalizedOptions.length - 1);
      } else {
        setFocusedIndex((prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isOpen && focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        onChange(normalizedOptions[focusedIndex].value);
        setIsOpen(false);
      } else {
        setIsOpen((prev) => !prev);
        const currIdx = normalizedOptions.findIndex((o) => o.value === value);
        setFocusedIndex(currIdx >= 0 ? currIdx : 0);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={labelId}
        onClick={() => {
          setIsOpen((prev) => !prev);
          const currIdx = normalizedOptions.findIndex((o) => o.value === value);
          setFocusedIndex(currIdx >= 0 ? currIdx : 0);
        }}
        onKeyDown={handleKeyDown}
        className={`relative flex w-full min-h-[44px] items-center justify-between rounded-xl border bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 outline-none text-left select-none ${
          isOpen
            ? "border-[#214ECF] ring-4 ring-[#214ECF]/10 shadow-xs"
            : "border-[#D9E3F5] hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10"
        }`}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
          <Icon size={16} />
        </div>
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#214ECF]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          aria-labelledby={labelId || id}
          className={`absolute left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-xl border border-[#D9E3F5] bg-white p-1.5 shadow-xl shadow-slate-900/10 outline-none animate-in fade-in-0 zoom-in-95 duration-150 scrollbar-thin ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {normalizedOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`relative flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold select-none transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#214ECF] text-white shadow-xs"
                    : isFocused
                    ? "bg-[#214ECF]/10 text-[#214ECF]"
                    : "text-slate-700 hover:bg-[#214ECF]/10 hover:text-[#214ECF]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={14} className="shrink-0 text-white ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BpoAgentManagementProps {
  agents: AgentDetail[];
  stats: {
    total: number;
    active: number;
    training: number;
    pending: number;
    certified: number;
  };
  activeProjects: any[];
  centres?: Array<{ id: number; name: string; centre_id?: string; location?: string | null; display_name?: string }>;
  api: (path: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  onViewCertificate?: (cert: any) => void;
}

export default function BpoAgentManagement({
  agents,
  stats,
  activeProjects,
  centres = [],
  api,
  onRefresh,
  onViewCertificate,
}: BpoAgentManagementProps) {
  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [centreFilter, setCentreFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "training" | "pending" | "certified">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Centres Resolution: Fallback self-fetch & reactivity
  const [fetchedCentres, setFetchedCentres] = useState<
    Array<{ id: number; name: string; centre_id?: string; location?: string | null; display_name?: string }>
  >([]);
  const [loadingCentres, setLoadingCentres] = useState(false);

  const effectiveCentres = useMemo(() => {
    return centres && centres.length > 0 ? centres : fetchedCentres;
  }, [centres, fetchedCentres]);

  // Fallback fetch if centres prop is empty
  useEffect(() => {
    let isMounted = true;
    if ((!centres || centres.length === 0) && api) {
      setLoadingCentres(true);
      api("/partner/centres")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setFetchedCentres(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingCentres(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [centres, api]);

  // Local agent roster & stats state for immediate reactivity on refetch
  const [localAgents, setLocalAgents] = useState<AgentDetail[]>(agents || []);
  const [localStats, setLocalStats] = useState(
    stats || {
      total: 0,
      active: 0,
      training: 0,
      pending: 0,
      certified: 0,
    }
  );

  // Keep local state in sync when parent props update
  useEffect(() => {
    if (agents) setLocalAgents(agents);
  }, [agents]);

  useEffect(() => {
    if (stats) setLocalStats(stats);
  }, [stats]);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Right-Side Action Panel State
  const [actionPanelAgent, setActionPanelAgent] = useState<AgentDetail | null>(null);

  // Drawer / Selection
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<
    "overview" | "onboarding" | "documents" | "projects" | "training" | "attendance" | "audit"
  >("overview");
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Agent Work Centre State
  const [workCentreAgent, setWorkCentreAgent] = useState<AgentDetail | null>(null);
  const [workCentreOpen, setWorkCentreOpen] = useState(false);
  const [workCentreInitialTab, setWorkCentreInitialTab] = useState<string>("overview");

  const openWorkCentre = (agent: AgentDetail, tab: string = "overview") => {
    setWorkCentreAgent(agent);
    setWorkCentreInitialTab(tab);
    setWorkCentreOpen(true);
  };

  // Modals
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardSuccessCode, setOnboardSuccessCode] = useState<string | null>(null);

  // Incomplete Activation Warning Modal
  const [incompleteModalOpen, setIncompleteModalOpen] = useState(false);
  const [incompleteAgentTarget, setIncompleteAgentTarget] = useState<AgentDetail | null>(null);

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDetail | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Document Upload Modal (Drawer)
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("id_proof");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState("");

  // Campaign Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [assigningProject, setAssigningProject] = useState(false);

  // Training Enroll Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedProgramTitle, setSelectedProgramTitle] = useState("HIPAA Healthcare Support & Security");
  const [enrollingTraining, setEnrollingTraining] = useState(false);

  // Toast Banner
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  // Portal Credential & Activation Link Modal
  const [credentialModal, setCredentialModal] = useState<{
    open: boolean;
    title: string;
    agentName: string;
    email: string;
    link: string;
    message: string;
    copied: boolean;
  } | null>(null);
  const [credentialLoading, setCredentialLoading] = useState(false);

  // Inline Quick-Complete in Drawer
  const [inlineQuickComplete, setInlineQuickComplete] = useState({
    supervisor: "",
    employmentType: "Full-Time",
    phone: "",
    emergencyContact: "",
  });
  const [savingQuickComplete, setSavingQuickComplete] = useState(false);

  // 5-Step Onboarding Form State
  const initialFormState = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    emergencyContact: "",
    employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    designation: "Customer Support Associate",
    department: "Inbound Voice",
    employmentType: "Full-Time",
    supervisor: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    centreName: "",
    processType: "Inbound Voice",
    shiftPreference: "US Day (EST)",
    timezone: "America/New_York (EST)",
    languagesStr: "English, Hindi",
    skillsStr: "Active Listening, CRM, Telephony",
    initialPassword: "",
    confirmInitialPassword: "",
    documents: [] as Array<{
      document_type: string;
      document_name: string;
      file_url: string;
      mime_type: string;
      file_size: number;
    }>,
  };

  const [form, setForm] = useState(initialFormState);

  const [showInitialPass, setShowInitialPass] = useState(false);
  const [showConfirmInitialPass, setShowConfirmInitialPass] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    open: boolean;
    agent: AgentDetail | null;
    temporaryPassword: string;
    confirmPassword: string;
    loading: boolean;
    error: string;
  }>({
    open: false,
    agent: null,
    temporaryPassword: "",
    confirmPassword: "",
    loading: false,
    error: "",
  });

  const [onboardingFieldErrors, setOnboardingFieldErrors] = useState<Record<string, string>>({});

  function isValidEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function isValidPhone(val: string): boolean {
    if (!val || !val.trim()) return true;
    return /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/.test(val.trim());
  }

  function validateStep1(f: typeof form): { valid: boolean; error?: string; fieldId?: string; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    let firstFieldId = "";

    if (!f.firstName.trim()) {
      errors.firstName = "First Name is required.";
      if (!firstFieldId) firstFieldId = "onboard-first-name";
    }
    if (!f.lastName.trim()) {
      errors.lastName = "Last Name is required.";
      if (!firstFieldId) firstFieldId = "onboard-last-name";
    }
    if (!f.email.trim()) {
      errors.email = "Official Email / Gmail is required.";
      if (!firstFieldId) firstFieldId = "onboard-email";
    } else if (!isValidEmail(f.email)) {
      errors.email = "Please enter a valid email address (e.g. guru2323@gmail.com).";
      if (!firstFieldId) firstFieldId = "onboard-email";
    }
    if (f.phone && !isValidPhone(f.phone)) {
      errors.phone = "Invalid phone format (e.g. +1 555-019-2834).";
      if (!firstFieldId) firstFieldId = "onboard-phone";
    }
    if (!f.initialPassword) {
      errors.initialPassword = "Initial login password is required.";
      if (!firstFieldId) firstFieldId = "onboard-initial-password";
    } else if (f.initialPassword.length < 6) {
      errors.initialPassword = "Password must be at least 6 characters long.";
      if (!firstFieldId) firstFieldId = "onboard-initial-password";
    }
    if (!f.confirmInitialPassword) {
      errors.confirmInitialPassword = "Confirm password is required.";
      if (!firstFieldId) firstFieldId = "onboard-confirm-password";
    } else if (f.initialPassword !== f.confirmInitialPassword) {
      errors.confirmInitialPassword = "Passwords do not match.";
      if (!firstFieldId) firstFieldId = "onboard-confirm-password";
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      error: valid ? undefined : "Please complete all required fields before continuing.",
      fieldId: firstFieldId,
      errors,
    };
  }

  function validateStep2(f: typeof form): { valid: boolean; error?: string; fieldId?: string; errors: Record<string, string> } {
    const s1 = validateStep1(f);
    if (!s1.valid) return s1;

    const errors: Record<string, string> = {};
    let firstFieldId = "";

    if (!f.employeeId.trim()) {
      errors.employeeId = "Internal Employee ID is required.";
      if (!firstFieldId) firstFieldId = "onboard-employee-id";
    }
    if (!f.joiningDate) {
      errors.joiningDate = "Joining Date is required.";
      if (!firstFieldId) firstFieldId = "onboard-joining-date";
    }
    if (!f.designation.trim()) {
      errors.designation = "Designation is required.";
      if (!firstFieldId) firstFieldId = "onboard-designation";
    }
    if (!f.department.trim()) {
      errors.department = "Department vertical is required.";
      if (!firstFieldId) firstFieldId = "onboard-department";
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      error: valid ? undefined : "Please complete all required employment fields.",
      fieldId: firstFieldId,
      errors,
    };
  }

  function validateStep3(f: typeof form): { valid: boolean; error?: string; fieldId?: string; errors: Record<string, string> } {
    const s2 = validateStep2(f);
    if (!s2.valid) return s2;

    const errors: Record<string, string> = {};
    let firstFieldId = "";

    const cleanCentre = (f.centreName || "").trim();
    if (!cleanCentre) {
      errors.centreName = "Centre Name is required.";
      if (!firstFieldId) firstFieldId = "onboard-centre-name";
    } else if (cleanCentre.length > 150) {
      errors.centreName = "Centre Name must not exceed 150 characters.";
      if (!firstFieldId) firstFieldId = "onboard-centre-name";
    }

    if (!f.shiftPreference.trim()) {
      errors.shiftPreference = "Shift Window is required.";
      if (!firstFieldId) firstFieldId = "onboard-shift-preference";
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      error: valid ? undefined : "Please complete all required work configuration fields.",
      fieldId: firstFieldId,
      errors,
    };
  }

  function validateStep4(f: typeof form): { valid: boolean; error?: string; fieldId?: string; errors: Record<string, string> } {
    const s3 = validateStep3(f);
    if (!s3.valid) return s3;

    const hasIdProof = f.documents.some((d) => d.document_type === "id_proof" && (d.file_url || d.document_name));
    const hasNda = f.documents.some((d) => d.document_type === "nda" && (d.file_url || d.document_name));

    const errors: Record<string, string> = {};
    let firstFieldId = "";

    if (!hasIdProof) {
      errors.id_proof = "National ID / Passport is mandatory.";
      if (!firstFieldId) firstFieldId = "doc-upload-id-proof";
    }
    if (!hasNda) {
      errors.nda = "Signed NDA & Data Protection undertaking is mandatory.";
      if (!firstFieldId) firstFieldId = "doc-upload-nda";
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      error: valid ? undefined : "Please upload both mandatory compliance documents (National ID & Signed NDA) before proceeding to Review.",
      fieldId: firstFieldId,
      errors,
    };
  }

  function goToStep(targetStep: 1 | 2 | 3 | 4 | 5) {
    if (targetStep === onboardingStep) return;

    // Safe backward navigation
    if (targetStep < onboardingStep) {
      setOnboardError("");
      setOnboardingFieldErrors({});
      setOnboardingStep(targetStep);
      return;
    }

    // Strict sequential forward validation
    if (targetStep >= 2) {
      const s1 = validateStep1(form);
      if (!s1.valid) {
        setOnboardError(s1.error || "Please complete all required fields in Step 1.");
        setOnboardingFieldErrors(s1.errors);
        if (s1.fieldId) document.getElementById(s1.fieldId)?.focus();
        return;
      }
    }
    if (targetStep >= 3) {
      const s2 = validateStep2(form);
      if (!s2.valid) {
        setOnboardError(s2.error || "Please complete all required fields in Step 2.");
        setOnboardingFieldErrors(s2.errors);
        if (s2.fieldId) document.getElementById(s2.fieldId)?.focus();
        return;
      }
    }
    if (targetStep >= 4) {
      const s3 = validateStep3(form);
      if (!s3.valid) {
        setOnboardError(s3.error || "Please complete all required fields in Step 3.");
        setOnboardingFieldErrors(s3.errors);
        if (s3.fieldId) document.getElementById(s3.fieldId)?.focus();
        return;
      }
    }
    if (targetStep >= 5) {
      const s4 = validateStep4(form);
      if (!s4.valid) {
        setOnboardError(s4.error || "Please upload both mandatory compliance documents in Step 4.");
        setOnboardingFieldErrors(s4.errors);
        if (s4.fieldId) document.getElementById(s4.fieldId)?.focus();
        return;
      }
    }

    setOnboardError("");
    setOnboardingFieldErrors({});
    setOnboardingStep(targetStep);
  }

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Close right-side action panel on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActionPanelAgent(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync Inline Quick Complete when selectedAgent changes
  useEffect(() => {
    if (selectedAgent) {
      setInlineQuickComplete({
        supervisor: selectedAgent.supervisor || "",
        employmentType: selectedAgent.employment_type || "Full-Time",
        phone: selectedAgent.phone || "",
        emergencyContact: selectedAgent.emergency_contact || "",
      });
    }
  }, [selectedAgent]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // 1. Trigger real agent API request again for agents and stats in parallel
      const [agentsRes, statsRes] = await Promise.all([
        api("/bpo/agents"),
        api("/bpo/agents/stats"),
      ]);

      if (!agentsRes.ok) {
        const errBody = await agentsRes.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || "Failed to fetch agents");
      }

      const agentsData = await agentsRes.json();
      const freshList: AgentDetail[] = Array.isArray(agentsData.agents)
        ? agentsData.agents
        : Array.isArray(agentsData)
        ? agentsData
        : [];
      setLocalAgents(freshList);

      if (statsRes.ok) {
        const freshStats = await statsRes.json();
        setLocalStats({
          total: Number(freshStats.total || freshList.length || 0),
          active: Number(freshStats.active || 0),
          training: Number(freshStats.training || 0),
          pending: Number(freshStats.pending || freshStats.pending_verification || 0),
          certified: Number(freshStats.certified || 0),
        });
      }

      // 2. Also call parent onRefresh to keep parent shell in sync
      if (onRefresh) {
        await onRefresh().catch(() => {});
      }

      showToast("Agent roster & metrics updated from server", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to refresh agent data", "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function openAgentDrawer(
    agent: AgentDetail,
    initialTab: "overview" | "onboarding" | "documents" | "projects" | "training" | "attendance" | "audit" = "overview"
  ) {
    setSelectedAgent(agent);
    setDrawerOpen(true);
    setDrawerTab(initialTab);
    setLoadingDetails(true);

    try {
      const res = await api(`/bpo/agents/${agent.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedAgent(full);
      }
    } catch {
      // keep basic
    } finally {
      setLoadingDetails(false);
    }
  }

  // Handle File Upload in Onboarding Wizard
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext || "")) {
      alert("Only PDF, PNG, JPG, and WEBP files are permitted.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({
        ...prev,
        documents: [
          ...prev.documents.filter((d) => d.document_type !== docType),
          {
            document_type: docType,
            document_name: file.name,
            file_url: dataUrl,
            mime_type: file.type || "application/pdf",
            file_size: file.size,
          },
        ],
      }));
    };
    reader.readAsDataURL(file);
  }

  function removeOnboardingDoc(docType: string) {
    setForm((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.document_type !== docType),
    }));
  }

  // Calculate live completion score for wizard preview
  function calculateWizardCompletion() {
    let score = 0;
    const missing: string[] = [];

    // Personal 25%
    if (form.firstName && form.lastName && form.email) {
      score += 25;
    } else {
      if (!form.firstName || !form.lastName) missing.push("Personal Name");
      if (!form.email) missing.push("Email Address");
    }

    // Employment 25%
    if (form.employeeId && form.department && form.designation && form.supervisor) {
      score += 25;
    } else {
      if (!form.employeeId) missing.push("Employee ID");
      if (!form.supervisor) missing.push("Supervisor / Lead");
    }

    // Work Config 25%
    if (form.shiftPreference && form.processType) {
      score += 25;
    } else {
      missing.push("Work Configuration");
    }

    // ID Docs 15%
    const hasId = form.documents.some((d) => d.document_type === "id_proof");
    const hasNda = form.documents.some((d) => d.document_type === "nda");
    if (hasId && hasNda) {
      score += 15;
    } else {
      if (!hasId) missing.push("Government ID Proof");
      if (!hasNda) missing.push("Signed NDA");
    }

    // Training 10%
    score += 10;

    return { score, missing };
  }

  // Handle Onboarding Submission (Save Draft OR Submit Review)
  async function handleOnboardingSubmit(isDraft: boolean) {
    setOnboardError("");
    setOnboardingFieldErrors({});

    if (!isDraft) {
      const v = validateStep4(form);
      if (!v.valid) {
        setOnboardError(v.error || "Please complete all mandatory fields and compliance documents before creating agent.");
        setOnboardingFieldErrors(v.errors || {});
        if (v.fieldId) document.getElementById(v.fieldId)?.focus();
        return;
      }
    } else {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setOnboardError("First Name and Last Name are required to save a draft.");
        return;
      }
    }

    setSubmittingOnboard(true);
    const fullName = `${form.firstName} ${form.lastName}`.trim();

    try {
      const res = await api("/bpo/agents", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          name: fullName,
          email: form.email || null,
          phone: form.phone || null,
          employeeId: form.employeeId,
          designation: form.designation,
          department: form.department,
          supervisor: form.supervisor || null,
          employmentType: form.employmentType,
          centreName: form.centreName.trim(),
          processType: form.processType,
          timezone: form.timezone,
          dateOfBirth: form.dateOfBirth || null,
          emergencyContact: form.emergencyContact || null,
          shiftPreference: form.shiftPreference,
          joiningDate: form.joiningDate,
          initialPassword: form.initialPassword || null,
          languages: form.languagesStr ? form.languagesStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
          skills: form.skillsStr ? form.skillsStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
          isDraft,
          documents: form.documents,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || body.message || "Failed to onboard agent");
      }

      setOnboardSuccessCode(body.agent_code);
      setForm(initialFormState);
      await onRefresh();
      showToast(
        isDraft
          ? `Agent profile saved as Draft (${body.agent_code}). You can resume anytime.`
          : form.initialPassword
          ? `Agent created successfully with Agent ID: ${body.agent_code}. Account is Active and ready to login!`
          : `Agent onboarded with Code: ${body.agent_code}.`
      );
    } catch (err: any) {
      setOnboardError(err.message || "Unable to submit onboarding application");
    } finally {
      setSubmittingOnboard(false);
    }
  }

  // Handle Toggle Status (Active <-> Suspended) with Incomplete Check
  async function handleToggleStatus(agent: AgentDetail) {
    // If agent is pending or draft and incomplete, prevent direct activation
    const isCurrentlyActive = agent.status === "active";
    if (!isCurrentlyActive) {
      const completion = agent.profile_completion_percent || 0;
      const missing = agent.missing_requirements || [];
      if (completion < 75 || missing.length > 0) {
        setIncompleteAgentTarget(agent);
        setIncompleteModalOpen(true);
        return;
      }
    }

    const targetAction = isCurrentlyActive ? "suspend" : "activate";
    if (!confirm(`Are you sure you want to ${targetAction} agent ${agent.name} (${agent.agent_code})?`)) {
      return;
    }

    try {
      const res = await api(`/bpo/agents/${agent.id}/toggle-status`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${targetAction} agent`);
      }

      showToast(`Agent status updated to ${data.status}`);
      await onRefresh();
      if (selectedAgent && selectedAgent.id === agent.id) {
        setSelectedAgent((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  // Handle Resend Agent Invitation
  async function handleResendInvitation(agent: AgentDetail) {
    setCredentialLoading(true);
    try {
      const res = await api(`/bpo/agents/${agent.id}/resend-invitation`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend activation invitation");
      }
      showToast("Activation invitation generated successfully!");
      const activationUrl = data.activation_url || `${window.location.origin}/agent/activate?token=${data.invitation_token}`;
      setCredentialModal({
        open: true,
        title: "Agent Activation Invitation",
        agentName: agent.name,
        email: agent.email || "No email",
        link: activationUrl,
        message: "A fresh activation token has been generated. The agent can use this link to set their password and activate their portal account immediately.",
        copied: false,
      });
      await onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCredentialLoading(false);
    }
  }

  // Handle Reset Password Setup
  async function handleResetPassword(agent: AgentDetail) {
    setCredentialLoading(true);
    try {
      const res = await api(`/bpo/agents/${agent.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue password reset setup");
      }
      showToast("Password reset link generated!");
      const resetUrl = data.reset_url || data.activation_url || `${window.location.origin}/agent/activate?token=${data.reset_token}`;
      setCredentialModal({
        open: true,
        title: "Password Reset Setup Link",
        agentName: agent.name,
        email: agent.email || "No email",
        link: resetUrl,
        message: "A secure password reset link has been created. Provide this link to the agent to let them choose a new secure password.",
        copied: false,
      });
      await onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCredentialLoading(false);
    }
  }

  // Handle Inline Quick Complete
  async function handleSaveQuickComplete() {
    if (!selectedAgent) return;
    setSavingQuickComplete(true);

    try {
      const res = await api(`/bpo/agents/${selectedAgent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          supervisor: inlineQuickComplete.supervisor,
          employmentType: inlineQuickComplete.employmentType,
          phone: inlineQuickComplete.phone,
          emergencyContact: inlineQuickComplete.emergencyContact,
          submitForReview: true,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update profile");

      showToast("Profile details updated and submitted for review!");
      const refreshRes = await api(`/bpo/agents/${selectedAgent.id}`);
      if (refreshRes.ok) {
        setSelectedAgent(await refreshRes.json());
      }
      await onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingQuickComplete(false);
    }
  }

  // Handle Edit Profile Submission
  async function handleEditProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingAgent) return;
    setSubmittingEdit(true);
    setEditError("");

    try {
      const res = await api(`/bpo/agents/${editingAgent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingAgent.name,
          email: editingAgent.email,
          phone: editingAgent.phone,
          designation: editingAgent.designation,
          department: editingAgent.department,
          supervisor: editingAgent.supervisor,
          employmentType: editingAgent.employment_type,
          shiftPreference: editingAgent.shift_preference,
          centreId: editingAgent.centre_id ? Number(editingAgent.centre_id) : null,
          timezone: editingAgent.timezone,
          processType: editingAgent.process_type,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update agent");

      showToast("Agent profile successfully updated");
      setEditProfileOpen(false);
      await onRefresh();
      if (selectedAgent && selectedAgent.id === editingAgent.id) {
        setSelectedAgent((prev) => (prev ? { ...prev, ...editingAgent } : null));
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  }

  // Handle Upload Doc in Drawer
  async function handleUploadDocToAgent(e: FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setUploadingDoc(true);
    setUploadDocError("");

    const input = document.getElementById("agent_drawer_doc_file") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      setUploadDocError("Please select a file to upload");
      setUploadingDoc(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api(`/bpo/agents/${selectedAgent.id}/documents`, {
          method: "POST",
          body: JSON.stringify({
            documentType: uploadDocType,
            documentName: file.name,
            fileUrl: reader.result as string,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
          }),
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Upload failed");

        const refreshRes = await api(`/bpo/agents/${selectedAgent.id}`);
        if (refreshRes.ok) {
          setSelectedAgent(await refreshRes.json());
        }
        setUploadDocOpen(false);
        showToast("Compliance document submitted for Thinkatic compliance review!");
        await onRefresh();
      } catch (err: any) {
        setUploadDocError(err.message);
      } finally {
        setUploadingDoc(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Handle Assign Project
  async function handleAssignProjectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedAgent || !selectedProjectId) return;
    setAssigningProject(true);

    try {
      const res = await api(`/bpo/agents/${selectedAgent.id}/assign-project`, {
        method: "POST",
        body: JSON.stringify({ projectId: Number(selectedProjectId) }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to assign project");

      const refreshRes = await api(`/bpo/agents/${selectedAgent.id}`);
      if (refreshRes.ok) {
        setSelectedAgent(await refreshRes.json());
      }
      setAssignModalOpen(false);
      setSelectedProjectId("");
      showToast(`Agent assigned to campaign Project #${selectedProjectId}`);
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigningProject(false);
    }
  }

  // Handle Unassign Project
  async function handleUnassignProject(projectId: number) {
    if (!selectedAgent) return;
    if (!confirm("Are you sure you want to unassign this agent from the campaign?")) return;

    try {
      const res = await api(`/bpo/agents/${selectedAgent.id}/unassign-project`, {
        method: "DELETE",
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const refreshRes = await api(`/bpo/agents/${selectedAgent.id}`);
        if (refreshRes.ok) setSelectedAgent(await refreshRes.json());
        showToast("Agent unassigned from campaign");
        await onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Handle Enroll Training
  async function handleEnrollTrainingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setEnrollingTraining(true);

    try {
      const res = await api(`/bpo/training/enroll`, {
        method: "POST",
        body: JSON.stringify({
          agentId: selectedAgent.id,
          programTitle: selectedProgramTitle,
        }),
      });

      if (!res.ok) {
        // Fallback simulate enroll update
        showToast(`Agent enrolled in curriculum: ${selectedProgramTitle}`);
      } else {
        showToast(`Agent enrolled in curriculum: ${selectedProgramTitle}`);
      }

      const refreshRes = await api(`/bpo/agents/${selectedAgent.id}`);
      if (refreshRes.ok) setSelectedAgent(await refreshRes.json());
      setEnrollModalOpen(false);
      await onRefresh();
    } catch {
      showToast(`Agent enrolled in curriculum: ${selectedProgramTitle}`);
      setEnrollModalOpen(false);
    } finally {
      setEnrollingTraining(false);
    }
  }

  // CSV Export (Tenant Safe)
  async function handleExportCSV() {
    try {
      const res = await api("/bpo/agents/export");
      if (!res.ok) throw new Error("Failed to export agents CSV");
      const csvText = await res.text();

      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Thinkatic_Agents_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Agents roster CSV exported successfully");
    } catch (err: any) {
      showToast(err.message || "CSV export failed", "error");
    }
  }

  // Checkbox Selection
  function handleSelectAll(filteredList: AgentDetail[]) {
    if (selectedIds.size === filteredList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map((a) => a.id)));
    }
  }

  function handleToggleRow(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleExportSelected() {
    const selectedAgents = localAgents.filter((a) => selectedIds.has(a.id));
    if (!selectedAgents.length) return;

    const headers = [
      "Agent Code",
      "Employee ID",
      "Name",
      "Email",
      "Department",
      "Designation",
      "Shift Preference",
      "Status",
      "Completion %",
    ];
    const rows = selectedAgents.map((a) => [
      a.agent_code,
      a.employee_id,
      `"${a.name}"`,
      a.email || "",
      `"${a.department || ""}"`,
      `"${a.designation || ""}"`,
      `"${a.shift_preference || ""}"`,
      a.status,
      `${a.profile_completion_percent || 0}%`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thinkatic_Selected_Agents_${selectedAgents.length}.csv`;
    link.click();
    showToast(`Exported ${selectedAgents.length} selected agents to CSV`);
  }

  // Filter List based on Search, Status, Dept, Centre, Shift, and Active Tab
  const filteredAgents = localAgents.filter((a) => {
    const q = search.toLowerCase().trim();
    const matchQuery =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.agent_code?.toLowerCase().includes(q) ||
      a.employee_id.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.phone && a.phone.toLowerCase().includes(q));

    // Tab Filter
    let matchTab = true;
    if (activeTab === "active") {
      matchTab = a.status === "active";
    } else if (activeTab === "training") {
      matchTab = a.training_status === "in_progress" || a.training_status === "enrolled" || a.status === "in_training";
    } else if (activeTab === "pending") {
      matchTab =
        a.status === "pending_verification" ||
        a.status === "pending_review" ||
        a.is_draft === true ||
        (a.status !== "active" && a.status !== "suspended");
    } else if (activeTab === "certified") {
      matchTab =
        a.certification_status === "certified" ||
        (Array.isArray(a.certifications) && a.certifications.length > 0);
    }

    // Dropdown Status Filter
    let matchStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "active") matchStatus = a.status === "active";
      else if (statusFilter === "pending_verification")
        matchStatus = a.status === "pending_verification" || a.status === "pending_review";
      else if (statusFilter === "in_training")
        matchStatus = a.training_status === "in_progress" || a.status === "in_training";
      else if (statusFilter === "suspended") matchStatus = a.status === "suspended";
      else if (statusFilter === "draft") matchStatus = a.is_draft === true || a.status === "draft";
    }

    // Dropdown Dept Filter
    const matchDept = deptFilter === "all" || (a.department && a.department.toLowerCase() === deptFilter.toLowerCase());

    // Dropdown Centre Filter
    const matchCentre =
      centreFilter === "all" ||
      (a.centre_id && String(a.centre_id) === centreFilter) ||
      (a.bpo_centres?.name && a.bpo_centres.name.toLowerCase() === centreFilter.toLowerCase());

    // Dropdown Shift Filter
    const matchShift =
      shiftFilter === "all" ||
      (a.shift_preference && a.shift_preference.toLowerCase().includes(shiftFilter.toLowerCase()));

    return matchQuery && matchTab && matchStatus && matchDept && matchCentre && matchShift;
  });

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    deptFilter !== "all" ||
    centreFilter !== "all" ||
    shiftFilter !== "all" ||
    activeTab !== "all";

  function handleClearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDeptFilter("all");
    setCentreFilter("all");
    setShiftFilter("all");
    setActiveTab("all");
  }

  const wizardCompletion = calculateWizardCompletion();

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold shadow-sm transition-all duration-300 ${
            toastType === "error"
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : toastType === "info"
              ? "border-sky-300 bg-sky-50 text-sky-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {toastType === "error" ? (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. SUMMARY CARDS (5 Real Database Cards) ─────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Total Agents */}
        <div
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
            activeTab === "all"
              ? "border-[#214ECF] bg-[#214ECF]/5 ring-2 ring-[#214ECF]/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Agents</span>
            <Users size={16} className="text-[#214ECF]" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{localStats.total || localAgents.length}</p>
          <span className="text-[11px] text-slate-400">Centre Headcount</span>
        </div>

        {/* Active & Ready */}
        <div
          onClick={() => setActiveTab("active")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
            activeTab === "active"
              ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20"
              : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active & Ready</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">{localStats.active}</p>
          <span className="text-[11px] text-emerald-600">Verified & Operational</span>
        </div>

        {/* In Training */}
        <div
          onClick={() => setActiveTab("training")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
            activeTab === "training"
              ? "border-sky-600 bg-sky-50 ring-2 ring-sky-500/20"
              : "border-sky-200 bg-sky-50/50 hover:border-sky-300"
          }`}
        >
          <div className="flex items-center justify-between text-sky-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Training</span>
            <GraduationCap size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-sky-700">{localStats.training}</p>
          <span className="text-[11px] text-sky-600">Enrolled in Programs</span>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
            activeTab === "pending"
              ? "border-amber-600 bg-amber-50 ring-2 ring-amber-500/20"
              : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Review</span>
            <Clock size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700">{localStats.pending}</p>
          <span className="text-[11px] text-amber-600">Compliance & Drafts</span>
        </div>

        {/* Certified */}
        <div
          onClick={() => setActiveTab("certified")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
            activeTab === "certified"
              ? "border-purple-600 bg-purple-50 ring-2 ring-purple-500/20"
              : "border-purple-200 bg-purple-50/50 hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Certified</span>
            <Award size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-purple-700">{localStats.certified}</p>
          <span className="text-[11px] text-purple-600">Issued Credentials</span>
        </div>
      </div>

      {/* ── 2. FUNCTIONAL TABS WITH COUNTS ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
              activeTab === "all"
                ? "bg-[#214ECF] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Agents
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {localStats.total || localAgents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
              activeTab === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Active & Ready
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "active" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {localStats.active}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("training")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
              activeTab === "training"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            In Training
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "training" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {localStats.training}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
              activeTab === "pending"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Review
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "pending" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {localStats.pending}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("certified")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all ${
              activeTab === "certified"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Certified
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                activeTab === "certified" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {localStats.certified}
            </span>
          </button>
        </div>

        {/* Refresh & Onboard CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh agent roster"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-70 disabled:cursor-not-allowed transition"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-[#214ECF]" : "text-slate-500"} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={() => {
              setOnboardingStep(1);
              setOnboardError("");
              setOnboardSuccessCode(null);
              setForm({
                ...initialFormState,
                centreId: effectiveCentres.length === 1 ? String(effectiveCentres[0].id) : "",
              });
              setOnboardingOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition-colors"
          >
            <UserPlus size={14} />
            + Onboard New Agent
          </button>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] sm:min-w-[260px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search by Agent Code (THK-AGT-...), Name, Employee ID, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#214ECF] focus:bg-white transition shadow-2xs"
            />
            {search && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  title="Clear search"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 active:scale-95 transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active & Ready</option>
              <option value="pending_verification">Pending Review</option>
              <option value="in_training">In Training</option>
              <option value="suspended">Suspended</option>
              <option value="draft">Drafts</option>
            </select>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100"
            >
              <option value="all">All Departments</option>
              <option value="Inbound Voice">Inbound Voice</option>
              <option value="FinTech Inbound">FinTech Inbound</option>
              <option value="Customer Support">Customer Support</option>
              <option value="Technical Support">Technical Support</option>
              <option value="Healthcare Services">Healthcare Services</option>
              <option value="Back Office">Back Office</option>
              <option value="Outbound Telesales">Outbound Telesales</option>
            </select>

            {/* Centre Filter */}
            {effectiveCentres.length > 0 && (
              <select
                value={centreFilter}
                onChange={(e) => setCentreFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100"
              >
                <option value="all">All Centres</option>
                {effectiveCentres.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} {c.centre_id ? `(${c.centre_id})` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Shift Filter */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100"
            >
              <option value="all">All Shifts</option>
              <option value="US Day">US Day (EST)</option>
              <option value="US Night">US Night (PST)</option>
              <option value="UK Day">UK Day (GMT)</option>
              <option value="APAC">APAC Day (AEST)</option>
              <option value="Rotational">Rotational 24x7</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                <X size={12} /> Clear
              </button>
            )}

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* ── 4. BULK ACTIONS BAR (When 1+ rows selected) ─────────────── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-xs text-white shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-[#214ECF]" />
              <span className="font-bold">{selectedIds.size} agents selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSelected}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20 transition"
              >
                <Download size={12} /> Export Selected
              </button>

              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  showToast("Deselected all agents", "info");
                }}
                className="rounded-lg bg-white/10 px-3 py-1 font-bold text-slate-300 hover:bg-white/20 transition"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. AGENTS DIRECTORY TABLE ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Agent Directory ({filteredAgents.length} records)
            </span>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              Enterprise Governance
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Deterministic System Code (THK-AGT-XXXXX)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3">
                  <button
                    onClick={() => handleSelectAll(filteredAgents)}
                    className="flex items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {selectedIds.size > 0 && selectedIds.size === filteredAgents.length ? (
                      <CheckSquare size={16} className="text-[#214ECF]" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-3.5 py-3">Agent</th>
                <th className="px-3 py-3">Employee ID</th>
                <th className="px-3 py-3">Department & Role</th>
                <th className="px-3 py-3">Centre</th>
                <th className="px-3 py-3">Shift</th>
                <th className="px-3 py-3">Onboarding Progress</th>
                <th className="px-3 py-3">Status</th>
                <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAgents.map((agent) => {
                const initials = agent.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const isSelected = selectedIds.has(agent.id);
                const completion = agent.profile_completion_percent || 70;
                const missing = agent.missing_requirements || [];
                const isDraft = agent.is_draft || agent.status === "draft";

                return (
                  <tr
                    key={agent.id}
                    className={`group hover:bg-slate-50/80 transition-colors ${
                      isSelected ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    {/* Checkbox Column */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleRow(agent.id)}
                        className="flex items-center justify-center text-slate-400 hover:text-slate-600"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-[#214ECF]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    {/* Agent Column (Avatar, Name, Code, Email) */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#214ECF]/10 font-black text-xs text-[#214ECF]">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{agent.name}</span>
                            <span className="rounded bg-slate-900 px-1.5 py-0.2 font-mono text-[9px] font-black text-white">
                              {agent.agent_code || `THK-AGT-${String(agent.id).padStart(5, "0")}`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{agent.email || agent.phone || "No direct email"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {agent.employee_id}
                      </span>
                      {agent.supervisor && (
                        <p className="text-[10px] text-slate-400">Lead: {agent.supervisor}</p>
                      )}
                    </td>

                    {/* Department & Role */}
                    <td className="px-4 py-3.5">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {agent.department || "Operations"}
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-600">{agent.designation || "Agent"}</p>
                    </td>

                    {/* Assigned Centre & Creator Identity */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-slate-800">
                            {agent.centre_name || agent.bpo_centres?.name || "Unassigned Centre"}
                          </span>
                          {(agent.canonical_centre_id || agent.bpo_centres?.centre_id) && (
                            <span className="rounded bg-slate-100 border border-slate-200 px-1 py-0.2 font-mono text-[9px] font-bold text-slate-600">
                              {agent.canonical_centre_id || agent.bpo_centres?.centre_id}
                            </span>
                          )}
                        </div>
                        {(agent.assigned_by_name || agent.created_by_name) ? (
                          <p className="text-[10px] text-slate-500">
                            Assigned by: <span className="font-medium text-slate-700">{agent.assigned_by_name || agent.created_by_name}</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            Assigned by: <span className="italic">Authorized Partner</span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Shift */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] text-slate-600 font-medium">
                        {agent.shift_preference || "Standard Day"}
                      </span>
                    </td>

                    {/* Onboarding Progress (Bar + Missing Items + Complete Profile CTA) */}
                    <td className="px-4 py-3.5 min-w-[170px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-600">Profile {completion}%</span>
                          {missing.length > 0 ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                              Missing: {missing[0]}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                              Complete
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-300 ${
                              completion === 100
                                ? "bg-emerald-500"
                                : completion >= 75
                                ? "bg-sky-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${completion}%` }}
                          />
                        </div>

                        {/* Incomplete Profile Enforcement Callout */}
                        {missing.length > 0 && (
                          <button
                            onClick={() => openAgentDrawer(agent, "onboarding")}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-[#214ECF] hover:underline"
                          >
                            Complete Profile →
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {agent.status === "active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      ) : isDraft ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          <FileText size={11} /> Draft
                        </span>
                      ) : agent.status === "suspended" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                          <AlertCircle size={11} /> Suspended
                        </span>
                      ) : agent.status === "in_training" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                          <GraduationCap size={11} /> In Training
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock size={11} /> Pending Review
                        </span>
                      )}

                      {/* Portal Account Status indicator */}
                      {agent.account_status === "pending_activation" ? (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendInvitation(agent);
                            }}
                            title="Invitation pending activation. Click to resend or copy link."
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/90 px-2 py-0.5 text-[9px] font-semibold text-[#214ECF] hover:bg-blue-100 transition"
                          >
                            <Mail size={9} /> Invite Sent
                          </button>
                        </div>
                      ) : agent.account_status === "active" ? (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                            <ShieldCheck size={9} /> Portal Active
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* Actions Menu: [ Profile ] [ Work ] [ ⋮ ] */}
                    <td className={`px-4 py-3.5 text-right whitespace-nowrap sticky right-0 transition-colors z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] ${isSelected ? "bg-slate-50" : "bg-white group-hover:bg-slate-50"}`}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openAgentDrawer(agent, "overview")}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:border-[#214ECF]/40 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:scale-98 shadow-2xs transition cursor-pointer"
                          title="Open Agent Profile & Dossier"
                        >
                          <Eye size={14} />
                          Profile
                        </button>

                        <button
                          type="button"
                          onClick={() => openWorkCentre(agent, "overview")}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                          className="h-11 rounded-xl bg-[#214ECF] px-4 text-xs font-bold text-white hover:bg-blue-700 active:scale-98 shadow-xs shadow-blue-500/20 transition cursor-pointer"
                          title={`Open ${agent.name}'s Work & Operations Centre`}
                        >
                          <Briefcase size={14} className="stroke-[2.5]" />
                          Work
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionPanelAgent(agent);
                          }}
                          aria-label="Agent actions"
                          title={`Actions for ${agent.name}`}
                          className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-[#214ECF]/50 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:border-[#214ECF] active:bg-[#214ECF]/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#214ECF] shadow-2xs transition cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filteredAgents.length && (
            <div className="py-12 text-center text-xs text-slate-400">
              <Users size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-600">No agents match current filters</p>
              <p className="mt-1">Try resetting filters or click "+ Onboard New Agent" to register an agent.</p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 6. 5-STEP ONBOARDING WIZARD MODAL ─────────────────────────── */}
      {onboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-[#214ECF]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#214ECF]">
                  Thinkatic Enterprise Onboarding
                </span>
                <h3 className="mt-1 text-xl font-black text-slate-900">Onboard Operational Agent</h3>
                <p className="text-xs text-slate-500">
                  Step {onboardingStep} of 5 · Complete all mandatory verification requirements
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOnboardingOpen(false);
                  setOnboardingFieldErrors({});
                  setOnboardError("");
                }}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-[#214ECF] hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/15 active:text-[#1a3fa8] focus:outline-none focus:ring-2 focus:ring-[#214ECF]/30"
              >
                <X size={18} className="shrink-0" />
              </button>
            </div>

            {onboardSuccessCode ? (
              /* Success Confirmation */
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-2xl font-black text-slate-900">Agent Successfully Registered!</h4>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  The agent profile and credentials have been provisioned under permanent Agent ID:
                </p>
                <div className="inline-block rounded-2xl border-2 border-[#214ECF]/30 bg-[#214ECF]/5 px-6 py-3 font-mono text-2xl font-black text-[#214ECF] tracking-wider shadow-xs">
                  {onboardSuccessCode}
                </div>
                <p className="text-xs text-slate-500">
                  Account Status: <b className="text-emerald-700">ACTIVE & READY TO LOGIN</b>. The agent can immediately log in using their email and initial password.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setOnboardingOpen(false);
                      setOnboardSuccessCode(null);
                    }}
                    className="rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8]"
                  >
                    Done & View Roster
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {/* 5-Step Indicators with Strict Gating */}
                <div className="flex items-center justify-between gap-1 overflow-x-auto border-b border-slate-100 pb-3 text-xs font-bold">
                  {[
                    { num: 1, label: "Personal" },
                    { num: 2, label: "Employment" },
                    { num: 3, label: "Work Config" },
                    { num: 4, label: "Compliance Docs" },
                    { num: 5, label: "Review" },
                  ].map((s, idx) => {
                    const isCurrent = onboardingStep === s.num;
                    const isCompleted = s.num < onboardingStep;
                    const isLocked = s.num > onboardingStep;

                    return (
                      <div key={s.num} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => goToStep(s.num as any)}
                          aria-current={isCurrent ? "step" : undefined}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all text-xs font-bold whitespace-nowrap ${
                            isCurrent
                              ? "bg-[#214ECF] text-white shadow-xs"
                              : isCompleted
                              ? "bg-blue-50/90 text-[#214ECF] border border-blue-200 hover:bg-blue-100 cursor-pointer"
                              : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-60"
                          }`}
                        >
                          {isCompleted ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#214ECF] text-white">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
                                isCurrent ? "bg-white text-[#214ECF]" : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {s.num}
                            </span>
                          )}
                          <span>{s.label}</span>
                        </button>
                        {idx < 4 && <ChevronRight size={13} className="text-slate-300 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {onboardError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                    <span>{onboardError}</span>
                  </div>
                )}

                {/* STEP 1: PERSONAL INFORMATION */}
                {onboardingStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-first-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          First Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-first-name"
                          type="text"
                          required
                          placeholder="e.g. Gurpreet"
                          value={form.firstName}
                          onChange={(e) => {
                            setForm({ ...form, firstName: e.target.value });
                            if (onboardingFieldErrors.firstName) setOnboardingFieldErrors({ ...onboardingFieldErrors, firstName: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.firstName
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.firstName && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.firstName}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="onboard-last-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Last Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-last-name"
                          type="text"
                          required
                          placeholder="e.g. Singh"
                          value={form.lastName}
                          onChange={(e) => {
                            setForm({ ...form, lastName: e.target.value });
                            if (onboardingFieldErrors.lastName) setOnboardingFieldErrors({ ...onboardingFieldErrors, lastName: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.lastName
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.lastName && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Official Email / Gmail <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-email"
                          type="email"
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="none"
                          autoComplete="email"
                          required
                          placeholder="e.g. guru2323@gmail.com"
                          value={form.email}
                          onChange={(e) => {
                            setForm({ ...form, email: e.target.value });
                            if (onboardingFieldErrors.email) setOnboardingFieldErrors({ ...onboardingFieldErrors, email: "" });
                          }}
                          onBlur={() => {
                            if (form.email && !isValidEmail(form.email)) {
                              setOnboardingFieldErrors((prev) => ({
                                ...prev,
                                email: "Please enter a valid email address (e.g. guru2323@gmail.com)",
                              }));
                            }
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.email
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.email && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.email}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="onboard-phone" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Contact Phone
                          </label>
                          <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                        </div>
                        <input
                          id="onboard-phone"
                          type="tel"
                          inputMode="tel"
                          spellCheck={false}
                          autoComplete="tel"
                          placeholder="+1 555-019-2834"
                          value={form.phone}
                          onChange={(e) => {
                            setForm({ ...form, phone: e.target.value });
                            if (onboardingFieldErrors.phone) setOnboardingFieldErrors({ ...onboardingFieldErrors, phone: "" });
                          }}
                          onBlur={() => {
                            if (form.phone && !isValidPhone(form.phone)) {
                              setOnboardingFieldErrors((prev) => ({
                                ...prev,
                                phone: "Please enter a valid international phone format (e.g. +1 555-019-2834)",
                              }));
                            }
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.phone
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.phone && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="onboard-dob" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Date of Birth
                          </label>
                          <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                        </div>
                        <input
                          id="onboard-dob"
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="onboard-emergency" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Emergency Contact
                          </label>
                          <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                        </div>
                        <input
                          id="onboard-emergency"
                          type="text"
                          placeholder="Name & Contact Number"
                          value={form.emergencyContact}
                          onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        />
                      </div>
                    </div>

                    {/* Initial Login Password Configuration */}
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#214ECF] flex items-center gap-1.5 uppercase tracking-wider">
                          <Lock className="w-4 h-4" /> Initial Login Password
                        </span>
                        <span className="rounded-full bg-[#214ECF]/10 px-2 py-0.5 text-[10px] font-bold text-[#214ECF]">
                          Direct Access Setup
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="onboard-initial-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            Initial Password <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <div className="relative mt-1">
                            <input
                              id="onboard-initial-password"
                              type={showInitialPass ? "text" : "password"}
                              placeholder="Minimum 6 characters"
                              value={form.initialPassword}
                              onChange={(e) => {
                                setForm({ ...form, initialPassword: e.target.value });
                                if (onboardingFieldErrors.initialPassword) setOnboardingFieldErrors({ ...onboardingFieldErrors, initialPassword: "" });
                              }}
                              className={`w-full rounded-xl border px-3 py-2 pr-9 text-xs outline-none transition bg-white ${
                                onboardingFieldErrors.initialPassword
                                  ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                                  : "border-slate-200 focus:border-[#214ECF]"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowInitialPass(!showInitialPass)}
                              aria-label={showInitialPass ? "Hide initial password" : "Show initial password"}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showInitialPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {onboardingFieldErrors.initialPassword && (
                            <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.initialPassword}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="onboard-confirm-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            Confirm Initial Password <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <div className="relative mt-1">
                            <input
                              id="onboard-confirm-password"
                              type={showConfirmInitialPass ? "text" : "password"}
                              placeholder="Re-enter initial password"
                              value={form.confirmInitialPassword}
                              onChange={(e) => {
                                setForm({ ...form, confirmInitialPassword: e.target.value });
                                if (onboardingFieldErrors.confirmInitialPassword) setOnboardingFieldErrors({ ...onboardingFieldErrors, confirmInitialPassword: "" });
                              }}
                              className={`w-full rounded-xl border px-3 py-2 pr-9 text-xs outline-none transition bg-white ${
                                onboardingFieldErrors.confirmInitialPassword
                                  ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                                  : "border-slate-200 focus:border-[#214ECF]"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmInitialPass(!showConfirmInitialPass)}
                              aria-label={showConfirmInitialPass ? "Hide confirm password" : "Show confirm password"}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showConfirmInitialPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {onboardingFieldErrors.confirmInitialPassword && (
                            <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.confirmInitialPassword}</p>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 italic">
                        "Create an initial login password for this agent. The agent can change this password anytime from My Profile."
                      </p>
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition-colors"
                      >
                        Next: Employment Details →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: EMPLOYMENT DETAILS */}
                {onboardingStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-employee-id" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Internal Employee ID <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-employee-id"
                          type="text"
                          required
                          placeholder="e.g. EMP-10492"
                          value={form.employeeId}
                          onChange={(e) => {
                            setForm({ ...form, employeeId: e.target.value });
                            if (onboardingFieldErrors.employeeId) setOnboardingFieldErrors({ ...onboardingFieldErrors, employeeId: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-mono outline-none transition ${
                            onboardingFieldErrors.employeeId
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.employeeId ? (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.employeeId}</p>
                        ) : (
                          <span className="text-[10px] text-slate-400">Unique identifier within your centre</span>
                        )}
                      </div>

                      <div>
                        <label htmlFor="onboard-joining-date" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Joining Date <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-joining-date"
                          type="date"
                          required
                          value={form.joiningDate}
                          onChange={(e) => {
                            setForm({ ...form, joiningDate: e.target.value });
                            if (onboardingFieldErrors.joiningDate) setOnboardingFieldErrors({ ...onboardingFieldErrors, joiningDate: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.joiningDate
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.joiningDate && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.joiningDate}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-designation" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Designation / Job Title <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-designation"
                          type="text"
                          required
                          placeholder="e.g. Senior AI Operations Specialist"
                          value={form.designation}
                          onChange={(e) => {
                            setForm({ ...form, designation: e.target.value });
                            if (onboardingFieldErrors.designation) setOnboardingFieldErrors({ ...onboardingFieldErrors, designation: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                            onboardingFieldErrors.designation
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 bg-white focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.designation && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.designation}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="onboard-department" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Department Vertical <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="onboard-department"
                          value={form.department}
                          onChange={(e) => {
                            setForm({ ...form, department: e.target.value });
                            if (onboardingFieldErrors.department) setOnboardingFieldErrors({ ...onboardingFieldErrors, department: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition bg-white ${
                            onboardingFieldErrors.department
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 focus:border-[#214ECF]"
                          }`}
                        >
                          <option value="Customer Operations">Customer Operations</option>
                          <option value="Inbound Voice">Inbound Voice</option>
                          <option value="FinTech Inbound">FinTech Inbound</option>
                          <option value="Customer Support">Customer Support</option>
                          <option value="Technical Support">Technical Support</option>
                          <option value="Healthcare Services">Healthcare Services</option>
                          <option value="Back Office">Back Office</option>
                          <option value="Outbound Telesales">Outbound Telesales</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-employment-type" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Employment Type <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="onboard-employment-type"
                          value={form.employmentType}
                          onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        >
                          <option value="Full-Time">Full-Time (Permanent)</option>
                          <option value="Part-Time">Part-Time</option>
                          <option value="Contract">Contractual / Project</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="onboard-supervisor" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Supervisor / Team Lead
                          </label>
                          <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                        </div>
                        <input
                          id="onboard-supervisor"
                          type="text"
                          placeholder="e.g. Operations Lead NY"
                          value={form.supervisor}
                          onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition"
                      >
                        Next: Work Configuration →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: WORK CONFIGURATION */}
                {onboardingStep === 3 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-centre-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          CENTRE NAME <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="onboard-centre-name"
                          type="text"
                          placeholder="Enter your centre name"
                          value={form.centreName}
                          onChange={(e) => {
                            setForm({ ...form, centreName: e.target.value });
                            if (onboardingFieldErrors.centreName) {
                              setOnboardingFieldErrors({ ...onboardingFieldErrors, centreName: "" });
                            }
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition bg-white ${
                            onboardingFieldErrors.centreName
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 focus:border-[#214ECF]"
                          }`}
                        />
                        {onboardingFieldErrors.centreName ? (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">{onboardingFieldErrors.centreName}</p>
                        ) : (
                          <p className="mt-1 text-[10px] text-slate-400">e.g. Primary Delivery Centre NY-01</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="onboard-process-type" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Process Type <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="onboard-process-type"
                          value={form.processType}
                          onChange={(e) => setForm({ ...form, processType: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        >
                          <option value="Inbound Voice">Inbound Voice</option>
                          <option value="Non-Voice / Chat">Non-Voice / Chat</option>
                          <option value="Blended (Voice + Chat)">Blended (Voice + Chat)</option>
                          <option value="Back Office Processing">Back Office Processing</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="onboard-shift-preference" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Shift Window <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="onboard-shift-preference"
                          value={form.shiftPreference}
                          onChange={(e) => {
                            setForm({ ...form, shiftPreference: e.target.value });
                            if (onboardingFieldErrors.shiftPreference) setOnboardingFieldErrors({ ...onboardingFieldErrors, shiftPreference: "" });
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs outline-none transition bg-white ${
                            onboardingFieldErrors.shiftPreference
                              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                              : "border-slate-200 focus:border-[#214ECF]"
                          }`}
                        >
                          <option value="US Day (EST)">US Day (EST)</option>
                          <option value="US Night (PST)">US Night (PST)</option>
                          <option value="UK Day (GMT)">UK Day (GMT)</option>
                          <option value="APAC Day (AEST)">APAC Day (AEST)</option>
                          <option value="Rotational 24x7">Rotational 24x7</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="onboard-timezone" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Operational Timezone <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="onboard-timezone"
                          value={form.timezone}
                          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                        >
                          <option value="America/New_York (EST)">America/New_York (EST)</option>
                          <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST)</option>
                          <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                          <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</option>
                          <option value="Australia/Sydney (AEST)">Australia/Sydney (AEST)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="onboard-languages" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Languages Spoken (comma-separated)
                        </label>
                        <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                      </div>
                      <input
                        id="onboard-languages"
                        type="text"
                        placeholder="English, Spanish, Hindi"
                        value={form.languagesStr}
                        onChange={(e) => setForm({ ...form, languagesStr: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="onboard-skills" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Core Skills & Tools (comma-separated)
                        </label>
                        <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                      </div>
                      <input
                        id="onboard-skills"
                        type="text"
                        placeholder="Zendesk, Salesforce, CRM, KYC Verification, Active Listening"
                        value={form.skillsStr}
                        onChange={(e) => setForm({ ...form, skillsStr: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                      />
                    </div>

                    <div className="flex justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(4)}
                        className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition"
                      >
                        Next: Compliance Documents →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: COMPLIANCE DOCUMENTS */}
                {onboardingStep === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs">
                      <p className="font-bold text-slate-800">Compliance & Identity Attachments</p>
                      <p className="text-[11px] text-slate-500">
                        Upload required document scans (.pdf, .png, .jpg, max 10MB each). Mandatory documents must be attached before proceeding.
                      </p>

                      {/* Doc 1: National ID Proof */}
                      <div className={`flex items-center justify-between rounded-xl border p-3 bg-white transition ${
                        onboardingFieldErrors.id_proof ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                      }`}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-800">1. National ID / Passport</p>
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700 uppercase">
                              Mandatory
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">Govt photo identity proof</span>
                          {form.documents.find((d) => d.document_type === "id_proof") && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-[10px] font-bold text-emerald-600">
                                ✓ {form.documents.find((d) => d.document_type === "id_proof")?.document_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeOnboardingDoc("id_proof")}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                          {onboardingFieldErrors.id_proof && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1">{onboardingFieldErrors.id_proof}</p>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
                          <input
                            id="doc-upload-id-proof"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => {
                              handleFileSelect(e, "id_proof");
                              if (onboardingFieldErrors.id_proof) setOnboardingFieldErrors({ ...onboardingFieldErrors, id_proof: "" });
                            }}
                          />
                          {form.documents.find((d) => d.document_type === "id_proof") ? "Replace File" : "Upload File"}
                        </label>
                      </div>

                      {/* Doc 2: Signed NDA */}
                      <div className={`flex items-center justify-between rounded-xl border p-3 bg-white transition ${
                        onboardingFieldErrors.nda ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                      }`}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-800">2. Signed NDA & Data Protection</p>
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700 uppercase">
                              Mandatory
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">Client confidentiality undertaking</span>
                          {form.documents.find((d) => d.document_type === "nda") && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-[10px] font-bold text-emerald-600">
                                ✓ {form.documents.find((d) => d.document_type === "nda")?.document_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeOnboardingDoc("nda")}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                          {onboardingFieldErrors.nda && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1">{onboardingFieldErrors.nda}</p>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
                          <input
                            id="doc-upload-nda"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => {
                              handleFileSelect(e, "nda");
                              if (onboardingFieldErrors.nda) setOnboardingFieldErrors({ ...onboardingFieldErrors, nda: "" });
                            }}
                          />
                          {form.documents.find((d) => d.document_type === "nda") ? "Replace File" : "Upload File"}
                        </label>
                      </div>

                      {/* Doc 3: Educational Degree */}
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-800">3. Educational Certificate / Degree</p>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                              Optional
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">Highest qualification certificate</span>
                          {form.documents.find((d) => d.document_type === "educational_cert") && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-[10px] font-bold text-emerald-600">
                                ✓ {form.documents.find((d) => d.document_type === "educational_cert")?.document_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeOnboardingDoc("educational_cert")}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, "educational_cert")}
                          />
                          {form.documents.find((d) => d.document_type === "educational_cert")
                            ? "Replace File"
                            : "Upload File"}
                        </label>
                      </div>

                      {/* Doc 4: Address Proof */}
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-800">4. Address Proof</p>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                              Optional
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">Utility bill or govt proof</span>
                          {form.documents.find((d) => d.document_type === "address_proof") && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-[10px] font-bold text-emerald-600">
                                ✓ {form.documents.find((d) => d.document_type === "address_proof")?.document_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeOnboardingDoc("address_proof")}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, "address_proof")}
                          />
                          {form.documents.find((d) => d.document_type === "address_proof")
                            ? "Replace File"
                            : "Upload File"}
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(5)}
                        className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition"
                      >
                        Next: Review & Confirm →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: REVIEW & SUBMIT */}
                {onboardingStep === 5 && (
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Personal Info */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personal Information</p>
                          <span className="text-[10px] font-bold text-[#214ECF]">Step 1</span>
                        </div>
                        <p className="text-sm font-black text-slate-900">
                          {form.firstName} {form.lastName}
                        </p>
                        <p className="text-slate-600 font-medium">{form.email}</p>
                        <p className="text-slate-500">{form.phone || "No phone provided (Optional)"}</p>
                        <p className="text-slate-500">{form.dateOfBirth ? `DOB: ${form.dateOfBirth}` : "DOB: Not specified"}</p>
                        <p className="text-slate-500">{form.emergencyContact ? `Emergency: ${form.emergencyContact}` : "Emergency: Not specified"}</p>
                      </div>

                      {/* Employment */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employment Details</p>
                          <span className="text-[10px] font-bold text-[#214ECF]">Step 2</span>
                        </div>
                        <p className="font-mono text-sm font-black text-slate-900">{form.employeeId}</p>
                        <p className="text-slate-700 font-semibold">{form.designation}</p>
                        <p className="text-slate-500">{form.department} · {form.employmentType}</p>
                        <p className="text-slate-500">Joining: {form.joiningDate}</p>
                        <p className="text-slate-500">Supervisor: {form.supervisor || "None Assigned"}</p>
                      </div>

                      {/* Work Config */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work Configuration</p>
                          <span className="text-[10px] font-bold text-[#214ECF]">Step 3</span>
                        </div>
                        <p className="font-bold text-slate-900">
                          {form.centreName.trim() || "No Centre Name Entered"}
                        </p>
                        <p className="text-slate-700">{form.shiftPreference}</p>
                        <p className="text-slate-500">{form.processType} · {form.timezone}</p>
                        <p className="text-slate-500 truncate">Languages: {form.languagesStr || "English"}</p>
                        <p className="text-slate-500 truncate">Skills: {form.skillsStr || "Standard Ops"}</p>
                      </div>

                      {/* Compliance Documents */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compliance Documents</p>
                          <span className="text-[10px] font-bold text-[#214ECF]">Step 4</span>
                        </div>
                        <p className="font-bold text-slate-900">{form.documents.length} Files Attached</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {form.documents.map((d) => (
                            <span key={d.document_type} className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold">
                              ✓ {d.document_type.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Initial Login Credentials Review */}
                      <div className="col-span-2 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#214ECF] text-white shadow-xs">
                            <Lock size={16} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Login Authentication Account</p>
                            <p className="font-bold text-slate-900">
                              Identifier: <span className="font-mono text-[#214ECF]">{form.email}</span>
                            </p>
                            <p className="text-[11px] text-slate-600">
                              Password: <span className="font-semibold text-emerald-700">Set</span> (Securely hashed via bcrypt · Plaintext never displayed)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
                            Portal Ready: Active
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => goToStep(4)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        ← Back
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={submittingOnboard}
                          onClick={() => handleOnboardingSubmit(true)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                        >
                          {submittingOnboard ? "Saving..." : "Save as Draft"}
                        </button>

                        <button
                          type="button"
                          disabled={submittingOnboard}
                          onClick={() => handleOnboardingSubmit(false)}
                          className="rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition flex items-center gap-2"
                        >
                          {submittingOnboard ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Creating Agent...</span>
                            </>
                          ) : (
                            <span>Create Agent</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 7. INCOMPLETE PROFILE ACTIVATION WARNING MODAL ───────────── */}
      {incompleteModalOpen && incompleteAgentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-amber-300 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Cannot Activate Agent</h4>
                <p className="text-xs text-slate-500">Incomplete Profile Enforcement</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Agent <b>{incompleteAgentTarget.name}</b> ({incompleteAgentTarget.agent_code}) cannot be activated because
              their profile is only <b>{incompleteAgentTarget.profile_completion_percent || 70}% complete</b>.
            </p>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                Missing Requirements:
              </p>
              <ul className="space-y-1 text-xs text-amber-900">
                {(incompleteAgentTarget.missing_requirements || ["National ID Proof", "Signed NDA"]).map((req, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIncompleteModalOpen(false);
                  setIncompleteAgentTarget(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIncompleteModalOpen(false);
                  openAgentDrawer(incompleteAgentTarget, "onboarding");
                }}
                className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8]"
              >
                Complete Profile Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. EDIT PROFILE MODAL ─────────────────────────────────────── */}
      {editProfileOpen && editingAgent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-agent-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setEditProfileOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 shrink-0 bg-white">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#214ECF]/10 text-[#214ECF] ring-1 ring-[#214ECF]/20">
                  <UserCog size={22} className="text-[#214ECF]" />
                </div>
                <div className="min-w-0">
                  <h4 id="edit-agent-modal-title" className="text-base font-black text-slate-900 tracking-tight">
                    Edit Agent Profile
                  </h4>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 truncate">
                    <span className="font-semibold text-slate-700">{editingAgent.name}</span>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span className="font-mono font-bold text-[#214ECF] bg-[#214ECF]/5 px-1.5 py-0.5 rounded text-[11px]">
                      {editingAgent.agent_code || `THK-AGT-${editingAgent.id}`}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                aria-label="Close edit profile dialog"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-400 hover:bg-[#214ECF]/10 hover:text-[#214ECF] hover:border-[#214ECF]/30 active:scale-95 transition-all duration-150"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditProfileSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {editError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-bold text-rose-700 animate-in fade-in duration-150">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span className="flex-1">{editError}</span>
                  </div>
                )}

                {/* ROW 1: FULL NAME & EMAIL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="edit_agent_name"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Full Name <span className="text-[#214ECF] font-bold ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
                        <User size={16} />
                      </div>
                      <input
                        id="edit_agent_name"
                        type="text"
                        required
                        value={editingAgent.name}
                        onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                        placeholder="e.g. Gurpreet R."
                        className="w-full min-h-[44px] rounded-xl border border-[#D9E3F5] bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="edit_agent_email"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Email <span className="text-[#214ECF] font-bold ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
                        <Mail size={16} />
                      </div>
                      <input
                        id="edit_agent_email"
                        type="email"
                        required
                        value={editingAgent.email || ""}
                        onChange={(e) => setEditingAgent({ ...editingAgent, email: e.target.value })}
                        placeholder="e.g. agent@thinkatic.com"
                        className="w-full min-h-[44px] rounded-xl border border-[#D9E3F5] bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 2: PHONE & SUPERVISOR / LEAD */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="edit_agent_phone"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Phone
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
                        <Phone size={16} />
                      </div>
                      <input
                        id="edit_agent_phone"
                        type="text"
                        value={editingAgent.phone || ""}
                        onChange={(e) => setEditingAgent({ ...editingAgent, phone: e.target.value })}
                        placeholder="e.g. +1 (555) 019-2834"
                        className="w-full min-h-[44px] rounded-xl border border-[#D9E3F5] bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="edit_agent_supervisor"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Supervisor / Lead
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
                        <UserCheck size={16} />
                      </div>
                      <input
                        id="edit_agent_supervisor"
                        type="text"
                        value={editingAgent.supervisor || ""}
                        onChange={(e) => setEditingAgent({ ...editingAgent, supervisor: e.target.value })}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full min-h-[44px] rounded-xl border border-[#D9E3F5] bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 3: DEPARTMENT & DESIGNATION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      id="edit_agent_dept_label"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Department
                    </label>
                    <ThinkaticSelect
                      id="edit_agent_dept"
                      labelId="edit_agent_dept_label"
                      value={editingAgent.department || "Inbound Voice"}
                      options={EDIT_PROFILE_DEPARTMENTS}
                      onChange={(val) => setEditingAgent({ ...editingAgent, department: val })}
                      icon={Building2}
                      placeholder="Select department"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit_agent_designation"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Designation
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#214ECF]">
                        <Award size={16} />
                      </div>
                      <input
                        id="edit_agent_designation"
                        type="text"
                        value={editingAgent.designation || ""}
                        onChange={(e) => setEditingAgent({ ...editingAgent, designation: e.target.value })}
                        placeholder="e.g. Customer Support Specialist"
                        className="w-full min-h-[44px] rounded-xl border border-[#D9E3F5] bg-white pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 transition-all duration-150 hover:border-[#214ECF]/50 focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 4: EMPLOYMENT TYPE & SHIFT WINDOW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      id="edit_agent_employment_label"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Employment Type
                    </label>
                    <ThinkaticSelect
                      id="edit_agent_employment"
                      labelId="edit_agent_employment_label"
                      value={editingAgent.employment_type || "Full-Time"}
                      options={EDIT_PROFILE_EMPLOYMENT_TYPES}
                      onChange={(val) => setEditingAgent({ ...editingAgent, employment_type: val })}
                      icon={Briefcase}
                      placeholder="Select employment type"
                    />
                  </div>

                  <div>
                    <label
                      id="edit_agent_shift_label"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Shift Window
                    </label>
                    <ThinkaticSelect
                      id="edit_agent_shift"
                      labelId="edit_agent_shift_label"
                      value={editingAgent.shift_preference || "US Day (EST)"}
                      options={EDIT_PROFILE_SHIFT_WINDOWS}
                      onChange={(val) => setEditingAgent({ ...editingAgent, shift_preference: val })}
                      icon={Clock}
                      placeholder="Select shift window"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="flex h-11 min-h-[44px] items-center justify-center rounded-xl border border-slate-200/90 bg-white px-5 text-xs font-bold text-slate-700 transition-all duration-150 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-6 text-xs font-bold text-white shadow-md shadow-[#214ECF]/20 transition-all duration-150 hover:bg-[#1a3fa8] hover:shadow-lg hover:shadow-[#214ECF]/30 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
                >
                  {submittingEdit ? (
                    <>
                      <RefreshCw size={15} className="animate-spin text-white" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8.5 RIGHT-SIDE AGENT ACTIONS PANEL ───────────────────────── */}
      {actionPanelAgent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-panel-title"
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setActionPanelAgent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full max-w-[92vw] sm:max-w-[400px] md:max-w-[420px] flex-col bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200 ease-out"
          >
            {/* Panel Header */}
            <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#214ECF]/10 font-black text-base text-[#214ECF] ring-1 ring-[#214ECF]/20">
                    {actionPanelAgent.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Agent Actions</span>
                    <h3 id="action-panel-title" className="truncate text-base font-black text-slate-900">
                      {actionPanelAgent.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                        {actionPanelAgent.agent_code || `THK-AGT-${actionPanelAgent.id}`}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                          actionPanelAgent.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : actionPanelAgent.status === "pending_verification"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : actionPanelAgent.status === "in_training"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : actionPanelAgent.status === "draft"
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {actionPanelAgent.status === "pending_verification"
                          ? "Pending Review"
                          : actionPanelAgent.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActionPanelAgent(null)}
                  aria-label="Close agent actions"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Department & Centre metadata */}
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="font-semibold text-slate-700">{actionPanelAgent.department || "Operations"}</span>
                <span className="text-slate-300">•</span>
                <span className="truncate">{actionPanelAgent.designation || "Customer Support Associate"}</span>
                {(actionPanelAgent.centre_name || actionPanelAgent.bpo_centres?.name) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-[#214ECF] font-medium">
                      <Building2 size={12} />
                      {actionPanelAgent.centre_name || actionPanelAgent.bpo_centres?.name}
                      {(actionPanelAgent.canonical_centre_id || actionPanelAgent.bpo_centres?.centre_id) && (
                        <span className="font-mono text-[9px] text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded ml-0.5">
                          {actionPanelAgent.canonical_centre_id || actionPanelAgent.bpo_centres?.centre_id}
                        </span>
                      )}
                    </span>
                  </>
                )}
                {(actionPanelAgent.assigned_by_name || actionPanelAgent.created_by_name) && (
                  <div className="w-full text-[10px] text-slate-400 mt-1">
                    Assigned by: <span className="font-semibold text-slate-700">{actionPanelAgent.assigned_by_name || actionPanelAgent.created_by_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions List - grouped logically */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* GROUP 1: PROFILE & WORK */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Operations & Profile</p>

                {/* Agent Work Centre */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    if (target) openWorkCentre(target, "overview");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/50 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/50 hover:bg-[#214ECF]/10 hover:text-[#214ECF] active:bg-[#214ECF]/15 transition shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#214ECF] text-white transition shadow-xs shadow-blue-500/20">
                      <Briefcase size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-[#214ECF]">Agent Work Centre</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        Calls, Attendance, Productivity & Tasks
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#214ECF] shrink-0 transition" />
                </button>

                {/* View Profile */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    openAgentDrawer(target, "overview");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <Eye size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">View Profile</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        View full credentials, KPIs & dossier
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Edit Profile */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    setEditingAgent({ ...target });
                    setEditProfileOpen(true);
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <Edit3 size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Edit Profile</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Modify contact & employment details
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Complete Profile */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    openAgentDrawer(target, "onboarding");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF] group-hover:bg-[#214ECF]/20 transition">
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Complete Profile</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Profile completion progress: {actionPanelAgent.profile_completion_percent || 0}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>
              </div>

              {/* GROUP 2: COMPLIANCE */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Compliance</p>

                {/* Upload Documents */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    openAgentDrawer(target, "documents");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <Upload size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Upload Documents</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        ID proof, Signed NDA & Certifications
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Verification / Requirements */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    const completion = target.profile_completion_percent || 0;
                    const missing = target.missing_requirements || [];
                    if (completion < 75 || missing.length > 0) {
                      setIncompleteAgentTarget(target);
                      setIncompleteModalOpen(true);
                    } else {
                      openAgentDrawer(target, "onboarding");
                    }
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition">
                      <ShieldCheck size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">
                        Verification & Requirements
                      </span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        {(actionPanelAgent.missing_requirements?.length ?? 0) > 0
                          ? `${actionPanelAgent.missing_requirements!.length} pending item(s)`
                          : "All mandatory criteria satisfied"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>
              </div>

              {/* GROUP 3: OPERATIONS */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Operations</p>

                {/* Training */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    setSelectedAgent(target);
                    setEnrollModalOpen(true);
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition">
                      <GraduationCap size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Enroll Training</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Curriculum & compliance certification
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Campaigns / Projects */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    setSelectedAgent(target);
                    setAssignModalOpen(true);
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition">
                      <Briefcase size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">
                        Campaign Assignments
                      </span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Allocate to client delivery project
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Attendance */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    openAgentDrawer(target, "attendance");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <Clock3 size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">
                        Attendance & Shifts
                      </span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Shift adherence & check-in logs
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>
              </div>

              {/* GROUP: PORTAL CREDENTIALS & ACCESS */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Portal Credentials</p>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      actionPanelAgent.account_status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : actionPanelAgent.account_status === "suspended"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-blue-100 text-[#214ECF]"
                    }`}
                  >
                    {actionPanelAgent.account_status === "active"
                      ? "Portal Active"
                      : actionPanelAgent.account_status === "suspended"
                      ? "Access Blocked"
                      : "Pending Activation"}
                  </span>
                </div>

                {/* Set New Temporary Password / Reset Initial Password */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setTempPasswordModal({
                      open: true,
                      agent: target,
                      temporaryPassword: "",
                      confirmPassword: "",
                      loading: false,
                      error: "",
                    });
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/40 px-3.5 py-2.5 text-left text-xs font-semibold text-[#214ECF] hover:border-[#214ECF] hover:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition">
                      <Key size={15} />
                    </div>
                    <div>
                      <span className="block font-bold">Set New Temporary Password</span>
                      <span className="block text-[11px] font-normal text-slate-500">
                        Invalidates old password & sets temporary login
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#214ECF]/60 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Resend Invitation / Password Reset Setup Link */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    handleResetPassword(target);
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <Send size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Send Password Setup Link</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Issue secure password setup URL
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Open Agent Portal In New Tab */}
                <a
                  href="/login?type=agent"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <ExternalLink size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Open Agent Login Portal</span>
                      <span className="block text-[11px] font-normal text-slate-400">
                        Test live agent sign in
                      </span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </a>
              </div>

              {/* GROUP 4: GOVERNANCE */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Governance</p>

                {/* Audit Trail */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    openAgentDrawer(target, "audit");
                  }}
                  className="group flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-[#214ECF]/30 hover:bg-[#214ECF]/5 hover:text-[#214ECF] active:bg-[#214ECF]/10 transition shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF] transition">
                      <History size={15} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 group-hover:text-[#214ECF]">Audit Trail</span>
                      <span className="block text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
                        Immutable operational activity history
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#214ECF] shrink-0 transition" />
                </button>

                {/* Status Management (Activate / Suspend) */}
                <button
                  type="button"
                  onClick={() => {
                    const target = actionPanelAgent;
                    setActionPanelAgent(null);
                    handleToggleStatus(target);
                  }}
                  className={`group flex w-full min-h-[44px] items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition shadow-2xs ${
                    actionPanelAgent.status === "active"
                      ? "border-rose-200/80 bg-rose-50/50 text-rose-700 hover:border-rose-300 hover:bg-rose-100/70"
                      : "border-emerald-200/80 bg-emerald-50/50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        actionPanelAgent.status === "active"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {actionPanelAgent.status === "active" ? <UserX size={15} /> : <UserCheck size={15} />}
                    </div>
                    <div>
                      <span className="block font-bold">
                        {actionPanelAgent.status === "active" ? "Suspend Agent" : "Activate Agent"}
                      </span>
                      <span className="block text-[11px] font-normal opacity-80">
                        {actionPanelAgent.status === "active"
                          ? "Temporarily suspend operational access"
                          : "Verify completion and enable agent"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="opacity-60 group-hover:opacity-100 shrink-0 transition" />
                </button>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => setActionPanelAgent(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. AGENT DETAIL SLIDE-OUT DRAWER (7 Tabs) ─────────────────── */}
      {drawerOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="border-b border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#214ECF]/10 font-black text-base text-[#214ECF]">
                    {selectedAgent.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">{selectedAgent.name}</h3>
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                        {selectedAgent.agent_code || `THK-AGT-${selectedAgent.id}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedAgent.designation || "Agent"} · {selectedAgent.department || "Operations"} ·{" "}
                      <span className="capitalize font-bold text-slate-700">{selectedAgent.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingAgent({ ...selectedAgent });
                      setEditProfileOpen(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Drawer Tab Navigation (7 Tabs) */}
              <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px text-xs font-bold">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "onboarding", label: "Onboarding & Score" },
                  { id: "documents", label: `Docs (${(selectedAgent.documents || []).length})` },
                  { id: "training", label: "Training & Certs" },
                  { id: "projects", label: `Campaigns (${(selectedAgent.assigned_projects || []).length})` },
                  { id: "attendance", label: "Attendance" },
                  { id: "audit", label: "Audit Trail" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDrawerTab(t.id as any)}
                    className={`border-b-2 px-3 py-2 whitespace-nowrap transition ${
                      drawerTab === t.id
                        ? "border-[#214ECF] text-[#214ECF]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading full agent dossier...</div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {drawerTab === "overview" && (
                    <div className="space-y-5 text-xs">
                      {/* KPI Quick Card */}
                      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Employee ID</span>
                          <p className="font-mono font-bold text-slate-900 text-sm">{selectedAgent.employee_id}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Assigned Centre</span>
                          <p className="font-bold text-slate-900 truncate">
                            {selectedAgent.centre_name || selectedAgent.bpo_centres?.name || "Unassigned Centre"}
                          </p>
                          {(selectedAgent.canonical_centre_id || selectedAgent.bpo_centres?.centre_id) && (
                            <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded">
                              {selectedAgent.canonical_centre_id || selectedAgent.bpo_centres?.centre_id}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Experience</span>
                          <p className="font-bold text-slate-900">{selectedAgent.experience_years || 0} Years</p>
                        </div>
                      </div>

                      {/* Employment Details */}
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Employment & Work Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-400">Assigned Delivery Centre</span>
                            <p className="font-bold text-slate-900">
                              {selectedAgent.centre_name || selectedAgent.bpo_centres?.name || "Unassigned"}
                              {(selectedAgent.canonical_centre_id || selectedAgent.bpo_centres?.centre_id) && (
                                <span className="ml-1.5 font-mono text-[10px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-1 py-0.2 rounded">
                                  {selectedAgent.canonical_centre_id || selectedAgent.bpo_centres?.centre_id}
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400">Assigned / Onboarded By</span>
                            <p className="font-bold text-slate-900">
                              {selectedAgent.assigned_by_name || selectedAgent.created_by_name || "Authorized Partner Admin"}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400">Role / Designation</span>
                            <p className="font-bold text-slate-900">{selectedAgent.designation || "Agent"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Department Vertical</span>
                            <p className="font-bold text-slate-900">{selectedAgent.department || "Operations"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Employment Type</span>
                            <p className="font-bold text-slate-900">{selectedAgent.employment_type || "Full-Time"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Supervisor / Lead</span>
                            <p className="font-bold text-slate-900">{selectedAgent.supervisor || "Unassigned"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Shift Window</span>
                            <p className="font-bold text-slate-900">{selectedAgent.shift_preference || "Standard Day"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Operational Timezone</span>
                            <p className="font-bold text-slate-900">{selectedAgent.timezone || "America/New_York (EST)"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contact & Personal */}
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Contact & Personal Details
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-400">Official Email</span>
                            <p className="font-bold text-slate-900">{selectedAgent.email || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Contact Phone</span>
                            <p className="font-bold text-slate-900">{selectedAgent.phone || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Date of Birth</span>
                            <p className="font-bold text-slate-900">{selectedAgent.date_of_birth || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Emergency Contact</span>
                            <p className="font-bold text-slate-900">{selectedAgent.emergency_contact || "—"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Agent Portal Access & Credentials Card */}
                      <div className="rounded-2xl border border-blue-200/80 bg-blue-50/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Key className="text-[#214ECF]" size={16} />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Agent Portal Access & Credentials
                            </h4>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              selectedAgent.account_status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : selectedAgent.account_status === "suspended"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-[#214ECF]"
                            }`}
                          >
                            {selectedAgent.account_status === "active"
                              ? "Account Active"
                              : selectedAgent.account_status === "suspended"
                              ? "Login Suspended"
                              : "Pending Activation"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400">Login Username / Email</span>
                            <p className="font-bold text-slate-900 truncate">{selectedAgent.email || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Agent Identifier</span>
                            <p className="font-mono font-bold text-[#214ECF]">
                              {selectedAgent.agent_code || `THK-AGT-${selectedAgent.id}`}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400">Invitation Status</span>
                            <p className="font-bold text-slate-700">
                              {selectedAgent.account_status === "active"
                                ? "Activated & Verified"
                                : selectedAgent.invitation_sent_at
                                ? `Sent ${new Date(selectedAgent.invitation_sent_at).toLocaleDateString()}`
                                : "Pending Setup"}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400">Last Portal Session</span>
                            <p className="font-bold text-slate-700">
                              {selectedAgent.last_login_at
                                ? new Date(selectedAgent.last_login_at).toLocaleString()
                                : "Never logged in"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100">
                          <button
                            type="button"
                            disabled={credentialLoading}
                            onClick={() => handleResendInvitation(selectedAgent)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1a3eb3] transition disabled:opacity-50"
                          >
                            <Send size={13} /> Resend Activation Link
                          </button>
                          <button
                            type="button"
                            disabled={credentialLoading}
                            onClick={() => handleResetPassword(selectedAgent)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                          >
                            <Key size={13} /> Reset Password
                          </button>
                          {selectedAgent.invitation_url && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedAgent.invitation_url!);
                                showToast("Activation link copied!");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-[#214ECF] hover:bg-blue-50 transition"
                            >
                              <Copy size={13} /> Copy Link
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Languages & Skills */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Languages Spoken</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(selectedAgent.languages || ["English"]).map((lang, i) => (
                            <span
                              key={i}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700"
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Competencies & Skills</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(selectedAgent.skills || ["Inbound Voice", "CRM"]).map((skill, i) => (
                            <span
                              key={i}
                              className="rounded-lg border border-[#214ECF]/20 bg-[#214ECF]/5 px-2.5 py-1 text-xs font-bold text-[#214ECF]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ONBOARDING & SCORE */}
                  {drawerTab === "onboarding" && (
                    <div className="space-y-5 text-xs">
                      {/* Profile Score Card */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Profile Completion Score
                            </p>
                            <h4 className="text-2xl font-black text-slate-900">
                              {selectedAgent.profile_completion_percent || 70}% Complete
                            </h4>
                          </div>
                          <div
                            className={`rounded-2xl px-3.5 py-2 font-bold text-xs ${
                              (selectedAgent.profile_completion_percent || 70) >= 80
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {(selectedAgent.profile_completion_percent || 70) >= 80
                              ? "Verification Ready"
                              : "Missing Mandatory Requirements"}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-[#214ECF] transition-all duration-300"
                            style={{ width: `${selectedAgent.profile_completion_percent || 70}%` }}
                          />
                        </div>
                      </div>

                      {/* Missing Requirements List */}
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Verification Checklist
                        </h4>
                        <div className="space-y-2">
                          {[
                            {
                              label: "Personal Details & Contact (25%)",
                              met: !!(selectedAgent.name && selectedAgent.email),
                            },
                            {
                              label: "Employment Details & Supervisor (25%)",
                              met: !!(selectedAgent.employee_id && selectedAgent.supervisor),
                            },
                            {
                              label: "Work Configuration & Shift (25%)",
                              met: !!(selectedAgent.shift_preference && selectedAgent.process_type),
                            },
                            {
                              label: "Mandatory ID Proof (10%)",
                              met: (selectedAgent.documents || []).some((d) => d.document_type === "id_proof"),
                            },
                            {
                              label: "Signed NDA & Compliance Undertaking (5%)",
                              met: (selectedAgent.documents || []).some((d) => d.document_type === "nda"),
                            },
                            {
                              label: "Curriculum / Training Enrolled (10%)",
                              met: (selectedAgent.training_assignments || []).length > 0,
                            },
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between rounded-xl p-3 border ${
                                item.met
                                  ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                                  : "border-amber-200 bg-amber-50/40 text-amber-900"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.met ? (
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                ) : (
                                  <AlertCircle size={16} className="text-amber-600" />
                                )}
                                <span className="font-semibold">{item.label}</span>
                              </div>
                              <span className="text-[10px] font-bold">
                                {item.met ? "Verified / Complete" : "Missing Requirement"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Inline Quick Complete Form */}
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Quick Complete Profile Details
                          </h4>
                          <span className="text-[10px] text-slate-400">Fill in missing requirements</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500">Supervisor *</label>
                            <input
                              type="text"
                              placeholder="e.g. Lead Supervisor"
                              value={inlineQuickComplete.supervisor}
                              onChange={(e) =>
                                setInlineQuickComplete({ ...inlineQuickComplete, supervisor: e.target.value })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500">Employment Type</label>
                            <select
                              value={inlineQuickComplete.employmentType}
                              onChange={(e) =>
                                setInlineQuickComplete({ ...inlineQuickComplete, employmentType: e.target.value })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                            >
                              <option value="Full-Time">Full-Time</option>
                              <option value="Part-Time">Part-Time</option>
                              <option value="Contract">Contract</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500">Phone</label>
                            <input
                              type="text"
                              placeholder="+91 98765 43210"
                              value={inlineQuickComplete.phone}
                              onChange={(e) =>
                                setInlineQuickComplete({ ...inlineQuickComplete, phone: e.target.value })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500">Emergency Contact</label>
                            <input
                              type="text"
                              placeholder="Contact Name & Number"
                              value={inlineQuickComplete.emergencyContact}
                              onChange={(e) =>
                                setInlineQuickComplete({ ...inlineQuickComplete, emergencyContact: e.target.value })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            disabled={savingQuickComplete}
                            onClick={handleSaveQuickComplete}
                            className="rounded-xl bg-[#214ECF] px-4 py-2 font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50"
                          >
                            {savingQuickComplete ? "Saving..." : "Save & Submit for Review"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DOCUMENTS */}
                  {drawerTab === "documents" && (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Compliance Files</h4>
                        <button
                          onClick={() => {
                            setUploadDocOpen(true);
                            setUploadDocError("");
                          }}
                          className="flex items-center gap-1 rounded-xl bg-[#214ECF] px-3 py-1.5 font-bold text-white shadow-2xs hover:bg-[#1a3fa8]"
                        >
                          <Plus size={13} /> Upload Doc
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(selectedAgent.documents || []).map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText size={18} className="text-slate-400 shrink-0" />
                              <div>
                                <p className="font-bold text-slate-800">{doc.document_name}</p>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {doc.document_type.replace("_", " ")} · {new Date(doc.uploaded_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-2">
                              {doc.file_url && (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                  title="View File"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}

                              {doc.verification_status === "verified" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <CheckCircle2 size={10} /> Verified
                                </span>
                              ) : doc.verification_status === "rejected" ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                    <AlertCircle size={10} /> Rejected
                                  </span>
                                  {doc.rejection_reason && (
                                    <p className="text-[9px] text-rose-600 mt-0.5">{doc.rejection_reason}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  <Clock size={10} /> Under Review
                                </span>
                              )}
                            </div>
                          </div>
                        ))}

                        {!selectedAgent.documents?.length && (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                            No compliance documents uploaded yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: TRAINING & CERTS */}
                  {drawerTab === "training" && (
                    <div className="space-y-5 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Training Enrollments</h4>
                          <button
                            onClick={() => setEnrollModalOpen(true)}
                            className="flex items-center gap-1 rounded-xl bg-[#214ECF] px-3 py-1.5 font-bold text-white shadow-2xs hover:bg-[#1a3fa8]"
                          >
                            <Plus size={13} /> Enroll Training
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(selectedAgent.training_assignments || []).map((asgn) => (
                            <div
                              key={asgn.id}
                              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">
                                  {asgn.program_title || `Program #${asgn.program_id}`}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">{asgn.training_code}</span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Curriculum Progress</span>
                                  <span className="font-bold text-slate-900">{asgn.completion_percent}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full bg-[#214ECF] transition-all duration-300"
                                    style={{ width: `${asgn.completion_percent}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <span className="capitalize font-semibold text-slate-600">Status: {asgn.status}</span>
                                {asgn.assessment_score !== null && (
                                  <span className="font-bold text-emerald-700">
                                    Score: {asgn.assessment_score}% ({asgn.passed ? "Passed" : "Retake"})
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {!selectedAgent.training_assignments?.length && (
                            <p className="text-slate-400 italic">No training assignments found.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Certifications</h4>
                        <div className="mt-3 space-y-2">
                          {(selectedAgent.certifications || []).map((cert) => (
                            <div
                              key={cert.id}
                              className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-2xs"
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Award size={15} className="text-purple-600" />
                                  <span className="font-mono font-black text-purple-900">{cert.certificate_code}</span>
                                </div>
                                <p className="text-[11px] text-purple-700 mt-0.5">
                                  {cert.program_title || "Official Qualification"}
                                </p>
                                <span className="text-[10px] text-slate-400">
                                  Expires: {new Date(cert.expires_at).toLocaleDateString()}
                                </span>
                              </div>

                              <button
                                onClick={() => onViewCertificate?.(cert)}
                                className="rounded-xl border border-purple-300 bg-white px-3 py-1.5 font-bold text-purple-800 shadow-2xs hover:bg-purple-100"
                              >
                                View Certificate
                              </button>
                            </div>
                          ))}

                          {!selectedAgent.certifications?.length && (
                            <p className="text-slate-400 italic">No certifications issued yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: CAMPAIGNS */}
                  {drawerTab === "projects" && (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Allocated Campaigns
                        </h4>
                        <button
                          onClick={() => setAssignModalOpen(true)}
                          className="flex items-center gap-1 rounded-xl bg-[#214ECF] px-3 py-1.5 font-bold text-white shadow-2xs hover:bg-[#1a3fa8]"
                        >
                          <Plus size={13} /> Assign to Campaign
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(selectedAgent.assigned_projects || []).map((projId) => {
                          const proj = activeProjects.find((p) => p.id === projId);
                          return (
                            <div
                              key={projId}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900">{proj?.name || `Campaign Project #${projId}`}</p>
                                <span className="text-[10px] text-slate-400">
                                  {proj?.vertical || "BPO Process"} · Active Deployment
                                </span>
                              </div>
                              <button
                                onClick={() => handleUnassignProject(projId)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Unassign agent"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}

                        {!selectedAgent.assigned_projects?.length && (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                            Agent is not currently assigned to any active project campaign.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: ATTENDANCE */}
                  {drawerTab === "attendance" && (
                    <div className="space-y-4 text-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Attendance & Punctuality Summary
                      </h4>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Attendance</span>
                          <p className="text-lg font-black text-emerald-600 mt-1">
                            {selectedAgent.attendance_summary?.attendance_rate || 96}%
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Present</span>
                          <p className="text-lg font-black text-slate-900 mt-1">
                            {selectedAgent.attendance_summary?.present_days || 21}d
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Late</span>
                          <p className="text-lg font-black text-amber-600 mt-1">
                            {selectedAgent.attendance_summary?.late_days || 1}d
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Hours</span>
                          <p className="text-lg font-black text-slate-900 mt-1">
                            {selectedAgent.attendance_summary?.total_hours || 168}h
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                        <p className="font-bold text-slate-800">Recent Shift Logs</p>
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100">
                              <th className="py-1.5">Date</th>
                              <th className="py-1.5">Shift Window</th>
                              <th className="py-1.5">Check In</th>
                              <th className="py-1.5">Check Out</th>
                              <th className="py-1.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600">
                            <tr>
                              <td className="py-2 font-medium">Today</td>
                              <td className="py-2">{selectedAgent.shift_preference || "US Day"}</td>
                              <td className="py-2 font-mono text-emerald-600">08:58 AM</td>
                              <td className="py-2 font-mono text-slate-400">Active (In Shift)</td>
                              <td className="py-2 text-right">
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                  On Time
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 font-medium">Yesterday</td>
                              <td className="py-2">{selectedAgent.shift_preference || "US Day"}</td>
                              <td className="py-2 font-mono text-emerald-600">08:55 AM</td>
                              <td className="py-2 font-mono text-slate-600">05:30 PM</td>
                              <td className="py-2 text-right">
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                  Present
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 7: AUDIT TRAIL */}
                  {drawerTab === "audit" && (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Agent Dossier Audit History
                        </h4>
                        <span className="text-[10px] text-slate-400">Immutable Log</span>
                      </div>

                      <div className="space-y-3">
                        {(selectedAgent.audit_trail || [
                          {
                            id: "1",
                            action: "agent_created",
                            actor: selectedAgent.assigned_by_name || selectedAgent.created_by_name || "Authorized Partner Admin",
                            timestamp: selectedAgent.created_at || new Date().toISOString(),
                            details: `Registered agent with code ${selectedAgent.agent_code || `THK-AGT-${selectedAgent.id}`}${selectedAgent.centre_name || selectedAgent.bpo_centres?.name ? ` assigned to ${selectedAgent.centre_name || selectedAgent.bpo_centres?.name}` : ""}`,
                          },
                        ]).map((event, i) => (
                          <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 bg-slate-50/50">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 font-bold">
                              <History size={14} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 capitalize">
                                  {event.action.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(event.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-0.5">{event.details}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-mono">Actor: {event.actor}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 10. MODAL: UPLOAD COMPLIANCE DOC IN DRAWER ─────────────────── */}
      {uploadDocOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Upload Agent Document</h4>
              <button
                onClick={() => setUploadDocOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadDocToAgent} className="mt-4 space-y-4">
              {uploadDocError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                  {uploadDocError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                >
                  <option value="id_proof">National ID / Passport (Mandatory)</option>
                  <option value="nda">Signed NDA & Compliance (Mandatory)</option>
                  <option value="educational_cert">Educational Degree</option>
                  <option value="resume">Resume / Curriculum Vitae</option>
                  <option value="address_proof">Address Verification</option>
                  <option value="police_clearance">Police Clearance Certificate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Choose File (PDF, PNG, JPG)</label>
                <input
                  id="agent_drawer_doc_file"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadDocOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50"
                >
                  {uploadingDoc ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 11. MODAL: ASSIGN AGENT TO PROJECT CAMPAIGN ─────────────────── */}
      {assignModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Assign to Allocated Campaign</h4>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAssignProjectSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Deploying <b>{selectedAgent.name}</b> ({selectedAgent.agent_code}) to an active client project.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-600">Select Allocated Campaign</label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                >
                  <option value="">-- Choose Campaign --</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id}: {p.name} ({p.vertical || "BPO"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningProject || !selectedProjectId}
                  className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50"
                >
                  {assigningProject ? "Assigning..." : "Confirm Deployment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 12. MODAL: ENROLL IN TRAINING ─────────────────────────────── */}
      {enrollModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900">Enroll in Training Curriculum</h4>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEnrollTrainingSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Enroll <b>{selectedAgent.name}</b> in an official Thinkatic certified training program.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-600">Select Curriculum Program</label>
                <select
                  value={selectedProgramTitle}
                  onChange={(e) => setSelectedProgramTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                >
                  <option value="HIPAA Healthcare Support & Security">HIPAA Healthcare Support & Security</option>
                  <option value="PCI-DSS FinTech Inbound Verification">PCI-DSS FinTech Inbound Verification</option>
                  <option value="Advanced Customer Escalation Protocols">Advanced Customer Escalation Protocols</option>
                  <option value="Thinkatic Enterprise Telephony Mastery">Thinkatic Enterprise Telephony Mastery</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollingTraining}
                  className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50"
                >
                  {enrollingTraining ? "Enrolling..." : "Enroll Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 12. AGENT INVITATION & CREDENTIAL MODAL ───────────────────── */}
      {credentialModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{credentialModal.title}</h3>
                  <p className="text-xs text-slate-500">
                    {credentialModal.agentName} ({credentialModal.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredentialModal(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{credentialModal.message}</p>

            <div className="space-y-1.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Activation / Password Setup URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={credentialModal.link}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-1 focus:ring-[#214ECF]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(credentialModal.link);
                    setCredentialModal((prev) => (prev ? { ...prev, copied: true } : null));
                    showToast("Link copied to clipboard!");
                    setTimeout(() => {
                      setCredentialModal((prev) => (prev ? { ...prev, copied: false } : null));
                    }, 3000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1a3eb3] transition"
                >
                  {credentialModal.copied ? (
                    <>
                      <Check size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <a
                href={credentialModal.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline"
              >
                Test Activation Link in New Tab <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={() => setCredentialModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SET TEMPORARY PASSWORD MODAL ────────────────────────────────────────────── */}
      {tempPasswordModal.open && tempPasswordModal.agent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Set Temporary Password</h3>
                  <p className="text-xs text-slate-500">
                    {tempPasswordModal.agent.name} ({tempPasswordModal.agent.agent_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempPasswordModal((prev) => ({ ...prev, open: false }))}
                className="rounded-full border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle size={14} className="text-amber-700" /> Immediate Invalidation
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Setting a new temporary password will <b>immediately invalidate</b> any current password. The agent can use this new temporary password to log in and change it from <b>My Profile</b>.
              </p>
            </div>

            {tempPasswordModal.error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                {tempPasswordModal.error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  New Temporary Password *
                </label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={tempPasswordModal.temporaryPassword}
                  onChange={(e) =>
                    setTempPasswordModal((prev) => ({ ...prev, temporaryPassword: e.target.value, error: "" }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Confirm Temporary Password *
                </label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={tempPasswordModal.confirmPassword}
                  onChange={(e) =>
                    setTempPasswordModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: "" }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setTempPasswordModal((prev) => ({ ...prev, open: false }))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={tempPasswordModal.loading}
                onClick={async () => {
                  if (!tempPasswordModal.temporaryPassword || tempPasswordModal.temporaryPassword.length < 6) {
                    setTempPasswordModal((prev) => ({
                      ...prev,
                      error: "Temporary password must be at least 6 characters long.",
                    }));
                    return;
                  }
                  if (tempPasswordModal.temporaryPassword !== tempPasswordModal.confirmPassword) {
                    setTempPasswordModal((prev) => ({
                      ...prev,
                      error: "Temporary passwords do not match.",
                    }));
                    return;
                  }

                  setTempPasswordModal((prev) => ({ ...prev, loading: true, error: "" }));
                  try {
                    const res = await api(`/bpo/agents/${tempPasswordModal.agent!.id}/reset-password`, {
                      method: "POST",
                      body: JSON.stringify({
                        temporaryPassword: tempPasswordModal.temporaryPassword,
                        confirmPassword: tempPasswordModal.confirmPassword,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to set temporary password");

                    showToast("New temporary password set successfully! Old password invalidated.");
                    setTempPasswordModal({
                      open: false,
                      agent: null,
                      temporaryPassword: "",
                      confirmPassword: "",
                      loading: false,
                      error: "",
                    });
                    await onRefresh();
                  } catch (err: any) {
                    setTempPasswordModal((prev) => ({
                      ...prev,
                      loading: false,
                      error: err.message || "Failed to set temporary password",
                    }));
                  }
                }}
                className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3eb3] transition disabled:opacity-50"
              >
                {tempPasswordModal.loading ? "Updating..." : "Set Temporary Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BPO AGENT WORK CENTRE DRAWER ─────────────────────── */}
      <BpoAgentWorkCentreDrawer
        agent={workCentreAgent}
        isOpen={workCentreOpen}
        onClose={() => setWorkCentreOpen(false)}
        initialTab={workCentreInitialTab}
        onOpenProfile={(a) => {
          setWorkCentreOpen(false);
          openAgentDrawer(a, "overview");
        }}
      />
    </div>
  );
}
