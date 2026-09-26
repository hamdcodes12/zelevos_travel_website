import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ExternalLink,
  Image as ImageIcon,
  Eye,
  MousePointerClick,
  X,
  RefreshCw,
  Plus,
  Ban,
  Tag,
  Bell,
  Sparkles,
  Search,
} from "lucide-react";

type BroadcastItem = {
  id: string;
  title: string;
  message: string;
  category: "ANNOUNCEMENT" | "OFFER" | "ALERT" | "UPDATE" | "POLICY";
  imageUrl: string | null;
  actionButton: string | null;
  actionUrl: string | null;
  targetAudience: "ALL_CUSTOMERS" | "SPECIFIC_USER" | "UPCOMING_TRIPS" | "PAST_BOOKINGS" | "PAYMENT_PENDING";
  targetUserId: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED" | "EXPIRED";
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  readCount: number;
  clickCount: number;
  createdAt: string;
};

type RecipientItem = {
  id: string;
  userId: string;
  customerId: string;
  fullName: string;
  email: string;
  status: string;
  readAt: string | null;
  clickedAt: string | null;
  createdAt: string;
};

export function AdminBroadcastsTab({ onToast }: { onToast: (message: string) => void }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBroadcastForRecipients, setSelectedBroadcastForRecipients] = useState<BroadcastItem | null>(null);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"ANNOUNCEMENT" | "OFFER" | "ALERT" | "UPDATE" | "POLICY">("OFFER");
  const [imageUrl, setImageUrl] = useState("");
  const [actionButton, setActionButton] = useState("Explore Now");
  const [actionUrl, setActionUrl] = useState("/#curated-packages");
  const [targetAudience, setTargetAudience] = useState<"ALL_CUSTOMERS" | "SPECIFIC_USER" | "UPCOMING_TRIPS" | "PAST_BOOKINGS" | "PAYMENT_PENDING">("ALL_CUSTOMERS");
  const [targetUserId, setTargetUserId] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/broadcasts", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.broadcasts) {
        setBroadcasts(data.broadcasts);
      }
    } catch (err) {
      console.error("Failed loading broadcasts", err);
      onToast("Failed to load broadcast history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/admin/broadcasts/upload-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        onToast("Image uploaded successfully!");
      } else {
        onToast(data.message || "Image upload failed.");
      }
    } catch (err) {
      console.error(err);
      onToast("Image upload error.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      onToast("Please fill in title and message.");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        category,
        imageUrl: imageUrl.trim() || null,
        actionButton: actionButton.trim() || null,
        actionUrl: actionUrl.trim() || null,
        targetAudience,
        targetUserId: targetAudience === "SPECIFIC_USER" ? targetUserId.trim() : undefined,
      };

      if (isScheduled && scheduledDate) {
        payload.scheduledAt = new Date(scheduledDate).toISOString();
      }

      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.broadcast) {
        onToast(isScheduled ? "Broadcast scheduled successfully!" : `Broadcast dispatched to ${data.broadcast.totalRecipients} recipients!`);
        setShowCreateModal(false);
        // Reset form
        setTitle("");
        setMessage("");
        setImageUrl("");
        setImagePreview("");
        setActionButton("Explore Now");
        setActionUrl("/#curated-packages");
        setTargetAudience("ALL_CUSTOMERS");
        setTargetUserId("");
        setIsScheduled(false);
        setScheduledDate("");
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to create broadcast.");
      }
    } catch (err) {
      console.error(err);
      onToast("Network error creating broadcast.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBroadcast = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled broadcast?")) return;
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Scheduled broadcast cancelled.");
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to cancel broadcast.");
      }
    } catch {
      onToast("Error cancelling broadcast.");
    }
  };

  const handleViewRecipients = async (broadcast: BroadcastItem) => {
    setSelectedBroadcastForRecipients(broadcast);
    setLoadingRecipients(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/recipients`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.recipients) {
        setRecipients(data.recipients);
      }
    } catch (err) {
      console.error(err);
      onToast("Failed to load recipient details.");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "OFFER":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><Tag size={11} /> OFFER</span>;
      case "ALERT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle size={11} /> ALERT</span>;
      case "UPDATE":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><RefreshCw size={11} /> UPDATE</span>;
      case "POLICY":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><Sparkles size={11} /> POLICY</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Megaphone size={11} /> ANNOUNCEMENT</span>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "SENT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 size={11} /> SENT</span>;
      case "SCHEDULED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><Clock size={11} /> SCHEDULED</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"><Ban size={11} /> CANCELLED</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{st}</span>;
    }
  };

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
      case "ALL_CUSTOMERS": return "All Customers (Global)";
      case "SPECIFIC_USER": return "Targeted User";
      case "UPCOMING_TRIPS": return "Upcoming Travelers";
      case "PAST_BOOKINGS": return "Past Travelers";
      case "PAYMENT_PENDING": return "Pending Payments";
      default: return aud;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Megaphone size={16} /> Broadcasts & Offer Center
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Push Announcements & Seasonal Offers</h2>
          <p className="text-indigo-200 text-sm mt-1 max-w-2xl">
            Dispatch official platform alerts, holiday packages discounts, and customized announcements straight into customer notification inboxes with real-time delivery and click tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBroadcasts}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
            title="Refresh history"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5"
          >
            <Plus size={16} /> Create Broadcast
          </button>
        </div>
      </div>

      {/* Broadcast Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Broadcasts</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{broadcasts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Delivered</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.totalRecipients || 0), 0)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reads</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.readCount || 0), 0)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Button Clicks</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.clickCount || 0), 0)}
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Clock size={18} className="text-slate-500" /> Broadcast History & Analytics
          </h3>
          <span className="text-xs text-slate-500 font-medium">{broadcasts.length} entries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-indigo-500" />
            <span>Loading broadcast records...</span>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No broadcasts have been created yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "Create Broadcast" to send your first official announcement or offer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Broadcast / Campaign</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Target Audience</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Recipients</th>
                  <th className="py-3 px-4 text-center">Reads</th>
                  <th className="py-3 px-4 text-center">Clicks</th>
                  <th className="py-3 px-4">Sent / Scheduled</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.map((b) => {
                  const readRate = b.totalRecipients > 0 ? Math.round((b.readCount / b.totalRecipients) * 100) : 0;
                  const clickRate = b.readCount > 0 ? Math.round((b.clickCount / b.readCount) * 100) : 0;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {b.imageUrl ? (
                            <img
                              src={b.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                              <Megaphone size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-800 line-clamp-1">{b.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{b.message}</div>
                            {b.actionButton && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                                <ExternalLink size={10} /> CTA: {b.actionButton} ({b.actionUrl || "URL"})
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getCategoryBadge(b.category)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700">
                        <span className="font-medium">{getAudienceLabel(b.targetAudience)}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center font-semibold text-slate-700">
                        {b.totalRecipients}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className="font-semibold text-slate-800">{b.readCount}</span>
                        <span className="text-[11px] text-slate-400 block">({readRate}%)</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className="font-semibold text-slate-800">{b.clickCount}</span>
                        <span className="text-[11px] text-slate-400 block">({clickRate}%)</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {b.status === "SCHEDULED" ? (
                          <span className="text-blue-600 font-medium">
                            <Clock size={11} className="inline mr-1" />
                            {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "Scheduled"}
                          </span>
                        ) : b.sentAt ? (
                          new Date(b.sentAt).toLocaleString()
                        ) : (
                          new Date(b.createdAt).toLocaleString()
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleViewRecipients(b)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                          title="View delivered recipients"
                        >
                          Recipients
                        </button>
                        {b.status === "SCHEDULED" && (
                          <button
                            onClick={() => handleCancelBroadcast(b.id)}
                            className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE BROADCAST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 my-8 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={18} />
                <h3 className="font-bold text-lg">Create New Announcement / Offer</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBroadcast} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 🌸 Kashmir Spring Festival: Flat 20% Off All Bookings!"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="OFFER">🏷️ Promotional Offer / Discount</option>
                    <option value="ANNOUNCEMENT">📢 General Announcement</option>
                    <option value="ALERT">⚠️ Important Travel Alert</option>
                    <option value="UPDATE">🔄 Platform Update</option>
                    <option value="POLICY">📋 Policy / Operational Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e: any) => setTargetAudience(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="ALL_CUSTOMERS">👥 All Registered Customers</option>
                    <option value="SPECIFIC_USER">👤 Specific User (By User ID or Email)</option>
                    <option value="UPCOMING_TRIPS">✈️ Customers With Confirmed / Upcoming Trips</option>
                    <option value="PAST_BOOKINGS">🧳 Customers With Past / Completed Trips</option>
                    <option value="PAYMENT_PENDING">💳 Customers With Pending Payments</option>
                  </select>
                </div>
              </div>

              {targetAudience === "SPECIFIC_USER" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Customer User ID or Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="Enter ZLV-CUS-XXXXXX or customer@email.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Message Content *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter detailed message, promotion terms, or announcement instructions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Banner Image Upload & URL */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Campaign Banner Image (Optional)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {uploadingImage && <span className="text-xs text-indigo-600 animate-pulse">Uploading...</span>}
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Or paste image URL:</span>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImagePreview(e.target.value);
                    }}
                    placeholder="/kashmir-dawn.jpg or https://..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                {(imagePreview || imageUrl) && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-slate-200 max-h-40 w-full bg-slate-900">
                    <img
                      src={imagePreview || imageUrl}
                      alt="Banner Preview"
                      className="w-full h-36 object-cover"
                      onError={() => setImagePreview("")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setImagePreview("");
                      }}
                      className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-rose-600 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Button CTA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Call To Action Button Label
                  </label>
                  <input
                    type="text"
                    value={actionButton}
                    onChange={(e) => setActionButton(e.target.value)}
                    placeholder="e.g. View Offer, Check Booking"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Destination URL
                  </label>
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="e.g. /#curated-packages, /flights"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Schedule options */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Scheduling</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Schedule for later dispatch
                  </label>
                </div>
                {isScheduled && (
                  <div className="pt-2">
                    <label className="block text-xs text-slate-600 mb-1">Date and Time for Automatic Send:</label>
                    <input
                      type="datetime-local"
                      required={isScheduled}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Processing...
                    </>
                  ) : isScheduled ? (
                    <>
                      <Clock size={15} />
                      Schedule Broadcast
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Dispatch Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECIPIENTS MODAL */}
      {selectedBroadcastForRecipients && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delivery & Engagement Roster</h3>
                <span className="text-xs text-slate-500">
                  Broadcast: "{selectedBroadcastForRecipients.title}"
                </span>
              </div>
              <button
                onClick={() => setSelectedBroadcastForRecipients(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingRecipients ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-indigo-600" />
                  <span>Loading recipients...</span>
                </div>
              ) : recipients.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto text-slate-300 mb-2" />
                  <p>No recipient records found for this broadcast.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <th className="py-2.5 px-3">User ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Delivery Status</th>
                      <th className="py-2.5 px-3">Read At</th>
                      <th className="py-2.5 px-3">Clicked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-semibold text-indigo-700">
                          {r.customerId}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{r.fullName}</div>
                          <div className="text-slate-500">{r.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.readAt ? (
                            <span className="text-emerald-600 font-medium">
                              ✓ {new Date(r.readAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unread</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.clickedAt ? (
                            <span className="text-amber-600 font-medium">
                              👆 {new Date(r.clickedAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedBroadcastForRecipients(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
