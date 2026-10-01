import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Luggage,
  CreditCard,
  FileText,
  RotateCcw,
  MessageSquare,
  Bell,
  Clock,
  ShieldAlert,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Sparkles,
  RefreshCw,
  Search,
  Archive,
} from "lucide-react";

type UserDossierProps = {
  userId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onCustomerStatusChanged?: () => void;
};

export function AdminUserDossierModal({ userId, onClose, onToast, onCustomerStatusChanged }: UserDossierProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "bookings" | "payments" | "invoices" | "refunds" | "support" | "notifications" | "timeline" | "audit"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<any>(null);

  // In-Dossier Lifecycle Actions State
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("Customer Requested Account Closure");
  const [archiveCustomReason, setArchiveCustomReason] = useState("");
  const [archiveNote, setArchiveNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchDossier = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}/dossier`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setDossier(data);
      } else {
        onToast(data.message || "Failed to load customer dossier.");
      }
    } catch (err) {
      console.error(err);
      onToast("Network error loading customer dossier.");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!dossier?.user) return;
    const finalReason = archiveReason === "Other" ? archiveCustomReason.trim() : archiveReason;
    if (!finalReason || finalReason.length < 3) {
      onToast("Please enter a valid archive reason (minimum 3 characters).");
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admin/customers/${dossier.user.id}/archive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: finalReason,
          note: archiveNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Unable to archive customer.");
      }
      onToast(`Customer ${dossier.user.customerId} archived successfully.`);
      setArchiveModalOpen(false);
      await fetchDossier();
      onCustomerStatusChanged?.();
    } catch (err: any) {
      onToast(err.message || "Failed to archive customer.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRestore = async () => {
    if (!dossier?.user) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admin/customers/${dossier.user.id}/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Unable to restore customer.");
      }
      onToast(`Customer ${dossier.user.customerId} restored successfully to active status.`);
      setRestoreModalOpen(false);
      await fetchDossier();
      onCustomerStatusChanged?.();
    } catch (err: any) {
      onToast(err.message || "Failed to restore customer.");
    } finally {
      setSubmittingAction(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDossier();
    }
  }, [userId]);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center justify-center gap-3">
          <RefreshCw size={28} className="animate-spin text-indigo-600" />
          <span className="font-medium text-slate-700">Loading complete customer dossier...</span>
        </div>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
          <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
          <h3 className="font-bold text-slate-800">Customer Dossier Not Found</h3>
          <p className="text-xs text-slate-500 mt-1">Unable to locate records for user {userId}.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, bookings, payments, invoices, refunds, supportTickets, notifications, activityTimeline, auditTrail } = dossier;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Dossier Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
              {(user.fullName ? user.fullName[0] : user.email[0]).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{user.fullName || "Unnamed Customer"}</h2>
                {user.isNew && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider animate-pulse">
                    NEW
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  user.isArchived || user.status === "archived"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : user.status === "suspended"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}>
                  {user.isArchived || user.status === "archived" ? "ARCHIVED" : (user.status || "active")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-indigo-200 mt-1 flex-wrap font-mono">
                <span className="bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700/50 text-indigo-300 font-bold">
                  User ID: {user.customerId}
                </span>
                <span className="flex items-center gap-1 font-sans">
                  <Mail size={12} /> {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1 font-sans">
                    <Phone size={12} /> {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1 font-sans text-slate-400">
                  <Calendar size={12} /> Joined {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.isArchived || user.status === "archived" ? (
              <button
                type="button"
                onClick={() => setRestoreModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <RotateCcw size={13} />
                <span>Restore Customer</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setArchiveReason("Customer Requested Account Closure");
                  setArchiveCustomReason("");
                  setArchiveNote("");
                  setArchiveModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Archive size={13} />
                <span>Archive Customer</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition"
              title="Close Dossier"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto text-xs font-semibold text-slate-600">
          {[
            { id: "overview", label: "Overview", icon: User },
            { id: "bookings", label: `Bookings (${bookings.length})`, icon: Luggage },
            { id: "payments", label: `Payments (${payments.length})`, icon: CreditCard },
            { id: "invoices", label: `Invoices (${invoices.length})`, icon: FileText },
            { id: "refunds", label: `Refunds (${refunds.length})`, icon: RotateCcw },
            { id: "support", label: `Support (${supportTickets.length})`, icon: MessageSquare },
            { id: "notifications", label: `Notifications (${notifications.length})`, icon: Bell },
            { id: "timeline", label: `Timeline (${activityTimeline.length})`, icon: Clock },
            { id: "audit", label: `Audit Trail (${auditTrail.length})`, icon: ShieldAlert },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-indigo-600 text-indigo-700 bg-white font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm bg-white">
          {/* 1. OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Total Trips Booked</span>
                  <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalBookings}</div>
                  <span className="text-[11px] text-emerald-600 font-medium">{stats.confirmedBookings} confirmed</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Total Spend</span>
                  <div className="text-2xl font-bold text-indigo-700 mt-1">₹{stats.totalSpend.toLocaleString("en-IN")}</div>
                  <span className="text-[11px] text-slate-400">Lifetime booking value</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Pending Payments</span>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingPayments}</div>
                  <span className="text-[11px] text-slate-400">Awaiting customer payment</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-semibold uppercase">Open Support Tickets</span>
                  <div className="text-2xl font-bold text-rose-600 mt-1">{stats.openTickets}</div>
                  <span className="text-[11px] text-slate-400">Customer care enquiries</span>
                </div>
              </div>

              {/* Archival Status Banner */}
              {(user.isArchived || user.status === "archived") && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                      <Archive size={16} />
                      <span>Customer Account Archived (Soft Deleted)</span>
                    </div>
                    <span className="bg-rose-100 text-rose-800 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold border border-rose-200">
                      Hidden from Active List
                    </span>
                  </div>
                  <p className="text-rose-700 leading-relaxed">
                    This customer account is archived. Normal customer login is blocked, but all historical records—including bookings, payments, invoices, refunds, and support tickets—remain fully preserved and protected in the database.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-rose-200/70 text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Archived On</span>
                      <strong className="text-slate-900">{user.archivedAt ? new Date(user.archivedAt).toLocaleString() : "—"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Archived By</span>
                      <strong className="text-slate-900">{user.archivedByName || "Administrator"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] font-medium">Archive Reason</span>
                      <strong className="text-rose-800">{user.archiveReason || "Not specified"}</strong>
                    </div>
                  </div>
                  {user.archiveNote && (
                    <div className="bg-white/90 p-2.5 rounded-lg border border-rose-100 text-slate-800">
                      <span className="text-[11px] font-bold text-slate-600 block">Admin Context Note:</span>
                      <span className="italic">{user.archiveNote}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Details Grid */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Account Credentials & Verification</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Permanent Customer ID</span>
                    <strong className="font-mono text-indigo-700 text-sm">{user.customerId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email Verification Status</span>
                    <strong className={user.emailVerified ? "text-emerald-700" : "text-amber-700"}>
                      {user.emailVerified ? "✓ Verified Email Address" : "Pending Verification"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Authentication Provider</span>
                    <strong className="capitalize text-slate-800">{user.authProvider || "email"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Recorded Login</span>
                    <strong className="text-slate-800">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never logged in"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Internal Account UUID</span>
                    <span className="font-mono text-[11px] text-slate-600">{user.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Platform Role</span>
                    <span className="font-semibold text-slate-800 uppercase">{user.role}</span>
                  </div>
                </div>
              </div>

              {/* Recent Booking Highlight */}
              {bookings.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Most Recent Booking</h4>
                  <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-indigo-950">Ref: {bookings[0].bookingReference}</div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Travel Date: {bookings[0].travelDate || "TBD"} · Amount: ₹{(bookings[0].amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white">
                      {bookings[0].status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. BOOKINGS */}
          {activeTab === "bookings" && (
            <div>
              {bookings.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No booking records found for this user.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase font-semibold">
                        <th className="py-2.5 px-3">Reference / PNR</th>
                        <th className="py-2.5 px-3">Travel Date</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Booking Status</th>
                        <th className="py-2.5 px-3">Payment Status</th>
                        <th className="py-2.5 px-3">Booked On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <div>{b.bookingReference || b.id.substring(0, 8)}</div>
                            <div className="text-slate-400 text-[11px]">PNR: {b.pnr || "—"}</div>
                          </td>
                          <td className="py-2.5 px-3">{b.travelDate || "—"}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">₹{(b.amount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                              {b.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              b.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {b.paymentStatus || "PENDING"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. PAYMENTS */}
          {activeTab === "payments" && (
            <div>
              {payments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No payment records found for this user.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase font-semibold">
                        <th className="py-2.5 px-3">Payment / Order ID</th>
                        <th className="py-2.5 px-3">Provider</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Refund Status</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono">
                            <div className="text-slate-800 font-semibold">{p.providerOrderId || p.razorpayOrderId || "—"}</div>
                            <div className="text-slate-400 text-[11px]">PayID: {p.providerPaymentId || p.razorpayPaymentId || "—"}</div>
                          </td>
                          <td className="py-2.5 px-3 uppercase text-slate-600">{p.provider || "Razorpay"}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">₹{(p.amount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.refundStatus || "NONE"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(p.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. INVOICES */}
          {activeTab === "invoices" && (
            <div>
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No invoices generated for this user.</div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv: any) => (
                    <div key={inv.invoiceNumber} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-indigo-600" />
                        <div>
                          <div className="font-bold text-slate-800">{inv.invoiceNumber}</div>
                          <div className="text-xs text-slate-500">
                            Booking Ref: {inv.bookingReference} · Date: {new Date(inv.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">₹{(inv.amount || 0).toLocaleString("en-IN")}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. REFUNDS */}
          {activeTab === "refunds" && (
            <div>
              {refunds.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No refund requests or records for this customer.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase font-semibold">
                      <th className="py-2.5 px-3">Refund Amount</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Processed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {refunds.map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-800">₹{(r.amount || 0).toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3">{r.reason}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">{r.status}</td>
                        <td className="py-2.5 px-3 text-slate-500">{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : "Pending"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 6. SUPPORT TICKETS */}
          {activeTab === "support" && (
            <div>
              {supportTickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No support tickets filed by this customer.</div>
              ) : (
                <div className="space-y-3">
                  {supportTickets.map((t: any) => (
                    <div key={t.id} className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700">{t.ticketNumber}</span>
                          <strong className="text-slate-800 text-sm">{t.subject}</strong>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{t.description}</p>
                      {t.resolutionNotes && (
                        <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200">
                          <strong>Resolution:</strong> {t.resolutionNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div>
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No notifications dispatched to this user.</div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n: any) => (
                    <div key={n.id} className="p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                      {n.imageUrl ? (
                        <img src={n.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Bell size={18} />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {n.category || n.type}
                            </span>
                            <strong className="text-slate-800">{n.title}</strong>
                          </div>
                          <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                          <span>Read: {n.readAt ? `✓ ${new Date(n.readAt).toLocaleTimeString()}` : "Unread"}</span>
                          {n.clickedAt && <span className="text-amber-600 font-semibold">👆 Clicked CTA</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. ACTIVITY TIMELINE (STRICTLY REAL EVENTS) */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>
                  <strong>Strict Integrity Mode:</strong> This timeline contains only persisted, verifiable database records. No synthetic or simulated history is displayed.
                </span>
              </div>
              <div className="relative border-l-2 border-indigo-200 ml-4 space-y-6 pl-5 py-2">
                {activityTimeline.map((item: any) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{item.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div>
              {auditTrail.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No administrative audit records logged for this customer.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase font-semibold">
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Resource</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditTrail.map((log: any) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-600">{log.actorRole || "system"}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{log.resourceType}</td>
                        <td className="py-2.5 px-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Customer Dossier Reference: {user.customerId} · {user.email}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow transition"
          >
            Close Dossier
          </button>
        </div>
      </div>

      {/* IN-DOSSIER ARCHIVE CUSTOMER CONFIRMATION MODAL */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600/30 text-rose-300 border border-rose-500/30">
                  <Archive size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base">Archive Customer Account?</h3>
                  <p className="text-xs text-rose-200">Safe lifecycle soft-delete management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{user.fullName}</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">{user.email}</div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {user.customerId}
                </span>
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 leading-relaxed text-xs">
                <strong>Important:</strong> The customer will be removed from the normal active customer list and blocked from login. However, their <strong>permanent Customer ID, bookings, payments, invoices, refunds, support tickets, and audit history will remain 100% preserved</strong> in the database.
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Archive Reason <span className="text-rose-600">*</span>
                </label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Customer Requested Account Closure">Customer Requested Account Closure</option>
                  <option value="Duplicate Account">Duplicate Account</option>
                  <option value="Inactive Account">Inactive Account</option>
                  <option value="Test Account">Test Account</option>
                  <option value="Suspicious/Abusive Account">Suspicious/Abusive Account</option>
                  <option value="Other">Other (Specify below)</option>
                </select>
              </div>

              {archiveReason === "Other" && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Custom Archive Reason <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={archiveCustomReason}
                    onChange={(e) => setArchiveCustomReason(e.target.value)}
                    placeholder="Enter specific reason for archiving..."
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Admin Context Note <span className="text-slate-400 font-normal">(Optional internal audit note)</span>
                </label>
                <textarea
                  value={archiveNote}
                  onChange={(e) => setArchiveNote(e.target.value)}
                  placeholder="Add any internal administrative notes or references..."
                  rows={3}
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={submittingAction}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <Archive size={13} />
                    <span>Archive Customer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-DOSSIER RESTORE CUSTOMER CONFIRMATION MODAL */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-300 border border-emerald-500/30">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base">Restore Customer Account?</h3>
                  <p className="text-xs text-emerald-200">Return customer to active status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{user.fullName}</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">{user.email}</div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {user.customerId}
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 leading-relaxed text-xs">
                This will return the customer to the active customer list and restore their active account status while preserving all existing account history, bookings, and payments.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={submittingAction}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Restore Customer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
