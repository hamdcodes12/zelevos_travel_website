import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  User,
  Globe,
  Calendar,
  DollarSign,
  FileText,
  ChevronRight,
  X,
  UploadCloud,
  Download,
  Send,
  Check,
  Paperclip,
  AlertCircle,
  FileCheck,
  Layers,
  Users,
  ExternalLink,
  ChevronDown,
  Info,
  History,
  GitPullRequest,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface ProjectClientProfile {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  company?: string;
  phone?: string;
  plan?: string;
}

interface BpoPartnerSummary {
  id: string;
  name: string;
  partner_code: string;
  legal_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
}

interface BpoCentreSummary {
  id: string;
  name: string;
  location?: string;
  contact_name?: string;
  contact_phone?: string;
  email?: string;
  capacity?: number;
  status?: string;
}

export interface AdminProjectItem {
  id: number;
  client_id: string;
  name: string;
  project_type: string;
  status: string;
  progress_percent: number;
  manual_progress_percent?: number | null;
  start_date: string | null;
  expected_end_date: string | null;
  budget?: number | null;
  description: string | null;
  scope?: string | null;
  objectives?: string | null;
  technologies?: string[];
  vertical?: string | null;
  process_type?: string | null;
  target_geography?: string | null;
  required_seats?: number | null;
  shift?: string | null;
  payout_rate?: string | null;
  billing_cycle?: string | null;
  cover_image_url?: string | null;
  allocated_partner_id?: string | null;
  allocated_centre_id?: string | null;
  allocated_at?: string | null;
  bpo_client_id?: string | null;
  documents_count?: number;
  documentsCount?: number;
  client_profile?: ProjectClientProfile;
  bpo_partner?: BpoPartnerSummary;
  bpo_centre?: BpoCentreSummary;
  project_milestones?: any[];
  project_tasks?: any[];
  project_deliverables?: any[];
  project_activity?: any[];
  created_at?: string;
  updated_at?: string;
}

interface ProjectDetail extends AdminProjectItem {
  attached_documents?: Array<{
    id: number;
    original_file_name: string;
    file_path: string;
    file_size_bytes?: number;
    file_type?: string;
    category?: string;
    download_url?: string;
    created_at?: string;
  }>;
  assignment_history?: Array<{
    id: string;
    project_id: number;
    previous_partner_id?: string | null;
    new_partner_id: string;
    assigned_by_admin_id?: string;
    reason?: string;
    status: string;
    created_at: string;
    partner?: { id: string; name: string; partner_code: string };
  }>;
  change_requests?: Array<{
    id: string;
    project_id: number;
    client_id: string;
    requested_changes: Record<string, any>;
    reason?: string;
    status: string;
    admin_notes?: string;
    created_at: string;
    updated_at: string;
  }>;
}

const MARKETPLACE_IMAGE_PRESETS = [
  {
    name: "FinTech & Banking Tier-1",
    url: "/Project Marketplace/Global FinTech Tier-1 Technical Helpdesk.png",
    vertical: "Fintech & Banking",
  },
  {
    name: "Healthcare Patient Support",
    url: "/Project Marketplace/US Healthcare Inbound Patient Support.png",
    vertical: "Healthcare",
  },
  {
    name: "E-Commerce Omnichannel Care",
    url: "/Project Marketplace/E-Commerce Omnichannel Customer Care.png",
    vertical: "E-commerce",
  },
  {
    name: "Renewable Energy Inbound",
    url: "/Project Marketplace/UK Renewable Energy Inbound & Solar Queries.png",
    vertical: "Energy & Utilities",
  },
  {
    name: "AI Customer Support Operations",
    url: "/Project Marketplace/Global AI Customer Support Operations (TEST 2147).png",
    vertical: "Technology",
  },
];

const VERTICAL_OPTIONS = [
  "Fintech & Banking",
  "Healthcare",
  "E-commerce",
  "Telecom",
  "Energy & Utilities",
  "Technology",
  "Logistics & Supply Chain",
  "Travel & Hospitality",
];

