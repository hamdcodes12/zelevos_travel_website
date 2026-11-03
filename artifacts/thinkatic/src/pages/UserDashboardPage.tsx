import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  Layers,
  BarChart3,
  Bell,
  Ticket,
  Clock,
  ShieldCheck,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Eye,
  Download,
  Send,
  Lock,
  Unlock,
  Copy,
  ExternalLink,
  ChevronRight,
  Check,
  AlertTriangle,
  Building2,
  User,
  Phone,
  Globe,
  CreditCard,
  Sparkles,
  Menu,
  FileCheck,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  HelpCircle,
  Key,
  Receipt,
  Printer,
  Loader2,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import PayPalButton from "@/components/ui/PayPalButton";
import BankTransferPaymentSection from "@/components/payment/BankTransferPaymentSection";
import ClientReceiptViewerModal, { ClientReceipt } from "@/components/client/ClientReceiptViewerModal";
import ClientPaymentHistorySection from "@/components/client/ClientPaymentHistorySection";

// ── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  selectedPlan: string | null;
  companyName?: string;
  phone?: string;
  country?: string;
  businessDetails?: Record<string, any>;
  bpoApplicationDetails?: Record<string, any>;
  createdAt: string;
}

interface Plan {
  id: number;
  serviceId: string;
  serviceNumber: string;
  category: string;
  name: string;
  serviceName?: string;
  tier?: string;
  price: number;
  priceDisplay?: string;
  priceMax?: number | null;
  billingInterval?: string;
  deliveryTimeline?: string;
  supportDuration?: string;
  targetCustomer?: string;
  tag?: string;
  description: string;
  features: string[];
  pricingType?: "fixed" | "range" | "custom";
  popular?: boolean;
  isBpo?: boolean;
  status?: "DRAFT" | "WAITING" | "PUBLISHED" | "ARCHIVED";
  paymentEnabled?: boolean;
  clientVisible?: boolean;
}

interface ActivePlanDetails {
  serviceId: string;
  serviceName: string;
  category: string;
  tier: string;
  priceDisplay: string;
  deliveryTimeline?: string;
  supportDuration?: string;
  billingInterval?: string;
  features?: string[];
  targetCustomer?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  paymentStatus: "paid" | "pending";
  activatedAt?: string;
  amountPaid?: number;
  paypalOrderId?: string;
  paypalCaptureId?: string;
}

interface ClientUpdate {
  id: number;
  title: string;
  message: string;
  category: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  ticket_messages: Array<{ id: number; body: string; author_admin_id: number | null; is_internal: boolean; created_at: string }>;
  ticket_attachments: Array<{ id: number; file_name: string; content_type: string }>;
}

interface Project {
  id: number;
  name: string;
  project_type?: string;
  vertical?: string;
  description?: string;
  requirements?: string;
  target_geography?: string;
  shift?: string;
  required_seats?: number;
  headcount?: number;
  status: string;
  progress_percent?: number;
  start_date?: string;
  expected_end_date?: string;
  assigned_bpo?: string;
  assigned_bpo_name?: string;
  bpo_partner?: { id: string; name: string; partner_code: string };
  bpo_centre?: { id: number; centre_name: string; centre_code: string };
  allocated_partner_id?: string;
  allocated_centre_id?: number;
  project_milestones?: Array<{ id: number; name: string; status: string; completion_percent: number; due_date: string | null }>;
  project_tasks?: Array<{ id: number; name: string; status: string; priority: string; due_date: string | null }>;
  project_deliverables?: Array<{ id: number; name: string; status: string }>;
  project_activity?: Array<{ id: number; description: string; created_at: string }>;
}

interface ProjectNotification {
  id: number;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  read_at: string | null;
  created_at: string;
}

interface ClientDocument {
  id: number;
  project_id: number | null;
  category: string;
  original_file_name: string;
  file_name?: string;
  file_size: number;
  status: string;
  uploaded_by: string;
  created_at: string;
}

interface ClientConversation {
  id: number;
  project_id: number;
  subject: string;
  messages: Array<{
    id: number;
    body: string;
    sender_user_id: string | null;
    sender_admin_id: number | null;
    read: boolean;
    created_at: string;
    attachments?: Array<{ id: number; file_name: string }>;
  }>;
}

interface ClientMeeting {
  id: number;
  project_id: number | null;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  location?: string;
  meeting_link?: string;
  meeting_password_encrypted?: string;
  rsvp_status?: string;
}

interface ClientInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  pdf_url?: string | null;
  items?: Array<{ id: number; description: string; quantity: number; unit_price: number; line_total: number }>;
}

interface AttendanceRecord {
  id: number | string;
  date: string;
  project?: string;
  projectName?: string;
  centreName?: string;
  partnerName?: string;
  durationMinutes: number;
  status: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

interface KycRecord {
  id: number;
  status: "unsubmitted" | "pending" | "under_review" | "approved" | "verified" | "rejected" | "changes_requested";
  fullName?: string;
  legal_name?: string;
  tax_id?: string;
  document_type?: string;
  rejectionReason?: string;
  rejection_reason?: string;
  submittedAt?: string;
  submitted_at?: string;
}

export type ClientTab =
  | "overview"
  | "projects"
  | "meetings"
  | "billing"
  | "documents"
  | "communications"
  | "plans"
  | "reports"
  | "updates"
  | "tickets"
  | "attendance"
  | "kyc"
  | "profile";

const LEGACY_PLAN_NAMES = new Set([
  "ai-launch",
  "ai-transformation",
  "enterprise-ai",
  "ai launch",
  "ai transformation",
  "enterprise ai",
]);

export default function UserDashboardPage() {
  const [, setLocation] = useLocation();
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Prevent document/body from vertically scrolling while inside Client Portal application shell
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // 13 Final Authoritative Tabs
  const [tab, setTab] = useState<ClientTab>("overview");

  // Reset main scroll position to top when navigating between client portal tabs
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [tab]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile & Auth
  const token = localStorage.getItem("user_token");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileCompanyName, setProfileCompanyName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profileBusinessDetails, setProfileBusinessDetails] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security / Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Data Collections
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [planToConfirm, setPlanToConfirm] = useState<Plan | null>(null);
  const [activatingPlan, setActivatingPlan] = useState(false);
  const [activePlanDetails, setActivePlanDetails] = useState<ActivePlanDetails | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState<boolean>(false);

