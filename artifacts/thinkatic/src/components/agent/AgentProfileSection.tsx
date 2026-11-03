import React, { useState } from "react";
import {
  UserCheck,
  Lock,
  Mail,
  Phone,
  Building,
  Briefcase,
  Clock,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  X,
} from "lucide-react";

interface AgentProfileSectionProps {
  agent: any;
  token: string;
  onPasswordChangeSuccess?: () => void;
}

export const AgentProfileSection: React.FC<AgentProfileSectionProps> = ({
  agent,
  token,
  onPasswordChangeSuccess,
}) => {
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passSubmitting, setPassSubmitting] = useState(false);

  // Edit personal fields state
  const [showEditModal, setShowEditModal] = useState(false);
  const [phone, setPhone] = useState(agent?.phone || "");
  const [languages, setLanguages] = useState<string>(
    Array.isArray(agent?.languages) ? agent.languages.join(", ") : "English, Hindi"
  );
  const [skills, setSkills] = useState<string>(
    Array.isArray(agent?.skills) ? agent.skills.join(", ") : "Inbound Voice, HIPAA Verification"
  );
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSuccess, setEditSuccess] = useState("");
  const [editError, setEditError] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (!currPassword) {
      setPassError("Current password is required.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }
    if (currPassword === newPassword) {
      setPassError("New password must differ from current password.");
      return;
    }

    setPassSubmitting(true);
    try {
      const res = await fetch("/api/agent/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: currPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassSuccess("Password updated successfully! Old password invalidated immediately.");
        setCurrPassword("");
        setNewPassword("");
        setConfirmPassword("");
        if (onPasswordChangeSuccess) onPasswordChangeSuccess();
        setTimeout(() => setShowPasswordModal(false), 1800);
      } else {
        setPassError(data.error || "Failed to update password");
      }
    } catch {
      setPassError("Connection error while updating password.");
    } finally {
      setPassSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");
    setEditSubmitting(true);

    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: phone.trim(),
          languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditSuccess("Profile updated successfully!");
        setTimeout(() => {
          setShowEditModal(false);
          setEditSuccess("");
        }, 1500);
      } else {
        setEditError(data.error || "Failed to update profile");
      }
    } catch {
      setEditError("Connection error while updating profile.");
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <UserCheck className="w-3.5 h-3.5 text-[#214ECF]" />
            Agent Profile & Security Credentials
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Frontline Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authorized employee credentials, operational assignment details, and portal password security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-xs font-bold text-slate-700 hover:text-[#214ECF] transition-all cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Info</span>
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* ── PROFILE INFORMATION CARD ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
        {/* User Identity Banner */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#214ECF] font-black text-2xl flex items-center justify-center border border-blue-200/60 shadow-xs">
            {agent?.name ? agent.name.charAt(0) : "A"}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                {agent?.agentCode || "THK-AGT-02323"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Active Account
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900">{agent?.name || "Guru Agent"}</h2>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{agent?.designation || "Customer Support Associate"}</span>
              <span>•</span>
              <span>{agent?.department || "Inbound Voice Operations"}</span>
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Employee ID
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {agent?.employeeId || "AGT-THK-02323"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Work Email Address
            </span>
            <span className="font-medium text-slate-900 text-sm">{agent?.email}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Contact Phone
            </span>
            <span className="font-medium text-slate-900 text-sm">{phone || agent?.phone || "—"}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              BPO Delivery Partner Centre
            </span>
            <span className="font-bold text-slate-900 text-sm">
              Thinkatic Partner Centre #{agent?.centreId || 2}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Frontline Supervisor
            </span>
            <span className="font-bold text-slate-900 text-sm">
              {agent?.supervisor || "Frontline Operations Supervisor"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Assigned Shift
            </span>
            <span className="font-bold text-slate-900 text-sm">
              {agent?.shiftPreference || "US Day (EST)"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Joining Date
            </span>
            <span className="font-bold text-slate-900 text-sm">March 1, 2026</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Operational Timezone
            </span>
            <span className="font-bold text-slate-900 text-sm">America/New_York (EST)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
              Password Security
            </span>
            <span className="font-bold text-emerald-700 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Configured & Active
            </span>
          </div>
        </div>

        {/* Languages & Skills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-2">
              Authorized Operational Languages
            </span>
            <div className="flex flex-wrap gap-2">
              {languages.split(",").map((l, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  {l.trim()}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-2">
              Verified Frontline Competencies
            </span>
            <div className="flex flex-wrap gap-2">
              {skills.split(",").map((s, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-[#214ECF]"
                >
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── PASSWORD CHANGE MODAL ───────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Change Portal Password</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurr ? "text" : "password"}
                    value={currPassword}
                    onChange={(e) => setCurrPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurr(!showCurr)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurr ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                >
                  {passSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ──────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Personal Details</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Languages (Comma-separated)
                </label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Skills & Competencies (Comma-separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