const SHIFT_OPTIONS = [
  "US Shift (EST)",
  "US Shift (PST)",
  "UK Shift (GMT)",
  "Australian Shift (AEST)",
  "24/7 Rotational",
  "APAC Daytime",
];

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning / Draft", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "ready_for_bpo", label: "Ready for BPO", color: "bg-blue-50 text-[#214ECF] border-blue-200" },
  { value: "allocated", label: "Allocated to BPO", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "in_progress", label: "Active Operations", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "completed", label: "Completed", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "on_hold", label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

export default function AdminProjectsControlCentre({ refreshTrigger }: { refreshTrigger?: number } = {}) {
  const [projects, setProjects] = useState<AdminProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [bpoFilter, setBpoFilter] = useState<"all" | "assigned" | "unassigned">("all");

  // Selected project for detail workspace drawer
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "overview" | "bpo_assignment" | "documents" | "change_requests" | "milestones" | "activity"
  >("overview");

  // BPO Partners catalog for assignment
  const [partners, setPartners] = useState<any[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  // Clients catalog for project creation
  const [clients, setClients] = useState<any[]>([]);

  // Create / Edit Project Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProjectItem | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Project Form State
  const [formClientId, setFormClientId] = useState("");
  const [formName, setFormName] = useState("");
  const [formVertical, setFormVertical] = useState("Fintech & Banking");
  const [formProcessType, setFormProcessType] = useState("Inbound Customer Support");
  const [formTargetGeography, setFormTargetGeography] = useState("United States");
  const [formRequiredSeats, setFormRequiredSeats] = useState("20");
  const [formShift, setFormShift] = useState("US Shift (EST)");
  const [formPayoutRate, setFormPayoutRate] = useState("$16.00 / hour / agent");
  const [formBillingCycle, setFormBillingCycle] = useState("bi-weekly");
  const [formStartDate, setFormStartDate] = useState("");
  const [formExpectedEndDate, setFormExpectedEndDate] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formStatus, setFormStatus] = useState("planning");
  const [formDescription, setFormDescription] = useState("");
  const [formScope, setFormScope] = useState("");
  const [formObjectives, setFormObjectives] = useState("");
  const [formCoverImageUrl, setFormCoverImageUrl] = useState(MARKETPLACE_IMAGE_PRESETS[0].url);
  const [formCoverStoragePath, setFormCoverStoragePath] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Assign BPO Modal inside Workspace
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedCentreId, setSelectedCentreId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [assignmentAction, setAssignmentAction] = useState<"assign" | "change" | "resend">("assign");

  // Document Upload inside Workspace
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docUploadInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Image Preview
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Milestone / Task in Workspace
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneStatus, setNewMilestoneStatus] = useState("not_started");
  const [newMilestonePercent, setNewMilestonePercent] = useState("0");
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskAssigned, setNewTaskAssigned] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [submittingTask, setSubmittingTask] = useState(false);

  const token = localStorage.getItem("admin_token");

  // Fetch Projects List
  const fetchProjects = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/admin/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch Partners Catalog
  const fetchPartners = useCallback(async () => {
    try {
      setPartnersLoading(true);
      const res = await fetch("/api/admin/partners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load BPO partners:", e);
    } finally {
      setPartnersLoading(false);
    }
  }, [token]);

  // Fetch Registered Clients Catalog
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/client-updates/clients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load clients:", e);
    }
  }, [token]);

  useEffect(() => {
    fetchProjects();
    fetchPartners();
    fetchClients();
  }, [fetchProjects, fetchPartners, fetchClients]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchProjects(true);
    }
  }, [refreshTrigger, fetchProjects]);

  // Load Single Project Detail
  const loadProjectDetail = useCallback(async (id: number) => {
    try {
      setDetailLoading(true);
      setSelectedProjectId(id);
      const res = await fetch(`/api/admin/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjectDetail(data);
      }
    } catch (e) {
      console.error("Failed to load project detail:", e);
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  // Reset & Open Create Modal
  const openCreateModal = () => {
    setEditingProject(null);
    setFormClientId(clients[0]?.userId || "");
    setFormName("");
    setFormVertical("Fintech & Banking");
    setFormProcessType("Inbound Customer Support");
    setFormTargetGeography("United States");
    setFormRequiredSeats("20");
    setFormShift("US Shift (EST)");
    setFormPayoutRate("$16.00 / hour / agent");
    setFormBillingCycle("bi-weekly");
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormExpectedEndDate("");
    setFormBudget("");
    setFormStatus("ready_for_bpo");
    setFormDescription("");
    setFormScope("");
    setFormObjectives("");
    setFormCoverImageUrl(MARKETPLACE_IMAGE_PRESETS[0].url);
    setFormCoverStoragePath("");
    setCoverUploadError("");
    setSelectedFiles([]);
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (p: AdminProjectItem) => {
    setEditingProject(p);
    setFormClientId(p.client_id || "");
    setFormName(p.name || "");
    setFormVertical(p.vertical || "Fintech & Banking");
    setFormProcessType(p.process_type || p.project_type || "Inbound Customer Support");
    setFormTargetGeography(p.target_geography || "United States");
    setFormRequiredSeats(String(p.required_seats || 20));
    setFormShift(p.shift || "US Shift (EST)");
    setFormPayoutRate(p.payout_rate || "$16.00 / hour / agent");
    setFormBillingCycle(p.billing_cycle || "bi-weekly");
    setFormStartDate(p.start_date ? p.start_date.slice(0, 10) : "");
    setFormExpectedEndDate(p.expected_end_date ? p.expected_end_date.slice(0, 10) : "");
    setFormBudget(p.budget ? String(p.budget) : "");
    setFormStatus(p.status || "planning");
    setFormDescription(p.description || "");
    setFormScope(p.scope || "");
    setFormObjectives(p.objectives || "");
    setFormCoverImageUrl(p.cover_image_url || MARKETPLACE_IMAGE_PRESETS[0].url);
    setFormCoverStoragePath((p as any).sla_details?.cover_image_storage_path || "");
    setCoverUploadError("");
    setSelectedFiles([]);
    setFormError("");
    setIsModalOpen(true);
  };

  // Upload Custom Project Cover Image to Supabase Storage
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverUploadError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const ext = file.name.toLowerCase().split(".").pop() || "";
    const allowedExts = ["jpg", "jpeg", "png", "webp"];

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setCoverUploadError("Invalid image type. Please upload a JPG, JPEG, PNG, or WEBP image.");
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setCoverUploadError("Image file is too large (max 10MB). Please choose a smaller file.");
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
      return;
    }

    try {
      setUploadingCover(true);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/admin/projects/upload-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file: {
            fileName: file.name,
            data: base64,
            contentType: file.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"),
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to upload image to Supabase Storage");
      }

      const data = await res.json();
      if (data.url) {
        setFormCoverImageUrl(data.url);
        setFormCoverStoragePath(data.storagePath || "");
      }
    } catch (err: any) {
      setCoverUploadError(err.message || "Failed to upload cover image.");
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  // Submit Create or Edit Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Project Title is required.");
      return;
    }
    if (!formClientId.trim()) {
      setFormError("Client selection is required.");
      return;
    }

    try {
      setSavingProject(true);
      setFormError("");

      const payload: Record<string, any> = {
        clientId: formClientId,
        name: formName.trim(),
        vertical: formVertical,
        processType: formProcessType,
        projectType: formProcessType,
        targetGeography: formTargetGeography,
        requiredSeats: Number(formRequiredSeats) || 20,
        shift: formShift,
        payoutRate: formPayoutRate,
        billingCycle: formBillingCycle,
        status: formStatus,
        description: formDescription,
        scope: formScope,
        objectives: formObjectives,
        coverImageUrl: formCoverImageUrl,
        coverImageStoragePath: formCoverStoragePath || undefined,
        startDate: formStartDate || null,
        expectedEndDate: formExpectedEndDate || null,
        budget: formBudget ? Number(formBudget) : null,
      };

      if (selectedFiles.length > 0) {
        const filePromises = selectedFiles.map((file) => {
          return new Promise<any>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                fileName: file.name,
                data: reader.result as string,
                contentType: file.type || "application/octet-stream",
              });
            };
            reader.readAsDataURL(file);
          });
        });
        payload.attachments = await Promise.all(filePromises);
      }

      const url = editingProject ? `/api/admin/projects/${editingProject.id}` : "/api/admin/projects";
      const method = editingProject ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save project.");
      }

      setIsModalOpen(false);
      await fetchProjects(true);
      if (selectedProjectId) {
        await loadProjectDetail(selectedProjectId);
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving the project.");
    } finally {
      setSavingProject(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: number, projectName: string) => {
    if (!confirm(`Are you sure you want to permanently delete project "${projectName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (selectedProjectId === projectId) {
          setSelectedProjectId(null);
          setProjectDetail(null);
        }
        await fetchProjects(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete project.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete project.");
    }
  };

  // Handle BPO Manual Assignment
  const handleAssignBpo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDetail || !selectedPartnerId) return;

    try {
      setSubmittingAssignment(true);
      const url =
        assignmentAction === "change"
          ? `/api/admin/projects/${projectDetail.id}/change-bpo`
          : `/api/admin/projects/${projectDetail.id}/assign-bpo`;

      const payload =
        assignmentAction === "change"
          ? {
              newPartnerId: selectedPartnerId,
              newCentreId: selectedCentreId || null,
              reason: assignmentNotes || "Manual BPO re-allocation by Admin Operations",
            }
          : {
              partnerId: selectedPartnerId,
              centreId: selectedCentreId || null,
              notes: assignmentNotes || "Manual BPO assignment by Admin Operations",
            };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to assign BPO partner.");
      }

      setAssignModalOpen(false);
      setAssignmentNotes("");
      await loadProjectDetail(projectDetail.id);
      await fetchProjects(true);
    } catch (err: any) {
      alert(err.message || "Failed to assign BPO partner.");
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // Resend BPO Notification
  const handleResendBpoNotification = async () => {
    if (!projectDetail || !projectDetail.allocated_partner_id) return;
    try {
      const res = await fetch(`/api/admin/projects/${projectDetail.id}/resend-bpo-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          partnerId: projectDetail.allocated_partner_id,
          notes: "Resending operational allocation notice to authorized BPO Partner",
        }),
      });
      if (res.ok) {
        alert("BPO notification re-dispatched successfully to partner inbox.");
        await loadProjectDetail(projectDetail.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to resend notification.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to resend notification.");
    }
  };

  // Upload Additional Document inside Workspace
  const handleUploadWorkspaceDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectDetail) return;

    try {
      setUploadingDoc(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read document"));
          reader.readAsDataURL(file);
        });

        const res = await fetch(`/api/admin/projects/${projectDetail.id}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file: {
              fileName: file.name,
              data: base64,
              contentType: file.type || "application/octet-stream",
            },
            category: "Project Document",
            visibility: "client_visible",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to upload document.");
        }
      }

      await loadProjectDetail(projectDetail.id);
    } catch (e: any) {
      alert(e.message || "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
      if (docUploadInputRef.current) docUploadInputRef.current.value = "";
    }
  };

  // Delete Document Attachment
  const handleDeleteDoc = async (docId: number) => {
    if (!projectDetail) return;
    if (!confirm("Are you sure you want to remove this attached file?")) return;
    try {
      const res = await fetch(`/api/admin/projects/${projectDetail.id}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadProjectDetail(projectDetail.id);
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete document.");
    }
  };

  // Apply or Reject Client Change Request
  const handleApplyChangeRequest = async (requestId: string, approved: boolean) => {
    if (!projectDetail) return;
    const adminNotes = prompt(
      approved ? "Optional notes for approving this change request:" : "Reason for rejecting this change request:"
    );
    if (adminNotes === null) return;

    try {
      const res = await fetch(`/api/admin/projects/${projectDetail.id}/apply-change-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, approved, adminNotes }),
      });
      if (res.ok) {
        await loadProjectDetail(projectDetail.id);
        await fetchProjects(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to process change request.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to process change request.");
    }
  };

  // Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDetail || !newMilestoneName.trim()) return;
    try {
      setSubmittingMilestone(true);
      const res = await fetch(`/api/admin/projects/${projectDetail.id}/milestones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newMilestoneName.trim(),
          status: newMilestoneStatus,
          completionPercent: Number(newMilestonePercent) || 0,
        }),
      });
      if (res.ok) {
        setNewMilestoneName("");
        setNewMilestonePercent("0");
        await loadProjectDetail(projectDetail.id);
      }
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDetail || !newTaskName.trim()) return;
    try {
      setSubmittingTask(true);
      const res = await fetch(`/api/admin/projects/${projectDetail.id}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTaskName.trim(),
          assignedName: newTaskAssigned.trim() || "Operations Team",
          status: newTaskStatus,
          priority: newTaskPriority,
        }),
      });
      if (res.ok) {
        setNewTaskName("");
        setNewTaskAssigned("");
        await loadProjectDetail(projectDetail.id);
      }
    } finally {
      setSubmittingTask(false);
    }
  };

  // Filtered Projects for Cards Grid
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_profile?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.client_profile?.company || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.vertical || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.target_geography || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.bpo_partner?.name || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesVertical = verticalFilter === "all" || p.vertical === verticalFilter;
    const matchesBpo =
      bpoFilter === "all" ||
      (bpoFilter === "assigned" && !!p.allocated_partner_id) ||
      (bpoFilter === "unassigned" && !p.allocated_partner_id);

    return matchesSearch && matchesStatus && matchesVertical && matchesBpo;
  });

  // Calculate Operational Metrics
  const metrics = {
    total: projects.length,
    active: projects.filter((p) => ["allocated", "in_progress"].includes(p.status)).length,
    readyForBpo: projects.filter((p) => !p.allocated_partner_id && p.status !== "completed" && p.status !== "cancelled").length,
    completed: projects.filter((p) => p.status === "completed").length,
    totalSeats: projects.reduce((sum, p) => sum + (Number(p.required_seats) || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Master Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban size={22} className="text-[#214ECF]" />
            Project Management & BPO Control Centre
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational master control for client delivery projects, cover images, multi-file attachments, manual BPO assignment, and change requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchProjects()}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Projects"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#214ECF]" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors shadow-sm shadow-[#214ECF]/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      {/* 5 Enterprise KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <FolderKanban size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={metrics.total} />
          </div>
          <span className="text-[10px] text-slate-400">Total client submissions</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting BPO</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            <AnimatedCounter value={metrics.readyForBpo} />
          </div>
          <span className="text-[10px] text-slate-400">Requires manual allocation</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Allocated & Active</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            <AnimatedCounter value={metrics.active} />
          </div>
          <span className="text-[10px] text-slate-400">Under delivery by partner</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileCheck size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={metrics.completed} />
          </div>
          <span className="text-[10px] text-slate-400">Delivered operations</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seats Deployed</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            <AnimatedCounter value={metrics.totalSeats} />
          </div>
          <span className="text-[10px] text-slate-400">Authorized agent capacity</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by title, client, industry, BPO partner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF] bg-slate-50/50 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold pl-1">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={verticalFilter}
            onChange={(e) => setVerticalFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
          >
            <option value="all">All Industries</option>
            {VERTICAL_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={bpoFilter}
            onChange={(e) => setBpoFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
          >
            <option value="all">All Allocation States</option>
            <option value="assigned">Assigned to BPO</option>
            <option value="unassigned">Awaiting BPO</option>
          </select>
        </div>
      </div>

      {/* Projects Grid — Marketplace Style Cards */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
          <div className="animate-spin rounded-full border-2 border-slate-200 border-t-[#214ECF] w-8 h-8" />
          <span className="text-xs text-slate-500 font-medium">Loading project records from Supabase...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8">
          <FolderKanban size={38} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No projects match the selected criteria</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or filters, or click "Create New Project" to add an operational campaign.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const statusConfig =
              STATUS_OPTIONS.find((s) => s.value === project.status) || STATUS_OPTIONS[0];
            const coverImage = project.cover_image_url || MARKETPLACE_IMAGE_PRESETS[0].url;

            return (
              <div
                key={project.id}
                className="group bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-[#214ECF]/40 transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* 16:9 Card Image Header with Overlays */}
                <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={coverImage}
                    alt={project.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => setLightboxImage(coverImage)}
                    title="Click to preview cover image"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Top Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 backdrop-blur-xs text-slate-800 shadow-xs border border-white/40">
                      {project.vertical || "Operations"}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-xs shadow-xs ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Bottom Image Overlay: Process Type / Seats */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white pointer-events-none">
                    <span className="text-xs font-semibold drop-shadow-sm flex items-center gap-1.5 truncate">
                      <Layers size={13} className="text-blue-300 flex-shrink-0" />
                      {project.process_type || project.project_type || "Operations"}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#214ECF]/90 text-white backdrop-blur-xs">
                      {project.required_seats || 20} Seats
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Project Title & Code */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3
                        onClick={() => loadProjectDetail(project.id)}
                        className="text-base font-bold text-slate-900 group-hover:text-[#214ECF] transition-colors line-clamp-1 cursor-pointer"
                        title={project.name}
                      >
                        {project.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                        PRJ-{project.id}
                      </span>
                    </div>

                    {/* Client Information */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <Building2 size={13} className="text-[#214ECF] flex-shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">
                        {project.client_profile?.company || project.client_profile?.name || (project.client_id ? `Client ${project.client_id.slice(0, 8)}` : "Client Account")}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">{project.client_profile?.email || "Account"}</span>
                    </div>

                    {/* 2x2 Information Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Geography</span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                          <Globe size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{project.target_geography || "Global"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shift Window</span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                          <Clock size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{project.shift || "Standard"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payout / Budget</span>
                        <div className="font-semibold text-emerald-700 flex items-center gap-1 mt-0.5 truncate">
                          <DollarSign size={11} className="text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{project.payout_rate || (project.budget ? `$${project.budget.toLocaleString()}` : "Standard")}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attachments</span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                          <Paperclip size={11} className="text-slate-400 flex-shrink-0" />
                          <span>{(project.documents_count ?? project.documentsCount) || 0} Files</span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned BPO Status Bar */}
                    <div className="mt-3">
                      {project.allocated_partner_id && project.bpo_partner ? (
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 size={14} className="text-[#214ECF] flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">{project.bpo_partner.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Code: {project.bpo_partner.partner_code} {project.bpo_centre?.name ? `· ${project.bpo_centre.name}` : ""}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white flex-shrink-0">
                            Allocated
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                            <span className="font-semibold text-amber-800">Awaiting BPO Assignment</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadProjectDetail(project.id);
                              setDetailTab("bpo_assignment");
                            }}
                            className="text-[11px] font-bold text-[#214ECF] hover:underline flex-shrink-0"
                          >
                            Assign →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => loadProjectDetail(project.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold text-[#214ECF] bg-blue-50 hover:bg-[#214ECF] hover:text-white transition-all duration-200 cursor-pointer shadow-2xs"
                    >
                      <Eye size={13} />
                      <span>Open Workspace</span>
                    </button>

                    <button
                      onClick={() => openEditModal(project)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-[#214ECF] transition-colors cursor-pointer shadow-2xs"
                      title="Edit Project Details"
                    >
                      <Layers size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer shadow-2xs"
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLETE PROJECT DETAIL WORKSPACE DRAWER */}
      {/* ========================================================================= */}
      {selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="rounded-xl bg-[#214ECF] text-white px-3 py-1 font-mono text-xs font-bold flex-shrink-0">
                  PRJ-{selectedProjectId}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 truncate">
                    {projectDetail?.name || "Loading Project..."}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
                    <span>Client: <strong>{projectDetail?.client_profile?.company || projectDetail?.client_profile?.name || projectDetail?.client_id}</strong></span>
                    <span>·</span>
                    <span className="capitalize">Status: <strong>{projectDetail?.status?.replace("_", " ")}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {projectDetail && (
                  <button
                    onClick={() => openEditModal(projectDetail)}
                    className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Layers size={13} />
                    <span>Edit Info</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setProjectDetail(null);
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0">
              {[
                { id: "overview", label: "Overview & Scope", icon: FileText },
                { id: "bpo_assignment", label: "BPO Partner Dispatch", icon: Building2 },
                { id: "documents", label: "Documents & Files", icon: Paperclip, count: projectDetail?.attached_documents?.length },
                { id: "change_requests", label: "Change Requests", icon: GitPullRequest, count: projectDetail?.change_requests?.length },
                { id: "milestones", label: "Milestones & Tasks", icon: CheckSquare },
                { id: "activity", label: "Audit Timeline", icon: History },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = detailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id as any)}
                    className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "border-[#214ECF] text-[#214ECF]"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                    {typeof tab.count === "number" && tab.count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-[#214ECF] text-white" : "bg-slate-100 text-slate-600"}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading || !projectDetail ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full border-2 border-slate-200 border-t-[#214ECF] w-8 h-8" />
                  <span className="text-xs text-slate-500 font-medium">Loading project workspace from Supabase...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* TAB 1: OVERVIEW & SCOPE */}
                  {detailTab === "overview" && (
                    <div className="space-y-6">
                      {/* Cover Image & High Level Banner */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="lg:col-span-1 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative aspect-video">
                          <img
                            src={projectDetail.cover_image_url || MARKETPLACE_IMAGE_PRESETS[0].url}
                            alt={projectDetail.name}
                            className="w-full h-full object-cover object-center cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setLightboxImage(projectDetail.cover_image_url || MARKETPLACE_IMAGE_PRESETS[0].url)}
                          />
                        </div>

                        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Industry</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block truncate">{projectDetail.vertical || "General"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Process</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block truncate">{projectDetail.process_type || "Operations"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Seats</span>
                            <span className="text-xs font-bold text-[#214ECF] mt-1 block">{projectDetail.required_seats || 20} Agents</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shift</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block truncate">{projectDetail.shift || "Standard"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Geography</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block truncate">{projectDetail.target_geography || "Global"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payout Rate</span>
                            <span className="text-xs font-bold text-emerald-700 mt-1 block truncate">{projectDetail.payout_rate || "Per contract"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billing Cycle</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block capitalize">{projectDetail.billing_cycle || "Bi-Weekly"}</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Start Date</span>
                            <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                              {projectDetail.start_date ? new Date(projectDetail.start_date).toLocaleDateString() : "Immediate"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Client Profile Details */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <User size={14} className="text-[#214ECF]" />
                          Client Account Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 block">Organization Name:</span>
                            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                              {projectDetail.client_profile?.company || projectDetail.client_profile?.name || "Client Org"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Client Contact Email:</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block">
                              {projectDetail.client_profile?.email || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Client UUID:</span>
                            <span className="font-mono text-[11px] text-slate-600 mt-0.5 block select-all">
                              {projectDetail.client_id}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Scope & Description */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Detailed Description</h4>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {projectDetail.description || "No description provided for this project."}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Requirements & Scope of Work</h4>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {projectDetail.scope || "Full operational scope details are pending final sign-off."}
                          </p>
                        </div>
                      </div>

                      {/* SLA & Performance Specifications */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">SLA & Quality Targets</h4>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {projectDetail.objectives || "Standard Thinkatic 99.5% uptime SLA, CSAT > 90%, FCR > 82%."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BPO PARTNER DISPATCH */}
                  {detailTab === "bpo_assignment" && (
                    <div className="space-y-6">
                      {/* Current Assignment Status Banner */}
                      <div className="p-5 rounded-2xl border bg-white shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              Active BPO Partner Allocation
                            </span>
                            <div className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                              {projectDetail.allocated_partner_id && projectDetail.bpo_partner ? (
                                <>
                                  <CheckCircle2 size={18} className="text-emerald-600" />
                                  <span>{projectDetail.bpo_partner.name}</span>
                                  <span className="text-xs font-mono font-normal text-slate-500">
                                    ({projectDetail.bpo_partner.partner_code})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={18} className="text-amber-500" />
                                  <span className="text-amber-700">Awaiting Manual Partner Assignment</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {projectDetail.allocated_partner_id ? (
                              <>
                                <button
                                  onClick={handleResendBpoNotification}
                                  className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-[#214ECF] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  <Send size={13} />
                                  <span>Resend Notification</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setAssignmentAction("change");
                                    setSelectedPartnerId(projectDetail.allocated_partner_id || "");
                                    setSelectedCentreId(projectDetail.allocated_centre_id || "");
                                    setAssignModalOpen(true);
                                  }}
                                  className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                  <span>Change Partner</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setAssignmentAction("assign");
                                  setSelectedPartnerId(partners[0]?.id || "");
                                  setSelectedCentreId("");
                                  setAssignModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                              >
                                <Plus size={14} />
                                <span>Assign & Send Project</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {projectDetail.allocated_partner_id && projectDetail.bpo_partner && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block">Contact Person:</span>
                              <span className="font-semibold text-slate-800">{projectDetail.bpo_partner.contact_name || "Operations Lead"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Partner Email:</span>
                              <span className="font-semibold text-slate-800">{projectDetail.bpo_partner.email || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Allocated At:</span>
                              <span className="font-semibold text-slate-800">
                                {projectDetail.allocated_at ? new Date(projectDetail.allocated_at).toLocaleString() : "Recent"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Manual Assignment Modal / Form */}
                      {assignModalOpen && (
                        <form onSubmit={handleAssignBpo} className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Building2 size={16} className="text-[#214ECF]" />
                              {assignmentAction === "change" ? "Re-assign Project to Different BPO Partner" : "Select & Assign BPO Partner"}
                            </h4>
                            <button
                              type="button"
                              onClick={() => setAssignModalOpen(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Select BPO Partner *</label>
                              <select
                                required
                                value={selectedPartnerId}
                                onChange={(e) => {
                                  setSelectedPartnerId(e.target.value);
                                  setSelectedCentreId("");
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#214ECF]"
                              >
                                <option value="">-- Choose Authorized Partner --</option>
                                {partners.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.partner_code}) — {p.status || "active"}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Delivery Centre (Optional)</label>
                              <select
                                value={selectedCentreId}
                                onChange={(e) => setSelectedCentreId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#214ECF]"
                              >
                                <option value="">-- Main Centre or Any --</option>
                                {partners
                                  .find((p) => p.id === selectedPartnerId)
                                  ?.bpo_centres?.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.location || "Active"})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              Assignment Notes / Operational Instructions
                            </label>
                            <textarea
                              rows={2}
                              value={assignmentNotes}
                              onChange={(e) => setAssignmentNotes(e.target.value)}
                              placeholder="e.g. Please review shift schedule and deploy 20 voice agents by Oct 1."
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setAssignModalOpen(false)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingAssignment || !selectedPartnerId}
                              className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                              {submittingAssignment ? "Dispatching..." : "Confirm & Send Project"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Assignment & Dispatch History Table */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <History size={14} className="text-[#214ECF]" />
                          Partner Allocation & Re-assignment Audit Log
                        </h4>

                        {(!projectDetail.assignment_history || projectDetail.assignment_history.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">
                            No assignment changes logged yet. Initial allocation will appear here.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100 text-xs">
                            {projectDetail.assignment_history.map((record) => (
                              <div key={record.id} className="py-3 flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    <span>Assigned to {record.partner?.name || "BPO Partner"}</span>
                                  </div>
                                  <p className="text-slate-600 text-[11px]">{record.reason || "Operational assignment"}</p>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                                  {new Date(record.created_at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DOCUMENTS & ATTACHMENTS */}
                  {detailTab === "documents" && (
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Project Documents & Assets</h4>
                          <p className="text-xs text-slate-500">
                            PRDs, scope specifications, contracts, and delivery documents stored securely in Supabase Storage.
                          </p>
                        </div>

                        <label className="flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer">
                          <UploadCloud size={14} />
                          <span>{uploadingDoc ? "Uploading..." : "Upload Document"}</span>
                          <input
                            ref={docUploadInputRef}
                            type="file"
                            multiple
                            disabled={uploadingDoc}
                            onChange={handleUploadWorkspaceDoc}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Documents List */}
                      {(!projectDetail.attached_documents || projectDetail.attached_documents.length === 0) ? (
                        <div className="py-16 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-6">
                          <Paperclip size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-700">No documents attached to this project yet</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Click "Upload Document" to attach PRDs, PDFs, or specs.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {projectDetail.attached_documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#214ECF]/40 transition-colors shadow-2xs flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center flex-shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-slate-900 block truncate" title={doc.original_file_name}>
                                    {doc.original_file_name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {doc.category || "Attachment"} {doc.file_size_bytes ? `· ${(doc.file_size_bytes / 1024).toFixed(0)} KB` : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {doc.download_url && (
                                  <a
                                    href={doc.download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-[#214ECF] hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Download Document"
                                  >
                                    <Download size={14} />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: CLIENT CHANGE REQUESTS */}
                  {detailTab === "change_requests" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Client-Submitted Scope Change Requests</h4>
                        <p className="text-xs text-slate-500">
                          Review requested scope or operational modifications. All versions remain preserved in historical audit.
                        </p>
                      </div>

                      {(!projectDetail.change_requests || projectDetail.change_requests.length === 0) ? (
                        <div className="py-14 text-center bg-slate-50/60 rounded-2xl border border-slate-200 p-6">
                          <GitPullRequest size={30} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-700">No change requests currently pending</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">When the client requests shifts, seats, or scope revisions, they appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {projectDetail.change_requests.map((cr) => (
                            <div key={cr.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  cr.status === "approved" ? "bg-emerald-100 text-emerald-800" : cr.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {cr.status}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(cr.created_at).toLocaleString()}
                                </span>
                              </div>

                              <div className="text-xs space-y-1">
                                <p className="font-semibold text-slate-800">Reason: {cr.reason || "Client request"}</p>
                                <div className="p-3 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-700 overflow-x-auto">
                                  {JSON.stringify(cr.requested_changes, null, 2)}
                                </div>
                              </div>

                              {cr.status === "pending" && (
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    onClick={() => handleApplyChangeRequest(cr.id, false)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  >
                                    Reject Request
                                  </button>
                                  <button
                                    onClick={() => handleApplyChangeRequest(cr.id, true)}
                                    className="px-3.5 py-1 rounded-lg text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 cursor-pointer shadow-2xs"
                                  >
                                    Approve & Apply Changes
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: MILESTONES & TASKS */}
                  {detailTab === "milestones" && (
                    <div className="space-y-6">
                      {/* Milestones Management */}
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                          <span>Project Milestones ({projectDetail.project_milestones?.length || 0})</span>
                        </h4>

                        <form onSubmit={handleAddMilestone} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            required
                            placeholder="Milestone title *"
                            value={newMilestoneName}
                            onChange={(e) => setNewMilestoneName(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#214ECF]"
                          />
                          <select
                            value={newMilestoneStatus}
                            onChange={(e) => setNewMilestoneStatus(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Completion %"
                            value={newMilestonePercent}
                            onChange={(e) => setNewMilestonePercent(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                          />
                          <button
                            type="submit"
                            disabled={submittingMilestone || !newMilestoneName.trim()}
                            className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Add Milestone
                          </button>
                        </form>

                        <div className="space-y-2 pt-2">
                          {(projectDetail.project_milestones || []).map((m: any) => (
                            <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{m.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500">{m.completion_percent ?? 0}%</span>
                                <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                  {m.status?.replace("_", " ")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Frontline Tasks */}
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Operational Tasks ({projectDetail.project_tasks?.length || 0})
                        </h4>

                        <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          <input
                            required
                            placeholder="Task title *"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#214ECF]"
                          />
                          <input
                            placeholder="Assignee (e.g. Lead Agent)"
                            value={newTaskAssigned}
                            onChange={(e) => setNewTaskAssigned(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200"
                          />
                          <select
                            value={newTaskStatus}
                            onChange={(e) => setNewTaskStatus(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <button
                            type="submit"
                            disabled={submittingTask || !newTaskName.trim()}
                            className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Assign Task
                          </button>
                        </form>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {(projectDetail.project_tasks || []).map((t: any) => (
                            <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                              <span className="font-semibold text-slate-800 truncate">{t.name}</span>
                              <span className="capitalize text-[10px] font-bold text-slate-500">{t.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: AUDIT TIMELINE */}
                  {detailTab === "activity" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Chronological Project Lifecycle & Audit Trail
                      </h4>

                      {(!projectDetail.project_activity || projectDetail.project_activity.length === 0) ? (
                        <p className="text-xs text-slate-400 py-6 text-center">No lifecycle events recorded yet.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 text-xs">
                          {projectDetail.project_activity.map((act: any) => (
                            <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
                              <span className="text-slate-800 font-medium">{act.description || act.action}</span>
                              <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                                {new Date(act.created_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT PROJECT MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingProject ? `Edit Project: PRJ-${editingProject.id}` : "Create New Operational Project / Campaign"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative record persists directly into Supabase production tables.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Client & Project Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Client Account *</label>
                  <select
                    required
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="">-- Choose Registered Client --</option>
                    {clients.map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.clientName || c.email} ({c.email}) {c.assignedPlan ? `· ${c.assignedPlan}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Project Title / Name *</label>
                  <input
                    required
                    placeholder="e.g. US Healthcare Inbound Patient Care Operations"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              {/* 2. Process Type, Vertical, Shift, Seats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Industry / Vertical</label>
                  <select
                    value={formVertical}
                    onChange={(e) => setFormVertical(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    {VERTICAL_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Process Type</label>
                  <input
                    placeholder="e.g. Omnichannel Support"
                    value={formProcessType}
                    onChange={(e) => setFormProcessType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Required Seats (Agents)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formRequiredSeats}
                    onChange={(e) => setFormRequiredSeats(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Shift Window</label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Geography, Payout, Billing, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Target Country / Region</label>
                  <input
                    placeholder="e.g. United States"
                    value={formTargetGeography}
                    onChange={(e) => setFormTargetGeography(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Payout Rate / Seat</label>
                  <input
                    placeholder="e.g. $16.00 / hour"
                    value={formPayoutRate}
                    onChange={(e) => setFormPayoutRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Billing Cycle</label>
                  <select
                    value={formBillingCycle}
                    onChange={(e) => setFormBillingCycle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white capitalize"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Dates & Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Expected End Date</label>
                  <input
                    type="date"
                    value={formExpectedEndDate}
                    onChange={(e) => setFormExpectedEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Total Budget (USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* 5. Project Cover Image: Custom Upload + Marketplace Presets */}
              {(() => {
                const activePreset = MARKETPLACE_IMAGE_PRESETS.find((p) => p.url === formCoverImageUrl);
                const isCustomCover = !activePreset && Boolean(formCoverImageUrl);

                return (
                  <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Sparkles size={13} className="text-[#214ECF]" />
                          Project Cover Image
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Upload any custom image (JPG, JPEG, PNG, WEBP max 10MB) or select an approved marketplace preset.
                        </p>
                      </div>
                      {isCustomCover && (
                        <span className="self-start sm:self-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#214ECF] border border-blue-200">
                          Custom Storage Asset
                        </span>
                      )}
                    </div>

                    {/* 16:9 Live Preview & Custom Upload Dropzone */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      {/* Left: 16:9 Visual Frame Container */}
                      <div className="sm:col-span-6 lg:col-span-5">
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 shadow-xs group">
                          {formCoverImageUrl ? (
                            <>
                              <img
                                src={formCoverImageUrl}
                                alt="Project cover preview"
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs truncate max-w-[140px]">
                                  {activePreset ? activePreset.name : "Custom Upload"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage(formCoverImageUrl)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 backdrop-blur-xs transition"
                                >
                                  Expand
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                              <UploadCloud size={28} className="mb-1 text-slate-500" />
                              <span className="text-xs font-bold">No cover image selected</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Upload Actions & File Picker */}
                      <div className="sm:col-span-6 lg:col-span-7 space-y-3">
                        <input
                          type="file"
                          ref={coverFileInputRef}
                          onChange={handleCoverFileUpload}
                          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={uploadingCover}
                            onClick={() => coverFileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-[#214ECF] text-slate-800 text-xs font-bold shadow-2xs hover:shadow-xs transition disabled:opacity-50 cursor-pointer"
                          >
                            {uploadingCover ? (
                              <>
                                <RefreshCw size={14} className="animate-spin text-[#214ECF]" />
                                <span>Uploading to Storage...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud size={14} className="text-[#214ECF]" />
                                <span>Upload Project Cover Image</span>
                              </>
                            )}
                          </button>

                          {isCustomCover && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormCoverImageUrl(MARKETPLACE_IMAGE_PRESETS[0].url);
                                setFormCoverStoragePath("");
                                setCoverUploadError("");
                              }}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer"
                            >
                              Reset to Preset
                            </button>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          <p>• Formats: <strong>JPG, JPEG, PNG, WEBP</strong> (Max: 10MB)</p>
                          <p>• Stored in Supabase Storage with dedicated 16:9 responsive display</p>
                        </div>

                        {coverUploadError && (
                          <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5">
                            <AlertCircle size={14} className="shrink-0 text-rose-600" />
                            <span>{coverUploadError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Optional Marketplace Presets */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Or Select from Optional Marketplace Presets:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {MARKETPLACE_IMAGE_PRESETS.map((preset) => {
                          const isSelected = formCoverImageUrl === preset.url;
                          return (
                            <div
                              key={preset.url}
                              onClick={() => {
                                setFormCoverImageUrl(preset.url);
                                setFormCoverStoragePath("");
                                setCoverUploadError("");
                              }}
                              className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-video group ${
                                isSelected ? "border-[#214ECF] ring-2 ring-[#214ECF]/30" : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <img src={preset.url} alt={preset.name} className="w-full h-full object-cover object-center" />
                              <div className="absolute inset-0 bg-slate-900/40 p-1.5 flex flex-col justify-between">
                                {isSelected && (
                                  <span className="self-end bg-[#214ECF] text-white p-0.5 rounded-full">
                                    <Check size={12} />
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-white drop-shadow truncate">
                                  {preset.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional Direct URL Input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Or enter direct image URL (e.g. https://...)"
                        value={formCoverImageUrl}
                        onChange={(e) => {
                          setFormCoverImageUrl(e.target.value);
                          setCoverUploadError("");
                        }}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 focus:outline-none focus:border-[#214ECF] bg-white"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* 6. Description & Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Detailed Description</label>
                  <textarea
                    rows={3}
                    placeholder="Operational overview of customer care or technical operations..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Requirements & Scope</label>
                  <textarea
                    rows={3}
                    placeholder="Tooling, CRM, telephony routing, language proficiencies..."
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              {/* 7. SLA & Quality Targets */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">SLA Specifications & Performance Targets</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 99.5% Service Level, CSAT > 90%, AHT < 300s..."
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              {/* 8. File Uploads (Multiple PRD, PDF, Docs, Images, Videos) */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Paperclip size={14} className="text-[#214ECF]" />
                    Attach Files / PRD / Specs / Images / Videos
                  </label>
                  <span className="text-[10px] text-slate-400">PDF, DOCX, XLSX, MP4, PNG (Up to 50MB)</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const arr = Array.from(e.target.files);
                      setSelectedFiles((prev) => [...prev, ...arr]);
                    }
                  }}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#214ECF] file:border-slate-200 hover:file:bg-blue-50 cursor-pointer"
                />

                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-200 text-slate-800"
                      >
                        <FileText size={12} className="text-[#214ECF]" />
                        <span className="max-w-[160px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles((f) => f.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Action Controls */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="flex items-center justify-center gap-1.5 h-9 px-5 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-[#214ECF]/20"
                >
                  {savingProject ? "Saving..." : editingProject ? "Update Project" : "Publish Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Cover Image Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl">
            <img src={lightboxImage} alt="Cover Preview" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
