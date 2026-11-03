import { useState } from "react";
import { motion } from "framer-motion";
import { Server, Check, Loader2, AlertCircle } from "lucide-react";

interface EditInfrastructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number;
  initialData: {
    primaryIsp?: string;
    secondaryIsp?: string;
    bandwidthMbps?: number;
    leasedLineDetails?: string;
    networkDetails?: string;
    powerBackup?: string;
    workstations?: number;
  };
  onSuccess: () => void;
}

export default function EditInfrastructureModal({
  isOpen,
  onClose,
  applicationId,
  initialData,
  onSuccess,
}: EditInfrastructureModalProps) {
  const [primaryIsp, setPrimaryIsp] = useState(initialData.primaryIsp || "Tata Communications Leased Line");
  const [secondaryIsp, setSecondaryIsp] = useState(initialData.secondaryIsp || "Airtel Business Fiber");
  const [bandwidthMbps, setBandwidthMbps] = useState(initialData.bandwidthMbps || 200);
  const [leasedLineDetails, setLeasedLineDetails] = useState(
    initialData.leasedLineDetails || "1:1 Dedicated Duplex Leased Line, 99.5% Uptime SLA"
  );
  const [networkDetails, setNetworkDetails] = useState(
    initialData.networkDetails || "Cisco Gigabit Managed Switches, Fortinet Enterprise Firewall, Structured CAT6 Cabling"
  );
  const [powerBackup, setPowerBackup] = useState(
    initialData.powerBackup || "30 kVA Online Emerson UPS + 62.5 kVA Silent DG Set (Auto Phase Changeover)"
  );
  const [workstations, setWorkstations] = useState(initialData.workstations || 50);

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
      const res = await fetch(`/api/partner/applications/${applicationId}/infrastructure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          primaryIsp,
          secondaryIsp,
          bandwidthMbps: Number(bandwidthMbps),
          leasedLineDetails,
          networkDetails,
          powerBackup,
          workstations: Number(workstations),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update infrastructure details.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save infrastructure configuration.");
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
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0B1F3A]">Configure Facility Infrastructure</h3>
              <p className="text-xs text-slate-500 mt-0.5">Stage 4 Connectivity, Power & Hardware Technical Specifications</p>
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
                Primary ISP Leased Line <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={primaryIsp}
                onChange={(e) => setPrimaryIsp(e.target.value)}
                placeholder="e.g. Tata Communications Leased Line"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Secondary ISP (Redundant) <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={secondaryIsp}
                onChange={(e) => setSecondaryIsp(e.target.value)}
                placeholder="e.g. Airtel Business Fiber"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Guaranteed Bandwidth (Mbps) <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="number"
                min={10}
                required
                value={bandwidthMbps}
                onChange={(e) => setBandwidthMbps(parseInt(e.target.value, 10) || 0)}
                placeholder="200"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Production Workstations <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={workstations}
                onChange={(e) => setWorkstations(parseInt(e.target.value, 10) || 0)}
                placeholder="50"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Leased Line Uptime & SLA Details
            </label>
            <input
              type="text"
              value={leasedLineDetails}
              onChange={(e) => setLeasedLineDetails(e.target.value)}
              placeholder="e.g. 1:1 Dedicated Duplex, 99.5% Uptime SLA, Static Public IP Pool"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Network Routing & Switchgear Information
            </label>
            <input
              type="text"
              value={networkDetails}
              onChange={(e) => setNetworkDetails(e.target.value)}
              placeholder="e.g. Cisco Layer-3 Core Switch, Fortinet UTM Firewall, CAT6 Shielded Cabling"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Power Backup Infrastructure (UPS / DG Set) <span className="text-[#214ECF]">*</span>
            </label>
            <input
              type="text"
              required
              value={powerBackup}
              onChange={(e) => setPowerBackup(e.target.value)}
              placeholder="e.g. 30 kVA Emerson Online UPS + 62.5 kVA Kirloskar Silent DG Set"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
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
                  <Check className="h-4 w-4" /> Save Infrastructure
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
