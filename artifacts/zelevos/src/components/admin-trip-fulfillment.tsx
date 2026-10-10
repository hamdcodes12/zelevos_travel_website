import React, { useState, useEffect } from "react";
import {
  Building2,
  Car,
  Bus,
  Compass,
  Utensils,
  Plane,
  Plus,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Copy,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  Check,
  X,
  UserCheck,
} from "lucide-react";

interface AdminTripFulfillmentProps {
  bookingId: string;
  bookingRef: string;
  destination?: string;
  isPaid: boolean;
  onToast: (msg: string) => void;
}

export function AdminTripFulfillment({
  bookingId,
  bookingRef,
  destination = "Kashmir",
  isPaid,
  onToast,
}: AdminTripFulfillmentProps) {
  const [loading, setLoading] = useState(true);
  const [fulfillment, setFulfillment] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompType, setNewCompType] = useState("HOTEL");
  const [newCompTitle, setNewCompTitle] = useState("");
  const [newCompDay, setNewCompDay] = useState(1);

  // Vendor assign modal state
  const [assigningItem, setAssigningItem] = useState<any | null>(null);
  const [eligibleVendors, setEligibleVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");

  // Edit details modal state
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Action loading states
  const [sending, setSending] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [emailFailedState, setEmailFailedState] = useState(false);
  const [emailErrorText, setEmailErrorText] = useState("");

  useEffect(() => {
    loadFulfillment();
  }, [bookingId]);

  const loadFulfillment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setFulfillment(data.fulfillment);
        setItems(data.items || []);
        const isFailed = data.fulfillment?.emailStatus === "FAILED" || data.fulfillment?.lastEmailStatus === "FAILED";
        if (isFailed) {
          setEmailFailedState(true);
          setEmailErrorText(data.fulfillment?.emailError || data.fulfillment?.lastEmailError || "Previous email delivery failed");
        } else {
          setEmailFailedState(false);
          setEmailErrorText("");
        }
      }
    } catch (err: any) {
      onToast("Failed to load trip fulfillment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = async (item: any) => {
    setAssigningItem(item);
    setSelectedVendorId(item.vendorId || "");
    setLoadingVendors(true);
    try {
      const cat = item.componentType.toLowerCase();
      const res = await fetch(`/api/admin/fulfillment/vendors?category=${cat}&destination=${encodeURIComponent(destination)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setEligibleVendors(data.vendors || []);
        if (!item.vendorId && data.vendors?.length > 0) {
          setSelectedVendorId(data.vendors[0].id);
        }
      }
    } catch {
      onToast("Failed to load eligible vendors.");
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!assigningItem || !selectedVendorId) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/items/${assigningItem.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vendorId: selectedVendorId }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast(data.message || "Vendor assigned successfully.");
        setAssigningItem(null);
        loadFulfillment();
      } else {
        onToast(data.message || "Failed to assign vendor.");
      }
    } catch {
      onToast("Network error while assigning vendor.");
    }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompTitle.trim()) return;

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          componentType: newCompType,
          title: newCompTitle.trim(),
          dayNumber: newCompDay,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Component added.");
        setShowAddModal(false);
        setNewCompTitle("");
        loadFulfillment();
      } else {
        onToast(data.message || "Failed to add component.");
      }
    } catch {
      onToast("Error adding component.");
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditForm({ ...item.details, title: item.title, dayNumber: item.dayNumber });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      const { title, dayNumber, ...details } = editForm;
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, dayNumber, details }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Component details saved.");
        setEditingItem(null);
        loadFulfillment();
      } else {
        onToast(data.message || "Failed to save component details.");
      }
    } catch {
      onToast("Error saving component details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleApproveComponent = async (item: any) => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast(`Component "${item.title}" approved!`);
        loadFulfillment();
      } else {
        onToast(data.message || "Failed to approve component.");
      }
    } catch {
      onToast("Error approving component.");
    }
  };

  const handleDeleteComponent = async (itemId: string) => {
    if (!window.confirm("Remove this fulfillment component?")) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        onToast("Component removed.");
        loadFulfillment();
      }
    } catch {
      onToast("Failed to delete component.");
    }
  };

  const handleSendToCustomer = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/send`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.emailFailed || data.fulfillment?.emailStatus === "FAILED") {
          setEmailFailedState(true);
          const err = data.error || data.fulfillment?.emailError || "Email delivery failed";
          setEmailErrorText(err);
          onToast(`Saved, but email failed: ${err}`);
        } else {
          setEmailFailedState(false);
          setEmailErrorText("");
          onToast(data.message || `Trip fulfillment sent to ${data.fulfillment?.emailSentTo || "customer"}!`);
        }
        loadFulfillment();
      } else {
        onToast(data.message || "Cannot send fulfillment.");
      }
    } catch {
      onToast("Error sending trip fulfillment.");
    } finally {
      setSending(false);
    }
  };

  const handleRetryEmail = async () => {
    setRetryingEmail(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/fulfillment/retry-email`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setEmailFailedState(false);
        setEmailErrorText("");
        onToast(data.message || "Email delivered successfully.");
        loadFulfillment();
      } else {
        setEmailFailedState(true);
        const err = data.message || data.error || "Retry failed.";
        setEmailErrorText(err);
        onToast(`Email failed: ${err}`);
        loadFulfillment();
      }
    } catch {
      onToast("Network error while retrying email.");
    } finally {
      setRetryingEmail(false);
    }
  };

  const allApproved = items.length > 0 && items.every((i) => i.status === "APPROVED");
  const canSend = isPaid && allApproved;

  const getComponentIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "HOTEL":
        return <Building2 size={16} className="text-blue-600" />;
      case "CAB":
        return <Car size={16} className="text-emerald-600" />;
      case "BUS":
        return <Bus size={16} className="text-amber-600" />;
      case "GUIDE":
        return <Compass size={16} className="text-purple-600" />;
      case "MEALS":
        return <Utensils size={16} className="text-orange-600" />;
      case "FLIGHT":
        return <Plane size={16} className="text-indigo-600" />;
      default:
        return <FileText size={16} className="text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
        <RefreshCw size={20} className="animate-spin inline mr-2" />
        Loading trip fulfillment status...
      </div>
    );
  }

  return (
    <div style={{ marginTop: "24px", borderTop: "2px solid #e2e8f0", paddingTop: "20px" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Trip Fulfillment Management
            </h3>
            {fulfillment && (
              <span
                style={{
                  background:
                    fulfillment.status === "SENT" || fulfillment.status === "UPDATED"
                      ? "#ecfdf5"
                      : "#fef3c7",
                  color:
                    fulfillment.status === "SENT" || fulfillment.status === "UPDATED"
                      ? "#059669"
                      : "#d97706",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                {fulfillment.status} (v{fulfillment.version || 1})
              </span>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
            Assign approved portal suppliers, review ground details, and send official vouchers to customer.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            id="admin-add-fulfillment-comp-btn"
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} /> + Add Component
          </button>

          <button
            type="button"
            id="admin-preview-fulfillment-btn"
            onClick={() => setShowPreview(true)}
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#1d4ed8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Eye size={14} /> Preview Voucher
          </button>
        </div>
      </div>

      {/* Warnings & Notices */}
      {!isPaid && (
        <div
          id="fulfillment-unpaid-warning"
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
            color: "#b45309",
            fontSize: "13px",
          }}
        >
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>
            <strong>Payment Pending:</strong> "Send to customer" is disabled until payment is captured via Razorpay.
          </span>
        </div>
      )}

      {/* Green Email Sent Banner */}
      {!emailFailedState && (fulfillment?.emailStatus === "SENT" || fulfillment?.lastEmailStatus === "SENT") && (
        <div
          id="fulfillment-email-sent-banner"
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "10px",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            color: "#065f46",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>
              <strong>Email sent to {fulfillment?.emailSentTo || fulfillment?.email_sent_to || "customer"}</strong>
              {fulfillment?.emailSentAt && (
                <span style={{ fontSize: "12px", color: "#047857", marginLeft: "8px" }}>
                  ({new Date(fulfillment.emailSentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            id="admin-resend-email-btn"
            onClick={handleRetryEmail}
            disabled={retryingEmail}
            style={{
              background: "#059669",
              color: "#ffffff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={13} className={retryingEmail ? "animate-spin" : ""} />
            {retryingEmail ? "Resending..." : "Resend Email"}
          </button>
        </div>
      )}

      {/* Red Email Failed Banner */}
      {(emailFailedState || fulfillment?.emailStatus === "FAILED" || (!fulfillment?.emailStatus && fulfillment?.lastEmailStatus === "FAILED")) && (
        <div
          id="fulfillment-email-failed-banner"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            color: "#b91c1c",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={18} className="flex-shrink-0" />
            <span>
              <strong>Email failed:</strong> {fulfillment?.emailError || emailErrorText || "Delivery error"}
            </span>
          </div>
          <button
            type="button"
            id="admin-retry-email-btn"
            onClick={handleRetryEmail}
            disabled={retryingEmail}
            style={{
              background: "#b91c1c",
              color: "#ffffff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={13} className={retryingEmail ? "animate-spin" : ""} />
            {retryingEmail ? "Resending..." : "Resend Email"}
          </button>
        </div>
      )}

      {/* Components List */}
      <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
        {items.length === 0 ? (
          <div style={{ background: "#f8fafc", padding: "24px", textAlign: "center", borderRadius: "10px", border: "1px dashed #cbd5e1", color: "#64748b", fontSize: "13px" }}>
            No fulfillment components created yet. Click "+ Add Component" above.
          </div>
        ) : (
          items.map((item) => {
            const details = item.details || {};
            const isApproved = item.status === "APPROVED";
            const isSubmitted = item.status === "SUBMITTED";
            const isAssigned = item.status === "ASSIGNED";

            return (
              <div
                key={item.id}
                id={`fulfillment-item-${item.id}`}
                style={{
                  background: "#ffffff",
                  border: isApproved ? "1px solid #bbf7d0" : isSubmitted ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", display: "grid", placeItems: "center" }}>
                      {getComponentIcon(item.componentType)}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          Day {item.dayNumber} · {item.componentType}
                        </span>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{item.title}</strong>
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {item.assignedVendor ? (
                          <span>
                            Vendor: <strong>{item.assignedVendor.businessName}</strong> ({item.assignedVendor.phone})
                          </span>
                        ) : (
                          <span style={{ color: "#d97706" }}>No vendor assigned yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Component Controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background:
                          isApproved
                            ? "#ecfdf5"
                            : isSubmitted
                            ? "#eff6ff"
                            : isAssigned
                            ? "#fef3c7"
                            : "#f1f5f9",
                        color:
                          isApproved
                            ? "#059669"
                            : isSubmitted
                            ? "#1d4ed8"
                            : isAssigned
                            ? "#d97706"
                            : "#475569",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      {item.status}
                    </span>

                    <button
                      type="button"
                      id={`btn-assign-vendor-${item.id}`}
                      onClick={() => handleOpenAssignModal(item)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        color: "#334155",
                      }}
                    >
                      {item.assignedVendor ? "Reassign Vendor" : "Assign Vendor"}
                    </button>

                    <button
                      type="button"
                      id={`btn-edit-item-${item.id}`}
                      onClick={() => handleOpenEdit(item)}
                      title="Edit arrangement fields"
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#475569",
                      }}
                    >
                      <Edit2 size={13} />
                    </button>

                    {!isApproved && (
                      <button
                        type="button"
                        id={`btn-approve-item-${item.id}`}
                        onClick={() => handleApproveComponent(item)}
                        style={{
                          background: "#059669",
                          color: "#ffffff",
                          border: "none",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Check size={13} /> Approve
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteComponent(item.id)}
                      title="Delete component"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "4px",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Specific Details Summary */}
                <div style={{ marginTop: "12px", background: "#f8fafc", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#334155" }}>
                  {item.componentType === "HOTEL" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Hotel:</strong> {details.hotelName || "Pending input"}</div>
                      <div><strong>Room:</strong> {details.roomType || "Standard Deluxe"} ({details.numberOfRooms || 1} Rooms)</div>
                      <div><strong>Check-in:</strong> {details.checkInDate || "—"} ({details.checkInTime || "14:00"})</div>
                      <div><strong>Check-out:</strong> {details.checkOutDate || "—"} ({details.checkOutTime || "11:00"})</div>
                      <div><strong>Address:</strong> {details.fullAddress || "—"}</div>
                      <div><strong>Phone:</strong> {details.hotelPhone || "—"}</div>
                      <div><strong>Conf #:</strong> {details.confirmationNumber || "—"}</div>
                    </div>
                  )}

                  {item.componentType === "CAB" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Chauffeur:</strong> {details.driverName || "Pending input"}</div>
                      <div><strong>Driver Phone:</strong> {details.driverPhone || "—"}</div>
                      <div><strong>Vehicle:</strong> {details.vehicleModel || "—"}</div>
                      <div><strong>Reg Number:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{details.vehicleRegistrationNumber || "—"}</span></div>
                      <div><strong>Pickup:</strong> {details.pickupPoint || "—"} at {details.pickupDateTime || "—"}</div>
                      <div><strong>Drop:</strong> {details.dropPoint || "—"}</div>
                    </div>
                  )}

                  {item.componentType === "BUS" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Operator:</strong> {details.operatorName || "Pending input"}</div>
                      <div><strong>Bus Reg:</strong> {details.busRegistrationNumber || "—"}</div>
                      <div><strong>Bus Type:</strong> {details.busType || "Volvo AC Multi-Axle"}</div>
                      <div><strong>Seat(s):</strong> {details.seatNumbers || "—"}</div>
                      <div><strong>Boarding:</strong> {details.boardingPoint || "—"} at {details.departureDateTime || "—"}</div>
                      <div><strong>PNR / Ticket:</strong> {details.ticketPnr || "—"}</div>
                    </div>
                  )}

                  {item.componentType === "GUIDE" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Guide:</strong> {details.guideName || "Pending input"}</div>
                      <div><strong>Phone:</strong> {details.phone || "—"}</div>
                      <div><strong>Languages:</strong> {details.languages || "English, Hindi"}</div>
                      <div><strong>Meeting:</strong> {details.meetingPoint || "—"} at {details.dateTime || "—"}</div>
                    </div>
                  )}

                  {item.componentType === "MEALS" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Provider:</strong> {details.providerName || "Pending input"}</div>
                      <div><strong>Meals Included:</strong> {details.mealsIncluded || "Breakfast & Dinner"}</div>
                      <div><strong>Address:</strong> {details.address || "—"}</div>
                      <div><strong>Timings:</strong> {details.timings || "—"}</div>
                    </div>
                  )}

                  {item.componentType === "FLIGHT" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <div><strong>Airline:</strong> {details.airline || "Pending input"} ({details.flightNumber || ""})</div>
                      <div><strong>PNR:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{details.pnr || "—"}</span></div>
                      <div><strong>Route:</strong> {details.fromAirport || "DEL"} ➔ {details.toAirport || "SXR"}</div>
                      <div><strong>Departure:</strong> {details.departureDateTime || "—"}</div>
                      <div><strong>Baggage:</strong> {details.baggage || "15kg + 7kg"}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Dispatch Bar */}
      <div
        style={{
          background: "#0f172a",
          borderRadius: "14px",
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          color: "#ffffff",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <strong style={{ fontSize: "15px" }}>Ready to Send Trip Voucher?</strong>
            {canSend ? (
              <span style={{ background: "#059669", color: "#ffffff", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
                ALL APPROVED
              </span>
            ) : (
              <span style={{ background: "#475569", color: "#cbd5e1", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
                {!isPaid ? "PAYMENT REQUIRED" : "COMPONENTS PENDING APPROVAL"}
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
            Generates server-side PDF voucher, links private download, emails customer with PDF attached, and sends in-app alert.
          </p>
        </div>

        <button
          type="button"
          id="admin-send-to-customer-btn"
          onClick={handleSendToCustomer}
          disabled={!canSend || sending}
          style={{
            background: canSend ? "linear-gradient(90deg, #2563eb, #1d4ed8)" : "#334155",
            color: "#ffffff",
            border: "none",
            padding: "10px 22px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: canSend ? "0 4px 14px rgba(37, 99, 235, 0.4)" : "none",
            opacity: canSend ? 1 : 0.6,
          }}
        >
          <Send size={15} />
          <span>{sending ? "Generating & Sending..." : "Send to Customer"}</span>
        </button>
      </div>

      {/* MODAL: ASSIGN VENDOR */}
      {assigningItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "560px", width: "100%", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Assign Approved Vendor for {assigningItem.componentType}
              </h4>
              <button type="button" onClick={() => setAssigningItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 16px" }}>
              Only approved, non-suspended vendors with matching service category are listed from the portal catalog.
              Vendors with services in <strong>{destination}</strong> appear first labelled <strong>Suggested</strong>.
            </p>

            {loadingVendors ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Loading vendors...</div>
            ) : eligibleVendors.length === 0 ? (
              <div style={{ padding: "20px", background: "#fef2f2", borderRadius: "8px", color: "#991b1b", fontSize: "13px" }}>
                No approved vendors found matching category "{assigningItem.componentType}". Please onboard a vendor first.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px", maxHeight: "300px", overflowY: "auto", marginBottom: "20px" }}>
                {eligibleVendors.map((v) => {
                  const isSelected = selectedVendorId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVendorId(v.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "13px", color: "#0f172a" }}>{v.businessName}</strong>
                          {v.suggested && (
                            <span style={{ background: "#dcfce7", color: "#166534", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px" }}>
                              Suggested ({destination})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>
                          Contact: {v.contactName} · {v.phone} {v.listedRate ? `· Rate: ₹${v.listedRate.toLocaleString()}` : ""}
                        </span>
                      </div>
                      <input type="radio" checked={isSelected} onChange={() => setSelectedVendorId(v.id)} />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setAssigningItem(null)}
                style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-assign-vendor"
                onClick={handleConfirmAssign}
                disabled={!selectedVendorId}
                style={{
                  background: selectedVendorId ? "#2563eb" : "#94a3b8",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: selectedVendorId ? "pointer" : "not-allowed",
                }}
              >
                Assign & Dispatch Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD COMPONENT */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "480px", width: "100%", padding: "24px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 16px", color: "#0f172a" }}>
              Add Trip Fulfillment Component
            </h4>
            <form onSubmit={handleAddComponent} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Component Type
                </label>
                <select
                  value={newCompType}
                  onChange={(e) => {
                    setNewCompType(e.target.value);
                    if (!newCompTitle) setNewCompTitle(`${e.target.value} Arrangement`);
                  }}
                  style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 10px", fontSize: "13px" }}
                >
                  <option value="HOTEL">HOTEL (Accommodations & Stays)</option>
                  <option value="CAB">CAB (Chauffeur & Private Transfers)</option>
                  <option value="BUS">BUS (Intercity Coach / Sleeper)</option>
                  <option value="GUIDE">GUIDE (Sightseeing & Local Host)</option>
                  <option value="MEALS">MEALS (Dining & Catering)</option>
                  <option value="FLIGHT">FLIGHT (Air Tickets)</option>
                  <option value="OTHER">OTHER (Special ground services)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Title / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pahalgam Boutique Hotel Stay"
                  value={newCompTitle}
                  onChange={(e) => setNewCompTitle(e.target.value)}
                  style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 10px", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Itinerary Day
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newCompDay}
                  onChange={(e) => setNewCompDay(Number(e.target.value))}
                  style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 10px", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  Add Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COMPONENT DETAILS */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "620px", width: "100%", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Edit Details: {editingItem.componentType} ({editingItem.title})
              </h4>
              <button type="button" onClick={() => setEditingItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Title</label>
                <input
                  type="text"
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              {/* HOTEL FIELDS */}
              {editingItem.componentType === "HOTEL" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Hotel Name</label>
                      <input
                        type="text"
                        value={editForm.hotelName || ""}
                        onChange={(e) => setEditForm({ ...editForm, hotelName: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Room Type</label>
                      <input
                        type="text"
                        value={editForm.roomType || ""}
                        onChange={(e) => setEditForm({ ...editForm, roomType: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Full Address</label>
                    <input
                      type="text"
                      value={editForm.fullAddress || ""}
                      onChange={(e) => setEditForm({ ...editForm, fullAddress: e.target.value })}
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Hotel Phone</label>
                      <input
                        type="text"
                        value={editForm.hotelPhone || ""}
                        onChange={(e) => setEditForm({ ...editForm, hotelPhone: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Confirmation Number</label>
                      <input
                        type="text"
                        value={editForm.confirmationNumber || ""}
                        onChange={(e) => setEditForm({ ...editForm, confirmationNumber: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Check-in Date & Time</label>
                      <input
                        type="text"
                        value={editForm.checkInDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, checkInDate: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Meal Plan</label>
                      <input
                        type="text"
                        value={editForm.mealPlan || ""}
                        onChange={(e) => setEditForm({ ...editForm, mealPlan: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* CAB FIELDS */}
              {editingItem.componentType === "CAB" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Driver Name</label>
                      <input
                        type="text"
                        value={editForm.driverName || ""}
                        onChange={(e) => setEditForm({ ...editForm, driverName: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Driver Phone (+91)</label>
                      <input
                        type="text"
                        value={editForm.driverPhone || ""}
                        onChange={(e) => setEditForm({ ...editForm, driverPhone: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Vehicle Model</label>
                      <input
                        type="text"
                        value={editForm.vehicleModel || ""}
                        onChange={(e) => setEditForm({ ...editForm, vehicleModel: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Vehicle Registration Number</label>
                      <input
                        type="text"
                        value={editForm.vehicleRegistrationNumber || ""}
                        onChange={(e) => setEditForm({ ...editForm, vehicleRegistrationNumber: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Pickup Point & Time</label>
                    <input
                      type="text"
                      value={editForm.pickupPoint || ""}
                      onChange={(e) => setEditForm({ ...editForm, pickupPoint: e.target.value })}
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Drop Point</label>
                    <input
                      type="text"
                      value={editForm.dropPoint || ""}
                      onChange={(e) => setEditForm({ ...editForm, dropPoint: e.target.value })}
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </>
              )}

              {/* BUS FIELDS */}
              {editingItem.componentType === "BUS" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Operator Name</label>
                      <input
                        type="text"
                        value={editForm.operatorName || ""}
                        onChange={(e) => setEditForm({ ...editForm, operatorName: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Seat Number(s)</label>
                      <input
                        type="text"
                        value={editForm.seatNumbers || ""}
                        onChange={(e) => setEditForm({ ...editForm, seatNumbers: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Bus Registration</label>
                      <input
                        type="text"
                        value={editForm.busRegistrationNumber || ""}
                        onChange={(e) => setEditForm({ ...editForm, busRegistrationNumber: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Ticket / PNR</label>
                      <input
                        type="text"
                        value={editForm.ticketPnr || ""}
                        onChange={(e) => setEditForm({ ...editForm, ticketPnr: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* GUIDE FIELDS */}
              {editingItem.componentType === "GUIDE" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Guide Name</label>
                      <input
                        type="text"
                        value={editForm.guideName || ""}
                        onChange={(e) => setEditForm({ ...editForm, guideName: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Guide Phone</label>
                      <input
                        type="text"
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Languages</label>
                    <input
                      type="text"
                      value={editForm.languages || ""}
                      onChange={(e) => setEditForm({ ...editForm, languages: e.target.value })}
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid #cbd5e1", padding: "0 8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-save-edit-details"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                {savingEdit ? "Saving..." : "Save Details"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW VOUCHER (WHAT CUSTOMER SEES) */}
      {showPreview && (
        <div
          id="admin-fulfillment-preview-modal"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "16px", maxWidth: "700px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2563eb", paddingBottom: "14px", marginBottom: "20px" }}>
              <div>
                <strong style={{ fontSize: "20px", fontWeight: 900, color: "#2563eb", letterSpacing: "-0.5px" }}>ZELEVOS</strong>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Customer Trip Voucher Preview</span>
              </div>
              <button type="button" onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#eff6ff", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>DESTINATION</span>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{destination}</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>BOOKING REF</span>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#1d4ed8" }}>{bookingRef}</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>VOUCHER STATUS</span>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#059669" }}>CONFIRMED (v{fulfillment?.version || 1})</div>
              </div>
            </div>

            <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>
              Confirmed Ground Arrangements
            </h4>

            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
              {items.map((it) => (
                <div key={it.id} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", background: "#dbeafe", padding: "2px 8px", borderRadius: "4px" }}>
                      {it.componentType}
                    </span>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>{it.title}</strong>
                  </div>
                  <pre style={{ margin: 0, fontSize: "11px", color: "#475569", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    {JSON.stringify(it.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>24/7 Concierge Support: 1800-ZELEVOS · support@zelevos.com</span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
