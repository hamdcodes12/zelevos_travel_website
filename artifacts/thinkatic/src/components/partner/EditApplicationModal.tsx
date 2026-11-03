import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, Loader2, AlertCircle } from "lucide-react";

interface EditApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number;
  initialData: {
    companyName?: string;
    legalEntity?: string;
    address?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    centreName?: string;
    totalSeats?: number;
    activeAgents?: number;
  };
  onSuccess: () => void;
}

export default function EditApplicationModal({
  isOpen,
  onClose,
  applicationId,
  initialData,
  onSuccess,
}: EditApplicationModalProps) {
  const [legalEntity, setLegalEntity] = useState(initialData.legalEntity || "Private Limited Company");
  const [address, setAddress] = useState(initialData.address || "");
  const [ownerName, setOwnerName] = useState(initialData.ownerName || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [centreName, setCentreName] = useState(initialData.centreName || "");
  const [totalSeats, setTotalSeats] = useState(initialData.totalSeats || 50);
  const [activeAgents, setActiveAgents] = useState(initialData.activeAgents || 25);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("user_token") ||
        localStorage.getItem("thinkatic_user_token") ||
        localStorage.getItem("bpo_applicant_token") ||
        localStorage.getItem("token") ||
        ""
      : "";

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/partner/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalEntity,
          address,
          ownerName,
          email,
          phone,
          centreName,
          totalSeats: Number(totalSeats),
          activeAgents: Number(activeAgents),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update application.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save application changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0B1F3A]">Edit Application Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Stage 1 Corporate & Delivery Facility Information</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs font-semibold text-slate-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-slate-700 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company Legal Entity <span className="text-[#214ECF]">*</span>
              </label>
              <select
                value={legalEntity}
                onChange={(e) => setLegalEntity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:bg-white focus:outline-none"
              >
                <option value="Private Limited Company">Private Limited Company (Pvt Ltd)</option>
                <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                <option value="Public Limited Company">Public Limited Company</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="Partnership Firm">Partnership Firm</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Centre / Facility Name <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={centreName}
                onChange={(e) => setCentreName(e.target.value)}
                placeholder="e.g. Noida Sector 62 Centre"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Registered Office Address <span className="text-[#214ECF]">*</span>
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Complete commercial office address"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Seat Capacity <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={totalSeats}
                onChange={(e) => setTotalSeats(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Active Calling Agents <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={activeAgents}
                onChange={(e) => setActiveAgents(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Primary Contact <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Email <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Phone <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