  // Review Order & Checkout Modal State
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethodTab, setPaymentMethodTab] = useState<"paypal" | "bank">("paypal");

  // Section 23 Payment Success Modal State
  const [paymentSuccessModalOpen, setPaymentSuccessModalOpen] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    orderId?: string;
    captureId?: string;
    packageName: string;
    totalPaid: string;
    invoiceNumber: string;
  } | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Project Creation Modal & Gate State
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    vertical: "Customer Support",
    description: "",
    requiredSeats: 5,
    shift: "Day Shift",
    targetGeography: "Global",
    requirements: "",
    startDate: "",
    expectedEndDate: "",
  });

  const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<ClientMeeting | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    projectId: "",
    title: "",
    startTime: "",
    endTime: "",
    description: "",
    meetingLink: "",
  });
  const [submittingMeeting, setSubmittingMeeting] = useState(false);

  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [billingPayments, setBillingPayments] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ClientReceipt | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentCategory, setDocumentCategory] = useState("all");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [conversations, setConversations] = useState<ClientConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ClientConversation | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [updates, setUpdates] = useState<ClientUpdate[]>([]);
  const [notifications, setNotifications] = useState<ProjectNotification[]>([]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketForm, setTicketForm] = useState({ subject: "", category: "General Support", priority: "medium", description: "" });
  const [ticketReply, setTicketReply] = useState<Record<number, string>>({});
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketReplyDraft, setTicketReplyDraft] = useState("");
  const [sendingTicketReply, setSendingTicketReply] = useState(false);

  // Meeting passcode reveal state
  const [meetingPasswords, setMeetingPasswords] = useState<Record<number, string>>({});
  const [loadingMeetingPasswordId, setLoadingMeetingPasswordId] = useState<number | null>(null);

  // New Client Conversation state
  const [newClientConversationModalOpen, setNewClientConversationModalOpen] = useState(false);
  const [newClientConversationProjectId, setNewClientConversationProjectId] = useState<number | null>(null);
  const [newClientConversationSubject, setNewClientConversationSubject] = useState("");
  const [creatingClientConversation, setCreatingClientConversation] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [kycForm, setKycForm] = useState({
    fullName: "",
    legalName: "",
    taxId: "",
    documentType: "Business License",
    documentNumber: "",
    documentFrontUrl: "",
  });

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  }, []);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const currentToken = localStorage.getItem("user_token");
      if (!currentToken) {
        setLocation("/login");
        throw new Error("Not authenticated");
      }
      const res = await fetch(`/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
          ...(options.headers || {}),
        },
      });
      if (res.status === 401) {
        localStorage.removeItem("user_token");
        setLocation("/login");
        throw new Error("Session expired");
      }
      return res;
    },
    [setLocation]
  );

  // Load All Authoritative Data
  const loadAllData = useCallback(async () => {
    if (!token) {
      setLocation("/login");
      return;
    }
    try {
      setLoading(true);

      // Core profile, plans, KYC, and settings
      const [profRes, plansRes, kycRes, projRes, notifRes, invRes, payRes, docRes, convRes, meetRes, updRes, tickRes, attRes, activePlanRes, rcptRes] =
        await Promise.allSettled([
          authFetch("/user/profile"),
          authFetch("/plans"),
          authFetch("/user/kyc"),
          authFetch("/projects"),
          authFetch("/user/notifications"),
          authFetch("/invoices"),
          authFetch("/billing/payments"),
          authFetch("/documents"),
          authFetch("/conversations"),
          authFetch("/meetings"),
          authFetch("/user/updates"),
          authFetch("/tickets"),
          authFetch("/user/attendance"),
          authFetch("/user/active-plan"),
          authFetch("/receipts"),
        ]);

      if (profRes.status === "fulfilled" && profRes.value.ok) {
        const pData = await profRes.value.json();
        setProfile(pData);
        setProfileFullName(pData.fullName || "");
        const meta = pData.bpoApplicationDetails || {};
        setProfileCompanyName(meta.companyName || meta.company || "");
        setProfilePhone(meta.phone || "");
        setProfileCountry(meta.country || "");
        setProfileBusinessDetails(meta.businessDetails ? JSON.stringify(meta.businessDetails, null, 2) : "");
      }

      if (plansRes.status === "fulfilled" && plansRes.value.ok) {
        const rawPlans = await plansRes.value.json();
        setPlans(Array.isArray(rawPlans) ? rawPlans : []);
        setPlansError(null);
      } else {
        setPlansError("Unable to load Services & Plans");
      }

      if (kycRes.status === "fulfilled" && kycRes.value.ok) {
        const kData = await kycRes.value.json();
        setKyc(kData);
      }

      if (projRes.status === "fulfilled" && projRes.value.ok) {
        const prData = await projRes.value.json();
        setProjects(Array.isArray(prData) ? prData : prData.data || []);
      }

      if (notifRes.status === "fulfilled" && notifRes.value.ok) {
        const nData = await notifRes.value.json();
        setNotifications(Array.isArray(nData) ? nData : nData.data || []);
      }

      if (invRes.status === "fulfilled" && invRes.value.ok) {
        const iData = await invRes.value.json();
        setInvoices(Array.isArray(iData) ? iData : iData.invoices || []);
      }

      if (payRes.status === "fulfilled" && payRes.value.ok) {
        const payData = await payRes.value.json();
        setBillingPayments(Array.isArray(payData) ? payData : payData.payments || []);
      }

      if (docRes.status === "fulfilled" && docRes.value.ok) {
        const dData = await docRes.value.json();
        setDocuments(Array.isArray(dData) ? dData : dData.documents || []);
      }

      if (convRes.status === "fulfilled" && convRes.value.ok) {
        const cData = await convRes.value.json();
        setConversations(Array.isArray(cData) ? cData : cData.conversations || []);
      }

      if (meetRes.status === "fulfilled" && meetRes.value.ok) {
        const mData = await meetRes.value.json();
        setMeetings(Array.isArray(mData) ? mData : mData.meetings || []);
      }

      if (updRes.status === "fulfilled" && updRes.value.ok) {
        const uData = await updRes.value.json();
        setUpdates(Array.isArray(uData) ? uData : uData.data || []);
      }

      if (tickRes.status === "fulfilled" && tickRes.value.ok) {
        const tData = await tickRes.value.json();
        setTickets(Array.isArray(tData) ? tData : tData.tickets || []);
      }

      if (attRes.status === "fulfilled" && attRes.value.ok) {
        const aData = await attRes.value.json();
        const records = Array.isArray(aData) ? aData : aData.records || aData.data || [];
        setAttendance(records);
      }

      if (activePlanRes.status === "fulfilled" && activePlanRes.value.ok) {
        const apData = await activePlanRes.value.json();
        setHasActivePlan(Boolean(apData.hasActivePlan));
        setActivePlanDetails(apData.activePlan || null);
        if (apData.hasActivePlan && apData.activePlan?.serviceId) {
          setProfile((prev) => (prev ? { ...prev, selectedPlan: apData.activePlan.serviceId } : null));
        }
      }

      if (rcptRes && rcptRes.status === "fulfilled" && rcptRes.value.ok) {
        const rcptData = await rcptRes.value.json();
        const list = Array.isArray(rcptData) ? rcptData : rcptData.receipts || rcptData.data || [];
        setReceipts(list);
      }
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, authFetch, setLocation]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Check URL for PayPal payment return (?payment=success&package=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") === "success") {
      const pkg = urlParams.get("package") || "";
      // Clean query parameter from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      authFetch("/user/active-plan")
        .then((res) => res.json())
        .then((data) => {
          if (data.hasActivePlan && data.activePlan) {
            setHasActivePlan(true);
            setActivePlanDetails(data.activePlan);
            setProfile((prev) => (prev ? { ...prev, selectedPlan: data.activePlan.serviceId } : null));
            setPaymentSuccessData({
              orderId: data.activePlan.paypalOrderId || "PAYPAL-ORDER-VERIFIED",
              captureId: data.activePlan.paypalCaptureId || "PAYPAL-CAPTURE-PAID",
              packageName: data.activePlan.serviceName || pkg,
              totalPaid: data.activePlan.priceDisplay || "PAID",
              invoiceNumber: data.activePlan.invoiceNumber || "INV-FINALIZED",
            });
            setPaymentSuccessModalOpen(true);
          }
        })
        .catch(() => {});
    }

    // Auto-open checkout modal if arriving with ?package=... or ?purchase=...
    const targetPkg = urlParams.get("package") || urlParams.get("purchase");
    if (targetPkg && plans.length > 0) {
      const match = plans.find(
        (p: any) =>
          p.serviceId === targetPkg ||
          p.packageSlug === targetPkg ||
          p.slug === targetPkg ||
          String(p.id) === targetPkg
      );
      if (match) {
        setCheckoutPlan(match);
        setCheckoutModalOpen(true);
        setTab("plans");
      }
    }
  }, [authFetch, plans]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_profile");
    sessionStorage.clear();
    setLocation("/");
  };

  // Plan Activation handler - opens checkout modal with authoritative PayPal integration
  const handleActivatePlan = (plan: Plan) => {
    setCheckoutPlan(plan);
    setCheckoutModalOpen(true);
  };

  // Project Submission with Gating
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const isKycApproved = kyc?.status === "approved" || kyc?.status === "verified";

    if (!hasActivePlan) {
      showToast("error", "An active paid plan is required before submitting a project. Please select and checkout a package.");
      setTab("plans");
      setCreateProjectModalOpen(false);
      return;
    }

    if (!isKycApproved) {
      showToast("error", "Complete KYC verification before submitting a project.");
      setTab("kyc");
      setCreateProjectModalOpen(false);
      return;
    }

    try {
      setSubmittingProject(true);
      const res = await authFetch("/projects", {
        method: "POST",
        body: JSON.stringify(projectForm),
      });
      if (res.ok) {
        showToast("success", "Project submitted successfully to Thinkatic Admin for BPO allocation.");
        setCreateProjectModalOpen(false);
        setProjectForm({
          name: "",
          vertical: "Customer Support",
          description: "",
          requiredSeats: 5,
          shift: "Day Shift",
          targetGeography: "Global",
          requirements: "",
          startDate: "",
          expectedEndDate: "",
        });
        await loadAllData();
      } else {
        const data = await res.json();
        showToast("error", data.message || data.error || "Project creation failed");
      }
    } catch (e: any) {
      showToast("error", "Failed to submit project");
    } finally {
      setSubmittingProject(false);
    }
  };

  // Meeting Creation
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingMeeting(true);
      const res = await authFetch("/meetings", {
        method: "POST",
        body: JSON.stringify({
          projectId: meetingForm.projectId ? Number(meetingForm.projectId) : undefined,
          title: meetingForm.title,
          startTime: meetingForm.startTime,
          endTime: meetingForm.endTime || undefined,
          description: meetingForm.description,
          meetingLink: meetingForm.meetingLink || undefined,
        }),
      });
      if (res.ok) {
        showToast("success", "Meeting request sent to Thinkatic Admin team.");
        setMeetingModalOpen(false);
        setMeetingForm({
          projectId: "",
          title: "",
          startTime: "",
          endTime: "",
          description: "",
          meetingLink: "",
        });
        await loadAllData();
      } else {
        const data = await res.json();
        showToast("error", data.error || "Failed to schedule meeting");
      }
    } catch (e) {
      showToast("error", "Error creating meeting");
    } finally {
      setSubmittingMeeting(false);
    }
  };

  // Document Upload (Base64 JSON to match api-server parseUpload)
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDoc(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string) || "";
          const res = await authFetch("/documents", {
            method: "POST",
            body: JSON.stringify({
              file: {
                fileName: file.name,
                contentType: file.type || "application/pdf",
                data: base64Data,
              },
              category: "Project Document",
            }),
          });
          if (res.ok) {
            showToast("success", "Document uploaded securely.");
            await loadAllData();
          } else {
            const data = await res.json().catch(() => ({}));
            showToast("error", data.error || data.message || "Failed to upload document");
          }
        } catch {
          showToast("error", "Failed to upload document");
        } finally {
          setUploadingDoc(false);
          e.target.value = "";
        }
      };
      reader.onerror = () => {
        showToast("error", "Error reading file");
        setUploadingDoc(false);
        e.target.value = "";
      };
      reader.readAsDataURL(file);
    } catch {
      showToast("error", "Upload error");
      setUploadingDoc(false);
    }
  };

  // Meeting Passcode Reveal (Secure Decryption via API)
  const handleRevealMeetingPassword = async (meetingId: number) => {
    try {
      setLoadingMeetingPasswordId(meetingId);
      const res = await authFetch(`/meetings/${meetingId}/password`);
      if (res.ok) {
        const data = await res.json();
        setMeetingPasswords((prev) => ({ ...prev, [meetingId]: data.password || "No passcode required" }));
        showToast("success", "Meeting credentials retrieved.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || data.message || "Failed to retrieve meeting passcode");
      }
    } catch {
      showToast("error", "Error contacting server");
    } finally {
      setLoadingMeetingPasswordId(null);
    }
  };

  // Chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageDraft.trim() || !selectedConversation) return;
    try {
      setSendingMessage(true);
      const res = await authFetch(`/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: messageDraft }),
      });
      if (res.ok) {
        setMessageDraft("");
        await loadAllData();
      }
    } catch {
      showToast("error", "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  // Start New Client Project Conversation
  const handleCreateClientConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientConversationSubject.trim()) return;
    try {
      setCreatingClientConversation(true);
      const res = await authFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({
          projectId: newClientConversationProjectId ? Number(newClientConversationProjectId) : undefined,
          subject: newClientConversationSubject.trim(),
        }),
      });
      if (res.ok) {
        const conv = await res.json();
        showToast("success", "Project conversation initialized.");
        setNewClientConversationModalOpen(false);
        setNewClientConversationSubject("");
        setNewClientConversationProjectId(null);
        await loadAllData();
        if (conv?.id) setSelectedConversation(conv);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.error || err.message || "Failed to create conversation");
      }
    } catch {
      showToast("error", "Error creating conversation");
    } finally {
      setCreatingClientConversation(false);
    }
  };

  // Ticket creation
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingTicket(true);
      const res = await authFetch("/tickets", {
        method: "POST",
        body: JSON.stringify(ticketForm),
      });
      if (res.ok) {
        showToast("success", "Ticket submitted to Support Desk.");
        setTicketForm({ subject: "", category: "General Support", priority: "medium", description: "" });
        await loadAllData();
      } else {
        showToast("error", "Failed to create ticket");
      }
    } catch {
      showToast("error", "Ticket creation error");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Send Ticket Reply
  const handleSendTicketReply = async (ticketId: number) => {
    if (!ticketReplyDraft.trim()) return;
    try {
      setSendingTicketReply(true);
      const res = await authFetch(`/tickets/${ticketId}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: ticketReplyDraft.trim() }),
      });
      if (res.ok) {
        showToast("success", "Response submitted to support ticket.");
        setTicketReplyDraft("");
        await loadAllData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || data.message || "Failed to post reply");
      }
    } catch {
      showToast("error", "Failed to submit ticket reply");
    } finally {
      setSendingTicketReply(false);
    }
  };

  // KYC Submission
  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingKyc(true);
      const res = await authFetch("/user/kyc", {
        method: "POST",
        body: JSON.stringify({
          fullName: kycForm.fullName || profile?.fullName,
          legalName: kycForm.legalName,
          taxId: kycForm.taxId,
          documentType: kycForm.documentType,
          documentNumber: kycForm.documentNumber,
          documentFrontUrl: kycForm.documentFrontUrl,
        }),
      });
      if (res.ok) {
        showToast("success", "KYC submitted. Our compliance team will review your application.");
        await loadAllData();
      } else {
        showToast("error", "Failed to submit KYC");
      }
    } catch {
      showToast("error", "KYC submission error");
    } finally {
      setSubmittingKyc(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await authFetch("/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: profileFullName,
          companyName: profileCompanyName,
          phone: profilePhone,
          country: profileCountry,
        }),
      });
      if (res.ok) {
        showToast("success", "Account details updated successfully.");
        await loadAllData();
      } else {
        showToast("error", "Failed to save profile changes");
      }
    } catch {
      showToast("error", "Profile update error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New password and confirm password do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }
    try {
      setChangingPassword(true);
      const res = await authFetch("/user/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        setPasswordMsg({ type: "error", text: data.error || "Failed to update password." });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Error contacting authentication server." });
    } finally {
      setChangingPassword(false);
    }
  };

  // Filter Categories for Plans with dynamic exact counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: plans.length,
      BUILD: 0,
      AI: 0,
      AUTOMATE: 0,
      SCALE: 0,
      OPERATE: 0,
    };
    for (const p of plans) {
      const cat = (p.category || "").toUpperCase();
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [plans]);

  const categories = useMemo(() => {
    return ["ALL", "BUILD", "AI", "AUTOMATE", "SCALE", "OPERATE"];
  }, []);

  const filteredPlans = useMemo(() => {
    if (selectedCategory.toUpperCase() === "ALL") return plans;
    return plans.filter((p) => (p.category || "").toUpperCase() === selectedCategory.toUpperCase());
  }, [plans, selectedCategory]);

  // Financial calculations
  const totalBilled = useMemo(() => invoices.reduce((s, i) => s + Number(i.total || 0), 0), [invoices]);
  const totalPaid = useMemo(() => invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0), [invoices]);
  const balanceDue = useMemo(() => invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0), [invoices]);

  // Greeting
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const unreadNotifCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  type NavItem = {
    id: ClientTab;
    label: string;
    icon: any;
    badge?: string | number | undefined;
  };

  // Navigation Items (Exact 13 tabs, NO affiliate, NO wallet)
  const navItems: NavItem[] = [
    { id: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban, badge: projects.length || undefined },
    { id: "meetings", label: "Meetings", icon: Calendar, badge: meetings.filter((m) => ["scheduled", "confirmed"].includes(m.status)).length || undefined },
    { id: "billing", label: "Billing & Invoices", icon: DollarSign, badge: invoices.filter((i) => ["overdue", "pending_payment", "partially_paid", "sent"].includes(i.status)).length || undefined },
    { id: "documents", label: "Documents", icon: FileText, badge: documents.length || undefined },
    { id: "communications", label: "Project Chat", icon: MessageSquare, badge: conversations.length || undefined },
    { id: "plans", label: "Services & Plans", icon: Layers, badge: plans.length || undefined },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "updates", label: "Your Updates", icon: AlertCircle, badge: updates.length || undefined },
    { id: "tickets", label: "Support Tickets", icon: Ticket, badge: tickets.length || undefined },
    // { id: "attendance", label: "Attendance & Shift", icon: Clock },
    {
      id: "kyc",
      label: "KYC Verification",
      icon: ShieldCheck,
      badge: kyc?.status === "approved" || kyc?.status === "verified" ? "Approved" : kyc?.status === "pending" || kyc?.status === "under_review" ? "Under Review" : "Required",
    },
    { id: "profile", label: "Account Settings", icon: Settings },
  ];

  const tabTitles: Record<ClientTab, string> = {
    overview: "Dashboard Overview",
    projects: "Project Operations",
    meetings: "Executive & Project Meetings",
    billing: "Billing & Invoices",
    documents: "Secure Documents",
    communications: "Project Chat & Support",
    plans: "Services & Technology Plans",
    reports: "Operations & Financial Reports",
    updates: "Thinkatic Admin Updates",
    tickets: "Enterprise Support Desk",
    attendance: "Workforce Attendance & Shift Reporting",
    kyc: "Identity & Corporate KYC Verification",
    profile: "Client Account & Security Settings",
  };

  return (
    <div className="client-portal h-screen h-[100dvh] max-h-screen min-h-screen flex overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* ── DESKTOP SIDEBAR (Permanently fixed in viewport, independent internal navigation scroll) ── */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col py-6 px-3.5 bg-white border-r border-slate-200/80 h-full max-h-screen overflow-hidden z-30 sticky top-0">
        <div className="px-2 mb-6 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <BrandLogo compact />
          </div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#214ECF]">Client Portal</div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1 scrollbar-none min-h-0">
          {navItems.map(({ id, label, icon: Icon, badge }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id as ClientTab)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left w-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#214ECF] text-white shadow-sm shadow-[#214ECF]/20 font-bold"
                    : "text-slate-700 bg-transparent border-l-4 border-l-transparent hover:border-l-[#214ECF] hover:bg-blue-50/70 hover:text-[#214ECF] hover:translate-x-1"
                }`}
              >
                <Icon size={16} className={`transition-colors flex-shrink-0 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                <span className="truncate">{label}</span>
                {badge && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white text-[#214ECF]"
                        : badge === "Approved"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : badge === "Required"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-blue-50 text-[#214ECF] border border-blue-100"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 mt-auto border-t border-slate-200/80 shrink-0">
          <div className="px-3 py-2 text-xs text-slate-500">
            Signed in as <span className="font-semibold text-slate-800">{profile?.fullName || "Client"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold w-full text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={15} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-white z-50 flex flex-col py-6 px-4 shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between px-2 mb-6">
                <div className="flex items-center gap-2">
                  <BrandLogo compact />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
                {navItems.map(({ id, label, icon: Icon, badge }) => {
                  const isActive = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setTab(id as ClientTab);
                        setMobileNavOpen(false);
                      }}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left w-full transition-all duration-200 ${
                        isActive
                          ? "bg-[#214ECF] text-white shadow-sm shadow-[#214ECF]/20 font-bold"
                          : "text-slate-700 bg-transparent border-l-4 border-l-transparent hover:border-l-[#214ECF] hover:bg-blue-50/70 hover:text-[#214ECF]"
                      }`}
                    >
                      <Icon size={16} className={`transition-colors flex-shrink-0 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                      <span className="truncate">{label}</span>
                      {badge && (
                        <span
                          className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? "bg-white text-[#214ECF]" : "bg-blue-50 text-[#214ECF]"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT CONTAINER (Independent vertical scroll container) ── */}
      <div
        ref={mainScrollRef}
        className="flex-1 flex flex-col min-w-0 min-h-0 h-full max-h-screen overflow-y-auto overflow-x-hidden bg-slate-50"
      >
        {/* Top Header — Sticky at top of main scroll area */}
        <header className="h-16 px-4 sm:px-8 border-b border-slate-200/80 bg-white sticky top-0 z-20 flex items-center justify-between gap-4 shadow-2xs shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="h-9 w-9 flex items-center justify-center -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden cursor-pointer shrink-0"
              title="Open navigation menu"
            >
              <Menu size={18} className="text-[#214ECF] shrink-0" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight truncate leading-none">
                  {tabTitles[tab] || "Client Portal"}
                </h1>
                <span className="hidden sm:inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 text-slate-600 border border-slate-200 leading-none">
                  ID: {profile?.id?.slice(0, 8)}...
                </span>
                <span className="hidden sm:inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none">
                  Active Client
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-[#214ECF] rounded-xl hover:bg-blue-50/60 border border-slate-200 transition-colors shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw size={15} className={`shrink-0 ${refreshing ? "animate-spin text-[#214ECF]" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setTab("updates")}
              className="relative h-9 w-9 flex items-center justify-center text-slate-500 hover:text-[#214ECF] rounded-xl hover:bg-blue-50/60 border border-slate-200 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Admin Updates"
              aria-label="Admin Updates"
            >
              <Bell size={15} className="shrink-0" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#214ECF] px-1 text-[9px] font-bold text-white ring-2 ring-white pointer-events-none select-none">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <div className="h-6 w-px bg-slate-200 shrink-0" />

            <div className="flex items-center gap-2 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100 flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0 select-none">
                {profile?.fullName ? profile.fullName.charAt(0) : "C"}
              </div>
              <div className="hidden lg:flex flex-col justify-center text-left min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate leading-tight">{profile?.fullName || "Client"}</div>
                <div className="text-[10px] text-slate-400 truncate leading-tight">{profile?.email}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:flex h-9 items-center justify-center gap-1.5 px-3 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200 cursor-pointer shrink-0 leading-none"
            >
              <LogOut size={13} className="shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full">
          <AnimatePresence mode="wait">
            {actionMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium shadow-xs ${
                  actionMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {actionMessage.type === "success" ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: DASHBOARD OVERVIEW                                        */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Hero Banner with local time greeting */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#214ECF] mb-1">
                    {greeting}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Welcome back, {profile?.fullName || "Enterprise Client"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Client ID: <span className="font-mono text-slate-700">{profile?.id}</span> · Status:{" "}
                    <span className="text-emerald-600 font-semibold">Active Client</span>
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCreateProjectModalOpen(true)}
                    className="px-4 py-2.5 bg-[#214ECF] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Submit New Project
                  </button>
                  <button
                    onClick={() => setTab("plans")}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    View Services & Plans
                  </button>
                </div>
              </div>

              {/* Project Gate Guidance Banner (if no plan or KYC pending) */}
              {(!hasActivePlan || !(kyc?.status === "approved" || kyc?.status === "verified")) && (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-900 block">Project Submission Gate</span>
                      <span className="text-amber-700">
                        {!hasActivePlan
                          ? "Please select and activate an authoritative plan before submitting a project."
                          : "Complete corporate KYC verification before submitting a project."}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab(!hasActivePlan ? "plans" : "kyc")}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700 transition-colors shrink-0 cursor-pointer"
                  >
                    {!hasActivePlan ? "Browse 24 Plans & Checkout →" : "Verify Corporate KYC →"}
                  </button>
                </div>
              )}

              {/* 7 Authoritative KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Active Plan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Plan</span>
                    <Layers size={16} className="text-[#214ECF]" />
                  </div>
                  <div className="text-base font-bold text-slate-900 truncate">
                    {hasActivePlan && activePlanDetails
                      ? activePlanDetails.serviceName
                      : profile?.selectedPlan
                      ? profile.selectedPlan.toUpperCase()
                      : "No Plan Activated"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span className={hasActivePlan ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {hasActivePlan
                        ? `✓ ${activePlanDetails?.category || 'Active'} · ${activePlanDetails?.tier || 'Paid'}`
                        : "Payment Required"}
                    </span>
                    <button onClick={() => setTab("plans")} className="text-[#214ECF] font-semibold hover:underline cursor-pointer">
                      {hasActivePlan ? "View Catalog →" : "Choose Plan →"}
                    </button>
                  </div>
                </div>

                {/* 2. Active Projects */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Projects</span>
                    <FolderKanban size={16} className="text-[#214ECF]" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {projects.filter((p) => ["active", "in_progress", "open", "approved"].includes(p.status.toLowerCase())).length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{projects.length} Total Projects</span>
                    <button onClick={() => setTab("projects")} className="text-[#214ECF] font-semibold hover:underline">
                      View →
                    </button>
                  </div>
                </div>

                {/* 3. Open Notifications */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin Notices</span>
                    <Bell size={16} className="text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{unreadNotifCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{notifications.length} Total Notices</span>
                    <button onClick={() => setTab("updates")} className="text-indigo-600 font-semibold hover:underline">
                      Review →
                    </button>
                  </div>
                </div>

                {/* 4. Balance Due */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Balance Due</span>
                    <DollarSign size={16} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    ${balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Billed: ${totalBilled.toFixed(0)}</span>
                    <button onClick={() => setTab("billing")} className="text-amber-600 font-semibold hover:underline">
                      Invoices →
                    </button>
                  </div>
                </div>

                {/* 5. Scheduled Meetings */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Meetings</span>
                    <Calendar size={16} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {meetings.filter((m) => ["scheduled", "confirmed"].includes(m.status)).length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Upcoming executive calls</span>
                    <button onClick={() => setTab("meetings")} className="text-[#214ECF] font-semibold hover:underline">
                      Schedule →
                    </button>
                  </div>
                </div>

                {/* 6. KYC Status */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">KYC Status</span>
                    <ShieldCheck size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-base font-bold capitalize text-slate-900">
                    {kyc?.status === "approved" || kyc?.status === "verified"
                      ? "Approved & Verified"
                      : kyc?.status === "pending" || kyc?.status === "under_review"
                      ? "Under Review"
                      : "Action Required"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{kyc?.status === "approved" || kyc?.status === "verified" ? "100% Compliant" : "Verification Needed"}</span>
                    <button onClick={() => setTab("kyc")} className="text-emerald-600 font-semibold hover:underline">
                      View →
                    </button>
                  </div>
                </div>

                {/* 7. Tickets */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs sm:col-span-2">
                  <div className="flex items-center justify-between mb-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Support Desk</span>
                    <Ticket size={16} className="text-[#214ECF]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-black text-slate-900">
                        {tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Open support requests with SLA tracking</div>
                    </div>
                    <button onClick={() => setTab("tickets")} className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#214ECF] text-xs font-bold hover:bg-blue-100">
                      Open Tickets →
                    </button>
                  </div>
                </div>
              </div>

              {/* MAIN DASHBOARD: Section A & B */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section A: Current Active Projects */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Current Active Projects</h3>
                    <button onClick={() => setTab("projects")} className="text-xs font-semibold text-[#214ECF] hover:underline">
                      All Projects ({projects.length})
                    </button>
                  </div>
                  {projects.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No active projects yet. Click "Submit New Project" to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {projects.slice(0, 3).map((proj) => (
                        <div key={proj.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900">{proj.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF] uppercase">
                              {proj.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                            <span>BPO: <strong>{proj.assigned_bpo_name || (proj.bpo_partner ? proj.bpo_partner.name : "Pending Allocation")}</strong></span>
                            <span>Seats: <strong>{proj.required_seats || proj.headcount || 0}</strong></span>
                            <span>Progress: <strong>{proj.progress_percent || 0}%</strong></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-[#214ECF] rounded-full" style={{ width: `${proj.progress_percent || 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section B: Notifications from Admin */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Recent Admin Notices</h3>
                    <button
                      onClick={async () => {
                        await authFetch("/user/notifications/read-all", { method: "POST" });
                        setNotifications((items) => items.map((i) => ({ ...i, read_at: new Date().toISOString() })));
                      }}
                      className="text-xs font-semibold text-[#214ECF] hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">No notifications issued by Admin.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {notifications.slice(0, 4).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            n.read_at ? "bg-slate-50/50 border-slate-100" : "bg-blue-50/40 border-blue-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 line-clamp-2">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section C: Recent Workforce Attendance */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recent Workforce Attendance Logs</h3>
                    <p className="text-xs text-slate-500">Authorized BPO operational sessions working on your projects</p>
                  </div>
                  <button onClick={() => setTab("attendance")} className="text-xs font-semibold text-[#214ECF] hover:underline">
                    View Full Attendance ({attendance.length})
                  </button>
                </div>
                {attendance.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No workforce attendance sessions logged yet for your projects.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Delivery Centre</th>
                          <th className="py-2 px-3">Duration</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendance.slice(0, 4).map((a) => (
                          <tr key={a.id}>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{a.date}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{a.centreName || a.partnerName || "Delivery Centre"}</td>
                            <td className="py-2.5 px-3 text-slate-600">{Math.floor(a.durationMinutes / 60)}h {a.durationMinutes % 60}m</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section D: Payment History & Receipts (Bottom of Dashboard) */}
              <ClientPaymentHistorySection
                receipts={receipts}
                onViewReceipt={(r) => {
                  setSelectedReceipt(r);
                  setReceiptModalOpen(true);
                }}
                onNavigateToPlans={() => setTab("plans")}
              />
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: PROJECTS                                                  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "projects" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Client Projects</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized projects submitted by your account and managed by verified Thinkatic BPO delivery centres.
                  </p>
                </div>
                <button
                  onClick={() => setCreateProjectModalOpen(true)}
                  className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5 self-start cursor-pointer"
                >
                  <Plus size={14} /> Submit New Project
                </button>
              </div>

              {/* Gating Alert Banner */}
              {(!hasActivePlan || !(kyc?.status === "approved" || kyc?.status === "verified")) && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-950 text-sm">Project Submission Requirements</div>
                      <p className="text-amber-800 leading-relaxed">
                        To submit projects and allocate dedicated BPO workforce or engineering teams, your account must have an active paid plan and approved corporate KYC.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className={`inline-flex items-center gap-1 font-semibold ${hasActivePlan ? 'text-emerald-700' : 'text-amber-800'}`}>
                          {hasActivePlan ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-amber-600" />}
                          Paid Plan: {hasActivePlan ? (activePlanDetails?.serviceName || 'Active') : 'Not Activated'}
                        </span>
                        <span className="text-amber-400">·</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${(kyc?.status === 'approved' || kyc?.status === 'verified') ? 'text-emerald-700' : 'text-amber-800'}`}>
                          {(kyc?.status === 'approved' || kyc?.status === 'verified') ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-amber-600" />}
                          Corporate KYC: {(kyc?.status === 'approved' || kyc?.status === 'verified') ? 'Approved' : (kyc?.status || 'Pending')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasActivePlan && (
                      <button
                        onClick={() => setTab("plans")}
                        className="px-3.5 py-2 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
                      >
                        Choose Plan &amp; Checkout →
                      </button>
                    )}
                    {!(kyc?.status === 'approved' || kyc?.status === 'verified') && (
                      <button
                        onClick={() => setTab("kyc")}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
                      >
                        Complete KYC →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
                  <FolderKanban size={36} className="mx-auto text-slate-300" />
                  <h3 className="font-bold text-slate-800 text-sm">No Projects Submitted Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Activate an eligible enterprise plan and complete corporate KYC to submit and allocate your first BPO workforce project.
                  </p>
                  <button
                    onClick={() => setCreateProjectModalOpen(true)}
                    className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                  >
                    Submit Project Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((proj) => (
                    <div key={proj.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[10px] text-[#214ECF] font-bold">PROJECT #{proj.id}</span>
                          <h3 className="font-bold text-slate-900 text-base">{proj.name}</h3>
                          <div className="text-xs text-slate-400 mt-0.5">{proj.vertical || proj.project_type || "Operations"}</div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#214ECF] border border-blue-200">
                          {proj.status}
                        </span>
                      </div>

                      {proj.description && <p className="text-xs text-slate-600 line-clamp-2">{proj.description}</p>}

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Allocated BPO</span>
                          <span className="font-bold text-slate-800 truncate block">
                            {proj.assigned_bpo_name || (proj.bpo_partner ? proj.bpo_partner.name : "Pending Allocation")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Delivery Centre</span>
                          <span className="font-semibold text-slate-700 truncate block">
                            {proj.bpo_centre?.centre_name || "Pending Centre Assignment"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Required Seats</span>
                          <span className="font-bold text-slate-800">{proj.required_seats || proj.headcount || 0} agents</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Shift Pattern</span>
                          <span className="font-semibold text-slate-700">{proj.shift || "Standard"}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                          <span>Overall Progress</span>
                          <span>{proj.progress_percent || 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#214ECF] rounded-full" style={{ width: `${proj.progress_percent || 0}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <span>Target: {proj.target_geography || "Global"}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedConversation(conversations.find((c) => c.project_id === proj.id) || null);
                              setTab("communications");
                            }}
                            className="font-bold text-[#214ECF] hover:underline"
                          >
                            Project Chat →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: MEETINGS                                                  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "meetings" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Executive & Project Meetings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Schedule syncs with Thinkatic engineering leads, account directors, and operations staff.
                  </p>
                </div>
                <button
                  onClick={() => setMeetingModalOpen(true)}
                  className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5 self-start"
                >
                  <Plus size={14} /> Schedule Meeting
                </button>
              </div>

              {meetings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-2">
                  <Calendar size={36} className="mx-auto text-slate-300" />
                  <h3 className="font-bold text-slate-800 text-sm">No Scheduled Meetings</h3>
                  <p className="text-xs text-slate-500">Need to discuss project deliverables? Request a session now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meetings.map((m) => {
                    const revealedPass = meetingPasswords[m.id];
                    return (
                      <div key={m.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{m.title}</h3>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {m.project_id ? `Project #${m.project_id}` : "General Consultation"}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              m.status === "confirmed" || m.status === "scheduled"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : m.status === "cancelled"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-blue-50 text-[#214ECF] border border-blue-200"
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>

                        {m.description && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                            {m.description}
                          </p>
                        )}

                        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
                          <div><strong>Start:</strong> {new Date(m.start_time).toLocaleString()}</div>
                          {m.end_time && <div><strong>End:</strong> {new Date(m.end_time).toLocaleString()}</div>}
                        </div>

                        {m.meeting_link && (
                          <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700 truncate">{m.meeting_link}</span>
                            <a
                              href={m.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-[#214ECF] text-white rounded-lg text-xs font-bold hover:bg-blue-700 shrink-0"
                            >
                              Join <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        {/* Meeting Passcode reveal button & decrypted password display */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          {revealedPass ? (
                            <div className="flex items-center justify-between w-full p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                              <span className="font-mono font-bold text-emerald-900 text-xs flex items-center gap-1.5 truncate">
                                <Key size={13} className="text-emerald-600 shrink-0" />
                                <span>Passcode: {revealedPass}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(revealedPass);
                                  showToast("success", "Passcode copied to clipboard!");
                                }}
                                className="px-2 py-0.5 text-[11px] font-bold bg-white text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-100 cursor-pointer shrink-0"
                              >
                                Copy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevealMeetingPassword(m.id)}
                              disabled={loadingMeetingPasswordId === m.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Key size={13} className="text-slate-400" />
                              {loadingMeetingPasswordId === m.id ? "Decrypting..." : "View Passcode"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: BILLING & INVOICES                                        */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Billing & Invoices</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client-specific commercial invoices and recorded payment transactions.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Total Invoiced</div>
                  <div className="text-2xl font-black text-slate-900">${totalBilled.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{invoices.length} Invoices Issued</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Total Paid</div>
                  <div className="text-2xl font-black text-emerald-600">${totalPaid.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Confirmed Receipts</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Outstanding Balance</div>
                  <div className="text-2xl font-black text-amber-600">${balanceDue.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Due for processing</div>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
                  Client Invoice History
                </div>
                {invoices.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">No invoices issued for your account.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Invoice #</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Due Date</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4 text-right">Paid</th>
                          <th className="py-3 px-4 text-right">Balance Due</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="py-3 px-4 font-mono font-bold text-[#214ECF]">{inv.invoice_number}</td>
                            <td className="py-3 px-4 text-slate-600">{inv.invoice_date}</td>
                            <td className="py-3 px-4 text-slate-600">{inv.due_date}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-800">${Number(inv.total).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-emerald-600 font-semibold">${Number(inv.amount_paid).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-amber-600 font-bold">${Number(inv.balance_due).toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section: Payment History & Receipts */}
              <ClientPaymentHistorySection
                receipts={receipts}
                onViewReceipt={(r) => {
                  setSelectedReceipt(r);
                  setReceiptModalOpen(true);
                }}
                onNavigateToPlans={() => setTab("plans")}
              />
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: DOCUMENTS                                                 */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "documents" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Documents</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Secure file repository hosted on private Supabase Storage with anti-IDOR isolation.
                  </p>
                </div>
                <label className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start">
                  <Plus size={14} /> Upload Document
                  <input type="file" className="hidden" onChange={handleUploadDocument} disabled={uploadingDoc} />
                </label>
              </div>

              {documents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-2">
                  <FileText size={36} className="mx-auto text-slate-300" />
                  <h3 className="font-bold text-slate-800 text-sm">No Documents Uploaded</h3>
                  <p className="text-xs text-slate-500">Upload contract drafts, technical requirements, or SOW files.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={22} className="text-[#214ECF]" />
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{doc.original_file_name || doc.file_name}</h4>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {doc.category || "General"} · {Math.round((doc.file_size || 0) / 1024)} KB · {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const res = await authFetch(`/documents/${doc.id}/download`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.url) window.open(data.url, "_blank");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#214ECF] text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 6: PROJECT CHAT                                              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "communications" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Project Chat</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct project communication with Thinkatic Human Admin Control Centre. No AI chatbots.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewClientConversationModalOpen(true)}
                  className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5 self-start cursor-pointer"
                >
                  <Plus size={14} /> Start New Conversation
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs uppercase text-slate-400">Conversations</h3>
                    <button
                      type="button"
                      onClick={() => setNewClientConversationModalOpen(true)}
                      className="text-[11px] font-bold text-[#214ECF] hover:underline cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  {conversations.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                      <p>No conversations yet.</p>
                      <button
                        type="button"
                        onClick={() => setNewClientConversationModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-50 text-[#214ECF] text-xs font-bold rounded-lg hover:bg-blue-100 cursor-pointer"
                      >
                        Start Conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {conversations.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedConversation(c)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                            selectedConversation?.id === c.id
                              ? "bg-blue-50 border-[#214ECF] text-[#214ECF] font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="font-bold">{c.subject}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {c.project_id ? `Project #${c.project_id}` : "General Communication"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col min-h-[380px]">
                  {selectedConversation ? (
                    <>
                      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{selectedConversation.subject}</h3>
                          <div className="text-xs text-slate-400">Project #{selectedConversation.project_id}</div>
                        </div>
                      </div>

                      <div className="flex-1 py-4 space-y-3 overflow-y-auto">
                        {selectedConversation.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`flex flex-col ${m.sender_user_id ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-md p-3 rounded-2xl text-xs ${
                                m.sender_user_id
                                  ? "bg-[#214ECF] text-white rounded-br-none"
                                  : "bg-slate-100 text-slate-800 rounded-bl-none"
                              }`}
                            >
                              <p>{m.body}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 font-mono">
                              {m.sender_user_id ? "You" : "Admin"} · {new Date(m.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 flex gap-2">
                        <input
                          type="text"
                          placeholder="Type message to Thinkatic admin..."
                          value={messageDraft}
                          onChange={(e) => setMessageDraft(e.target.value)}
                          className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                        />
                        <button
                          type="submit"
                          disabled={sendingMessage || !messageDraft.trim()}
                          className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Send size={13} /> Send
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="m-auto text-center text-xs text-slate-400">
                      Select a conversation on the left to review messages or reply to Admin.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 7: SERVICES & PLANS (NO AI Plans)                            */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 7: SERVICES & PLANS (Authoritative 24 Non-AI Catalog)         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "plans" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Services &amp; Plans Catalog</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authoritative Thinkatic engineering, systems automation, dedicated scale, and cloud operations packages.
                  </p>
                </div>
                {hasActivePlan && activePlanDetails ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold self-start flex items-center justify-center gap-1.5 shadow-2xs">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Active Plan: {activePlanDetails.serviceName} ({activePlanDetails.tier})</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold self-start flex items-center justify-center gap-1.5">
                    No Plan Activated — Select a package below to checkout
                  </div>
                )}
              </div>

              {/* ── STATE 1: LOADING STATE (Skeletons & no fake 0 counts) ── */}
              {loading && plans.length === 0 ? (
                <div className="space-y-6">
                  {/* Category Pills Skeleton */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <div
                        key={cat}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-400 animate-pulse flex items-center justify-center gap-2"
                      >
                        <span>{cat}</span>
                        <span className="w-5 h-3 bg-slate-200 rounded-full" />
                      </div>
                    ))}
                  </div>

                  {/* 6 Skeleton Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="bg-white rounded-2xl border border-slate-200/90 p-6 flex flex-col justify-between shadow-xs animate-pulse space-y-4"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-3 bg-slate-200 rounded" />
                            <div className="flex gap-1.5">
                              <div className="w-14 h-4 bg-blue-100/70 rounded-full" />
                              <div className="w-16 h-4 bg-slate-100 rounded-full" />
                            </div>
                          </div>
                          <div className="w-3/4 h-5 bg-slate-200 rounded mb-2" />
                          <div className="w-full h-3 bg-slate-100 rounded mb-1" />
                          <div className="w-5/6 h-3 bg-slate-100 rounded mb-5" />
                          <div className="w-2/5 h-8 bg-slate-200 rounded-lg mb-5" />
                          <div className="space-y-2.5 py-3 border-t border-slate-100">
                            <div className="w-full h-3 bg-slate-100 rounded" />
                            <div className="w-4/5 h-3 bg-slate-100 rounded" />
                            <div className="w-3/5 h-3 bg-slate-100 rounded" />
                          </div>
                        </div>
                        <div className="w-full h-10 bg-slate-200 rounded-xl mt-4" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : plansError && plans.length === 0 ? (
                /* ── STATE 2: ERROR STATE (With Retry Button) ── */
                <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Unable to load Services &amp; Plans</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                    We could not connect to the authoritative service catalogue. Please check your network and retry.
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="px-5 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    <span>Retry Loading Plans</span>
                  </button>
                </div>
              ) : plans.length === 0 ? (
                /* ── STATE 3: EMPTY STATE ── */
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Layers size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">No services are currently available.</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                    The authoritative service catalogue is currently being synchronized by Thinkatic Admin.
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="px-5 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    <span>Refresh Catalogue</span>
                  </button>
                </div>
              ) : (
                /* ── STATE 4: SUCCESS STATE (Dynamic counts & Centered CTAs) ── */
                <>
                  {/* Category Filter Pills with exact counts */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          selectedCategory === cat
                            ? "bg-[#214ECF] text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {categoryCounts[cat] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Plans Grid (Authoritative Packages) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPlans.map((plan) => {
                      const isCurrentActive = hasActivePlan && activePlanDetails?.serviceId === plan.serviceId;
                      const isFixed = plan.pricingType === "fixed" && plan.price > 0;
                      const isOpeningThis = openingPlanId === plan.serviceId;

                      // Authoritative Price display logic - no $0 pricing for custom / non-fixed
                      let priceLabel = "";
                      if (plan.serviceId === "voice-ai" || plan.name?.toUpperCase().includes("VOICE AI")) {
                        priceLabel = "Custom Pricing / Included in AI Enterprise";
                      } else if (plan.serviceId === "ai-automation" || plan.name?.toUpperCase().includes("AI AUTOMATION")) {
                        priceLabel = "Custom Pricing";
                      } else if (plan.serviceId === "ai-enterprise" || plan.name?.toUpperCase().includes("AI ENTERPRISE")) {
                        priceLabel = "From $5,000+";
                      } else if (plan.serviceId === "auto-pro" || plan.name?.toUpperCase().includes("AUTOMATE PRO")) {
                        priceLabel = "From $3,499+";
                      } else if (plan.pricingType === "custom" || plan.priceDisplay?.toLowerCase().includes("custom") || (!plan.price && plan.price !== 0)) {
                        priceLabel = plan.priceDisplay || "Custom Pricing";
                      } else if (plan.priceDisplay) {
                        if (plan.priceDisplay.startsWith("From ") || isFixed) {
                          priceLabel = plan.priceDisplay;
                        } else {
                          priceLabel = plan.priceDisplay.includes("+") ? `From ${plan.priceDisplay}` : plan.priceDisplay;
                        }
                      } else if (isFixed) {
                        priceLabel = `$${plan.price.toLocaleString()}`;
                      } else {
                        priceLabel = "Custom Pricing";
                      }

                      const isCustom = !isFixed;
                      const intervalLabel = !isCustom && plan.billingInterval === "monthly" ? "/month" : (!isCustom ? "one-time" : "");

                      return (
                        <div
                          key={plan.serviceId}
                          className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-xs transition-all relative ${
                            isCurrentActive ? "border-[#214ECF] ring-2 ring-[#214ECF]/20" : "border-slate-200/90 hover:border-blue-200"
                          }`}
                        >
                          <div>
                            {/* Header Badges */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                                #{plan.serviceNumber}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF]">
                                  {plan.category}
                                </span>
                                {plan.tier && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    {plan.tier}
                                  </span>
                                )}
                                {plan.status === "WAITING" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Package Title & Positioning */}
                            <h3 className="font-bold text-slate-900 text-base mb-1">{plan.serviceName || plan.name}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{plan.description}</p>

                            {/* Price Display */}
                            <div className="mb-4">
                              <div className="text-2xl font-black text-slate-900">
                                {priceLabel}{" "}
                                {intervalLabel && (
                                  <span className="text-xs font-normal text-slate-400">
                                    {intervalLabel}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Specifications: Timeline & Support */}
                            <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] mb-4">
                              {plan.deliveryTimeline && (
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="text-slate-400">⏱ Timeline:</span>
                                  <span className="font-semibold text-slate-800">{plan.deliveryTimeline}</span>
                                </div>
                              )}
                              {plan.supportDuration && (
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="text-slate-400">🛡 Support:</span>
                                  <span className="font-semibold text-slate-800">{plan.supportDuration}</span>
                                </div>
                              )}
                              {plan.targetCustomer && (
                                <div className="pt-1 border-t border-slate-200/60 text-slate-500 text-[10px] leading-tight">
                                  <span className="font-semibold text-slate-600">🎯 Fit: </span>
                                  {plan.targetCustomer}
                                </div>
                              )}
                            </div>

                            {/* Features Checklist */}
                            <div className="space-y-1.5 text-xs text-slate-600 mb-6 border-t border-slate-100 pt-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Key Deliverables:
                              </span>
                              {(plan.features || []).slice(0, 4).map((f, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <Check size={13} className="text-[#214ECF] shrink-0 mt-0.5" />
                                  <span className="line-clamp-1">{f}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Primary CTA */}
                          {isCurrentActive ? (
                            <button
                              disabled
                              className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 size={14} className="text-emerald-600" />
                              Current Plan: ACTIVE
                            </button>
                          ) : plan.status === "WAITING" ? (
                            <button
                              disabled
                              className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              Coming Soon
                            </button>
                          ) : isCustom ? (
                            <button
                              disabled={isOpeningThis}
                              onClick={() => {
                                setOpeningPlanId(plan.serviceId);
                                setTimeout(() => {
                                  setCheckoutPlan(plan);
                                  setCheckoutModalOpen(true);
                                  setOpeningPlanId(null);
                                }, 150);
                              }}
                              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75"
                            >
                              {isOpeningThis ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Opening...</span>
                                </>
                              ) : (
                                <span>Request Scope Quote →</span>
                              )}
                            </button>
                          ) : plan.paymentEnabled === false ? (
                            <a
                              href="/contact"
                              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all flex items-center justify-center gap-1.5"
                            >
                              Contact Thinkatic
                            </a>
                          ) : (
                            <button
                              disabled={isOpeningThis}
                              onClick={() => {
                                setOpeningPlanId(plan.serviceId);
                                setTimeout(() => {
                                  setCheckoutPlan(plan);
                                  setCheckoutModalOpen(true);
                                  setOpeningPlanId(null);
                                }, 150);
                              }}
                              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#214ECF] text-white hover:bg-blue-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75"
                            >
                              {isOpeningThis ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Opening...</span>
                                </>
                              ) : (
                                <span>Review Order &amp; Checkout →</span>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 8: REPORTS                                                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "reports" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Operations & Financial Reports</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client-specific operational summaries generated directly from database activity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm text-slate-900">Project Operations Summary</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Projects Submitted</span>
                      <span className="font-bold text-slate-900">{projects.length}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Active Delivery Workforce</span>
                      <span className="font-bold text-slate-900">
                        {projects.reduce((acc, p) => acc + (p.required_seats || p.headcount || 0), 0)} agents
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Attendance Sessions Logged</span>
                      <span className="font-bold text-slate-900">{attendance.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm text-slate-900">Financial Billing Summary</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Billed</span>
                      <span className="font-bold text-slate-900">${totalBilled.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Paid</span>
                      <span className="font-bold text-emerald-600">${totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Outstanding Balance Due</span>
                      <span className="font-bold text-amber-600">${balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 9: YOUR UPDATES                                              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "updates" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Admin Updates & Notices</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official operational updates, schedule changes, and notices from Thinkatic Admin.
                </p>
              </div>

              {updates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500">No updates posted yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map((u) => (
                    <div key={u.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{u.title}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{u.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 10: SUPPORT TICKETS                                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "tickets" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Support Desk</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit technical, operational, and billing tickets directly to Thinkatic administrators.
                </p>
              </div>

              <form onSubmit={handleCreateTicket} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-sm text-slate-900 mb-1">Create Support Ticket</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    required
                    type="text"
                    placeholder="Ticket subject..."
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                    className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your issue or inquiry in detail..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                />
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingTicket ? "Submitting..." : "Submit Ticket"}
                </button>
              </form>

              <div className="space-y-3">
                {tickets.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-2">
                    <Ticket size={36} className="mx-auto text-slate-300" />
                    <h3 className="font-bold text-slate-800 text-sm">No Support Tickets</h3>
                    <p className="text-xs text-slate-500">Need assistance? Submit a ticket above.</p>
                  </div>
                ) : (
                  tickets.map((t) => {
                    const isExpanded = selectedTicketId === t.id;
                    const msgs = t.ticket_messages || (t as any).messages || [];
                    return (
                      <div
                        key={t.id}
                        className={`bg-white rounded-2xl border transition-all shadow-xs ${
                          isExpanded ? "border-[#214ECF] ring-1 ring-[#214ECF]/20" : "border-slate-200"
                        }`}
                      >
                        <div
                          onClick={() => setSelectedTicketId(isExpanded ? null : t.id)}
                          className="p-5 cursor-pointer hover:bg-slate-50/60 rounded-2xl transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold text-slate-900 text-sm">{t.subject}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                  t.status === "resolved" || t.status === "closed"
                                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                                    : t.status === "waiting_for_requester"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-blue-50 text-[#214ECF] border border-blue-200"
                                }`}
                              >
                                {t.status.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{t.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                            <span>
                              Ticket #{t.ticket_number} · Priority: <strong className="capitalize text-slate-600">{t.priority}</strong> · Category: {t.category}
                            </span>
                            <span>{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Expanded Thread */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 p-5 bg-slate-50/50 rounded-b-2xl space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Support Conversation Thread ({msgs.length} messages)
                            </h4>

                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                              {msgs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No responses logged yet on this ticket.</p>
                              ) : (
                                msgs.map((m: any) => {
                                  const isAdmin = Boolean(m.author_admin_id);
                                  return (
                                    <div
                                      key={m.id}
                                      className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                        isAdmin
                                          ? "bg-blue-50/70 border-blue-200 text-slate-800"
                                          : "bg-white border-slate-200 text-slate-800"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold flex items-center gap-1.5">
                                          {isAdmin ? (
                                            <span className="text-[#214ECF]">Thinkatic Support Lead</span>
                                          ) : (
                                            <span className="text-slate-700">You (Client)</span>
                                          )}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {new Date(m.created_at).toLocaleString()}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {m.body || m.content || m.message}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Reply Input Form */}
                            {t.status === "closed" ? (
                              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-500 text-center font-medium">
                                This support ticket has been closed. If you require further assistance, please open a new ticket.
                              </div>
                            ) : (
                              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                                <label className="text-xs font-bold text-slate-700 block">Send Response to Support Team</label>
                                <textarea
                                  rows={3}
                                  value={ticketReplyDraft}
                                  onChange={(e) => setTicketReplyDraft(e.target.value)}
                                  placeholder="Type your response to the support team..."
                                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSendTicketReply(t.id)}
                                    disabled={sendingTicketReply || !ticketReplyDraft.trim()}
                                    className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Send size={13} />
                                    {sendingTicketReply ? "Sending..." : "Submit Reply"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 11: ATTENDANCE & SHIFT (Client Reporting View Only)          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "attendance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Workforce Attendance & Shift Reporting</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified operational shifts logged by allocated BPO delivery centre workforces working on your projects.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
                  Authorized Attendance Records ({attendance.length})
                </div>
                {attendance.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No workforce attendance sessions logged yet for your projects.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Delivery Centre</th>
                          <th className="py-3 px-4">BPO Partner</th>
                          <th className="py-3 px-4">Worked Duration</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendance.map((rec) => (
                          <tr key={rec.id}>
                            <td className="py-3 px-4 font-mono text-slate-700">{rec.date}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">{rec.centreName || "Delivery Centre"}</td>
                            <td className="py-3 px-4 text-slate-600">{rec.partnerName || "BPO Partner"}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {Math.floor(rec.durationMinutes / 60)}h {rec.durationMinutes % 60}m
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 capitalize">
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 12: KYC VERIFICATION                                         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "kyc" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Corporate KYC Verification</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thinkatic enterprise compliance check required to unlock project submissions.
                </p>
              </div>

              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${
                  kyc?.status === "approved" || kyc?.status === "verified"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : kyc?.status === "pending" || kyc?.status === "under_review"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                <ShieldCheck size={20} className="shrink-0" />
                <div>
                  <div className="font-bold text-sm capitalize">Status: {kyc?.status || "Unsubmitted"}</div>
                  <p className="mt-0.5">
                    {kyc?.status === "approved" || kyc?.status === "verified"
                      ? "Your corporate identity has been approved. You have full access to submit and manage BPO projects."
                      : kyc?.status === "pending" || kyc?.status === "under_review"
                      ? "Your documents are currently under review by Thinkatic compliance officers."
                      : "Please submit your corporate registration and tax documents to unlock project submission."}
                  </p>
                  {kyc?.rejectionReason && (
                    <div className="mt-1 font-semibold text-red-700">Rejection Note: {kyc.rejectionReason}</div>
                  )}
                </div>
              </div>

              {/* KYC Submission Form */}
              {!(kyc?.status === "approved" || kyc?.status === "verified") && (
                <form onSubmit={handleSubmitKyc} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                    Submit Corporate Verification Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Legal Company / Entity Name</label>
                      <input
                        required
                        type="text"
                        value={kycForm.legalName}
                        onChange={(e) => setKycForm({ ...kycForm, legalName: e.target.value })}
                        placeholder="Registered business name"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Corporate Registration / Tax ID</label>
                      <input
                        required
                        type="text"
                        value={kycForm.taxId}
                        onChange={(e) => setKycForm({ ...kycForm, taxId: e.target.value })}
                        placeholder="EIN, GST, VAT, or Company Reg #"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Document Type</label>
                      <select
                        value={kycForm.documentType}
                        onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                      >
                        <option value="Business License">Business License / Certificate of Incorporation</option>
                        <option value="Tax Certificate">Tax Registration Certificate</option>
                        <option value="Passport">Director Passport / National ID</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Document Front URL / CDN Link</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={kycForm.documentFrontUrl}
                        onChange={(e) => setKycForm({ ...kycForm, documentFrontUrl: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingKyc}
                    className="px-5 py-2.5 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingKyc ? "Submitting..." : "Submit for Verification"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 13: ACCOUNT SETTINGS                                         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === "profile" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Account Settings</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update corporate profile, manage security credentials, and view account details.
                </p>
              </div>

              {/* Section A: Profile */}
              <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Profile Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Company Name</label>
                    <input
                      type="text"
                      value={profileCompanyName}
                      onChange={(e) => setProfileCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                    <input
                      disabled
                      type="email"
                      value={profile?.email || ""}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Country</label>
                    <input
                      type="text"
                      value={profileCountry}
                      onChange={(e) => setProfileCountry(e.target.value)}
                      placeholder="e.g. United States"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingProfile ? "Saving Changes..." : "Save Profile Details"}
                </button>
              </form>

              {/* Section B: Security & Password Change */}
              <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Change Account Password</h3>
                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold ${
                      passwordMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {passwordMsg.text}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Current Password</label>
                    <input
                      required
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                      <input
                        required
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                      <input
                        required
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </form>

              {/* Section C: Payment Receipts */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Payment Receipts</h3>
                {billingPayments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No payment receipts available yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Invoice</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {billingPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 font-mono text-[#214ECF] font-bold">
                              {p.invoices?.invoice_number || `INV-${p.invoice_id}`}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">${Number(p.amount).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section D: Account Overview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Account Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Client ID</span>
                    <span className="font-mono font-bold text-slate-800 truncate block">{profile?.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Account Status</span>
                    <span className="font-bold text-emerald-600 block">Active Client</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Active Plan</span>
                    <span className="font-bold text-[#214ECF] block">{profile?.selectedPlan || "None"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Member Since</span>
                    <span className="font-mono text-slate-600 block">
                      {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: SUBMIT NEW PROJECT (Gated) ── */}
      {createProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Submit New Project</h3>
              <button onClick={() => setCreateProjectModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Check Gate Status */}
            {!hasActivePlan ? (
              <div className="space-y-4 py-3">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <span>Please select and activate an authoritative plan before submitting a project.</span>
                </div>
                <button
                  onClick={() => {
                    setCreateProjectModalOpen(false);
                    setTab("plans");
                  }}
                  className="w-full py-2.5 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  Go to Services & Plans Catalog
                </button>
              </div>
            ) : !(kyc?.status === "approved" || kyc?.status === "verified") ? (
              <div className="space-y-4 py-3">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-amber-600 shrink-0" />
                  <span>Complete KYC verification before submitting a project.</span>
                </div>
                <button
                  onClick={() => {
                    setCreateProjectModalOpen(false);
                    setTab("kyc");
                  }}
                  className="w-full py-2.5 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  Go to KYC Verification
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateProject} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Project Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 24/7 Global Customer Care"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Vertical / Domain</label>
                    <select
                      value={projectForm.vertical}
                      onChange={(e) => setProjectForm({ ...projectForm, vertical: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                    >
                      <option value="Customer Support">Customer Support</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Tele-Sales">Tele-Sales & Lead Gen</option>
                      <option value="Back-Office Ops">Back-Office & Data</option>
                      <option value="Financial Ops">Financial Operations</option>
                      <option value="Content Moderation">Content Moderation</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Required Seats (Headcount)</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={projectForm.requiredSeats}
                      onChange={(e) => setProjectForm({ ...projectForm, requiredSeats: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Shift Requirement</label>
                    <select
                      value={projectForm.shift}
                      onChange={(e) => setProjectForm({ ...projectForm, shift: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                    >
                      <option value="Day Shift">Day Shift</option>
                      <option value="Night Shift">Night Shift</option>
                      <option value="Rotational">Rotational</option>
                      <option value="24/7 Coverage">24/7 Continuous Coverage</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Target Geography</label>
                    <input
                      type="text"
                      placeholder="e.g. North America, UK, India"
                      value={projectForm.targetGeography}
                      onChange={(e) => setProjectForm({ ...projectForm, targetGeography: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Description & Requirements</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide full operational requirements and SLA specifications..."
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateProjectModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProject}
                    className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingProject ? "Submitting..." : "Submit to Admin"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: SCHEDULE MEETING ── */}
      {meetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Schedule Executive Meeting</h3>
              <button onClick={() => setMeetingModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateMeeting} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Meeting Subject</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Q4 Delivery Alignment"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Related Project (Optional)</label>
                <select
                  value={meetingForm.projectId}
                  onChange={(e) => setMeetingForm({ ...meetingForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">None (General Inquiry)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
                  <input
                    required
                    type="datetime-local"
                    value={meetingForm.startTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={meetingForm.endTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Agenda / Discussion Points</label>
                <textarea
                  rows={3}
                  placeholder="Points to cover in this session..."
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMeetingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMeeting}
                  className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingMeeting ? "Submitting..." : "Request Meeting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: START NEW CONVERSATION ── */}
      {newClientConversationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Start Project Conversation</h3>
              <button
                type="button"
                onClick={() => setNewClientConversationModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateClientConversation} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Milestone 2 Deliverable Review"
                  value={newClientConversationSubject}
                  onChange={(e) => setNewClientConversationSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Related Project (Optional)</label>
                <select
                  value={newClientConversationProjectId || ""}
                  onChange={(e) => setNewClientConversationProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">General Project Thread</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewClientConversationModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClientConversation || !newClientConversationSubject.trim()}
                  className="px-4 py-2 bg-[#214ECF] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {creatingClientConversation ? "Starting..." : "Start Conversation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REVIEW ORDER & CHECKOUT ── */}
      {checkoutModalOpen && checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono text-[#214ECF] font-bold uppercase tracking-wider block">
                  Step 2 · Secure Checkout
                </span>
                <h3 className="text-base font-bold text-slate-900">Review Order &amp; Select Payment</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Package Summary Box */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF] mr-2">
                    {checkoutPlan.category}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Tier: {checkoutPlan.tier || "Standard"}
                  </span>
                  <h4 className="font-bold text-slate-900 text-base mt-1">
                    {checkoutPlan.serviceName || checkoutPlan.name}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-[#214ECF]">
                    {checkoutPlan.serviceId === "voice-ai" || checkoutPlan.name?.toUpperCase().includes("VOICE AI")
                      ? "Custom Pricing / Included in AI Enterprise"
                      : checkoutPlan.serviceId === "ai-automation" || checkoutPlan.name?.toUpperCase().includes("AI AUTOMATION")
                      ? "Custom Pricing"
                      : checkoutPlan.serviceId === "ai-enterprise" || checkoutPlan.name?.toUpperCase().includes("AI ENTERPRISE")
                      ? "From $5,000+"
                      : checkoutPlan.serviceId === "auto-pro" || checkoutPlan.name?.toUpperCase().includes("AUTOMATE PRO")
                      ? "From $3,499+"
                      : checkoutPlan.priceDisplay || (checkoutPlan.price > 0 ? `$${checkoutPlan.price.toLocaleString()}` : "Custom Pricing")}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {checkoutPlan.pricingType === "fixed" && checkoutPlan.price > 0
                      ? checkoutPlan.billingInterval === "monthly"
                        ? "monthly subscription"
                        : "one-time investment"
                      : "custom scope"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Delivery Timeline</span>
                  <span className="font-semibold text-slate-800">{checkoutPlan.deliveryTimeline || "Standard delivery"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Support Duration</span>
                  <span className="font-semibold text-slate-800">{checkoutPlan.supportDuration || "Standard support"}</span>
                </div>
              </div>

              {checkoutPlan.targetCustomer && (
                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-700">Target Fit: </span>
                  {checkoutPlan.targetCustomer}
                </div>
              )}
            </div>

            {/* Deliverables Checklist */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-700 block">Deliverables &amp; Inclusions:</span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {(checkoutPlan.features || []).map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-600">
                    <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Switcher or Custom Scope Guidance */}
            {(() => {
              const isFixed = checkoutPlan.pricingType === "fixed" && checkoutPlan.price > 0 && !checkoutPlan.priceDisplay?.toLowerCase().includes("custom") && !checkoutPlan.priceDisplay?.includes("+");

              if (!isFixed) {
                return (
                  <div className="pt-2 border-t border-slate-100 space-y-3 text-xs">
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                        <AlertCircle size={16} className="text-amber-600" />
                        Scope Consultation &amp; Custom Quote
                      </div>
                      <p className="text-amber-800 text-xs leading-relaxed">
                        This tier features customizable enterprise delivery ({checkoutPlan.priceDisplay}). In accordance with Thinkatic billing governance, no automated fixed charge is applied.
                      </p>
                      <p className="text-amber-700 text-xs">
                        Our solutions engineering team will review your specifications, deliver a milestone-based Statement of Work, and configure your bespoke invoice.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutModalOpen(false);
                          setTab("tickets");
                        }}
                        className="flex-1 py-3 px-4 bg-[#214ECF] hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        Request Custom Scope Quote / Open Ticket →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutModalOpen(false);
                          window.open("/contact", "_blank");
                        }}
                        className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
                      >
                        Book Discovery Call
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab("paypal")}
                      className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                        paymentMethodTab === "paypal"
                          ? "border-[#214ECF] text-[#214ECF]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      PayPal / Credit Card (Instant Activation)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethodTab("bank")}
                      className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                        paymentMethodTab === "bank"
                          ? "border-[#214ECF] text-[#214ECF]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Bank Transfer / Wire
                    </button>
                  </div>

                  {paymentMethodTab === "paypal" ? (
                    <div className="space-y-3 pt-2">
                      <div className="text-xs text-slate-500 bg-blue-50/60 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-[#214ECF] shrink-0" />
                        <span>
                          Instant activation: PayPal capture automatically finalizes your invoice in Supabase and activates your plan.
                        </span>
                      </div>
                      <div className="pt-1">
                        <PayPalButton packageId={checkoutPlan.serviceId} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="font-bold text-slate-800">Wire / Direct Bank Transfer Instructions:</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div><span className="text-slate-400">Beneficiary:</span> Thinkatic Technologies Inc.</div>
                          <div><span className="text-slate-400">Bank:</span> JPMorgan Chase Bank, N.A.</div>
                          <div><span className="text-slate-400">Routing (ABA):</span> 021000021</div>
                          <div><span className="text-slate-400">SWIFT / BIC:</span> CHASUS33</div>
                          <div><span className="text-slate-400">Account:</span> 8291048291</div>
                          <div><span className="text-slate-400">Currency:</span> USD (EUR/GBP on request)</div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 text-[11px]">
                          <span className="text-slate-500">Required Reference Format: </span>
                          <span className="font-mono font-bold text-[#214ECF]">
                            {(profile?.email || "CLIENT").replace(/[^a-zA-Z0-9]/g, "-")}-{checkoutPlan.serviceId}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        * Wire transfers are manually verified within 1-2 business days. For immediate automated activation, please use PayPal or Debit/Credit Card above.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCheckoutModalOpen(false);
                            setTab("billing");
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                        >
                          View Billing &amp; Invoices
                        </button>
                        <button
                          onClick={() => {
                            setCheckoutModalOpen(false);
                            setTab("communications");
                          }}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                        >
                          Notify Billing Team
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL: SECTION 23 PAYMENT SUCCESS ── */}
      {paymentSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-center">
            {/* Green Glow Checkmark */}
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Payment Confirmed &amp; Plan Activated!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your payment has been verified via the PayPal REST API and your active plan has been synchronized in Supabase.
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Payment: Paid
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                ✓ Invoice: Finalized
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                ✓ Plan: ACTIVE
              </span>
            </div>

            {/* Summary Details */}
            <div className="bg-slate-50 rounded-2xl p-4 text-xs border border-slate-100 text-left space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Package Name:</span>
                <span className="font-bold text-slate-900">
                  {paymentSuccessData?.packageName || activePlanDetails?.serviceName || "Enterprise Package"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-600">
                  {paymentSuccessData?.totalPaid || activePlanDetails?.priceDisplay || "PAID"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-blue-600">
                  {paymentSuccessData?.invoiceNumber || activePlanDetails?.invoiceNumber || "INV-FINALIZED"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono text-[11px] text-slate-600">
                  {paymentSuccessData?.orderId || activePlanDetails?.paypalOrderId || "VERIFIED"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Capture ID:</span>
                <span className="font-mono text-[11px] text-slate-600">
                  {paymentSuccessData?.captureId || activePlanDetails?.paypalCaptureId || "VERIFIED"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <button
                onClick={() => {
                  setPaymentSuccessModalOpen(false);
                  if (receipts.length > 0) {
                    setSelectedReceipt(receipts[0]);
                    setReceiptModalOpen(true);
                  } else {
                    setTab("overview");
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Receipt size={14} /> View Receipt
              </button>
              <button
                onClick={() => {
                  setPaymentSuccessModalOpen(false);
                  setTab("billing");
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                View Invoice
              </button>
              <button
                onClick={() => {
                  setPaymentSuccessModalOpen(false);
                  setTab("overview");
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setPaymentSuccessModalOpen(false);
                  setCreateProjectModalOpen(true);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Payment Receipt Viewer & Printable Drawer Modal */}
      <ClientReceiptViewerModal
        receipt={selectedReceipt}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
      />
    </div>
  );
}
