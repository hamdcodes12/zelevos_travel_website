import React, { useState, useEffect } from "react";
import {
  MapPin,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  Archive,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Package,
  Layers,
  Calendar,
  X,
  PlusCircle,
  MinusCircle,
  Globe,
  ShieldCheck,
} from "lucide-react";

interface AdminDestinationsTabProps {
  onToast: (msg: string) => void;
}

interface DestinationItem {
  id: string;
  slug: string;
  name: string;
  country: string;
  state: string;
  city?: string;
  overview: string;
  bestTravelPeriod: string;
  heroImage: string;
  gallery?: string[];
  highlights?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  status: "active" | "draft" | "archived";
  packageCount?: number;
  confidenceScore?: number;
  confidenceLabel?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function AdminDestinationsTab({ onToast }: AdminDestinationsTabProps) {
  const [destinations, setDestinations] = useState<DestinationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived">("all");

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<DestinationItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [overview, setOverview] = useState("");
  const [bestTravelPeriod, setBestTravelPeriod] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([
    { question: "", answer: "" },
  ]);
  const [destStatus, setDestStatus] = useState<"active" | "draft" | "archived">("active");

  // Archive modal state
  const [archiveModalTarget, setArchiveModalTarget] = useState<DestinationItem | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchDestinations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/destinations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.results || []);
      } else {
        onToast("Failed to load destinations.");
      }
    } catch (err: any) {
      onToast(err.message || "Failed to fetch destinations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const openAddModal = () => {
    setEditingDestination(null);
    setSlug("");
    setName("");
    setCountry("India");
    setState("");
    setCity("");
    setOverview("");
    setBestTravelPeriod("");
    setHeroImage("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80");
    setHighlightsText("");
    setFaqs([{ question: "", answer: "" }]);
    setDestStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (dest: DestinationItem) => {
    setEditingDestination(dest);
    setSlug(dest.slug || "");
    setName(dest.name || "");
    setCountry(dest.country || "India");
    setState(dest.state || "");
    setCity(dest.city || "");
    setOverview(dest.overview || "");
    setBestTravelPeriod(dest.bestTravelPeriod || "");
    setHeroImage(dest.heroImage || "");
    setHighlightsText(Array.isArray(dest.highlights) ? dest.highlights.join("\n") : "");
    setFaqs(
      Array.isArray(dest.faqs) && dest.faqs.length > 0
        ? dest.faqs
        : [{ question: "", answer: "" }]
    );
    setDestStatus(dest.status || "active");
    setModalOpen(true);
  };

  const handleSlugify = (val: string) => {
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingDestination) {
      setSlug(handleSlugify(val));
    }
  };

  const addFaqField = () => {
    setFaqs([...faqs, { question: "", answer: "" }]);
  };

  const removeFaqField = (idx: number) => {
    setFaqs(faqs.filter((_, i) => i !== idx));
  };

  const updateFaq = (idx: number, field: "question" | "answer", val: string) => {
    const updated = [...faqs];
    updated[idx][field] = val;
    setFaqs(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !state.trim() || !overview.trim() || !bestTravelPeriod.trim() || !heroImage.trim()) {
      onToast("Please fill in all mandatory fields.");
      return;
    }

    const highlights = highlightsText
      .split("\n")
      .map((h) => h.trim())
      .filter(Boolean);

    const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());

    const payload = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      country: country.trim(),
      state: state.trim(),
      city: city.trim() || undefined,
      overview: overview.trim(),
      bestTravelPeriod: bestTravelPeriod.trim(),
      heroImage: heroImage.trim(),
      highlights,
      faqs: validFaqs,
      status: destStatus,
    };

    setSubmitting(true);
    try {
      const url = editingDestination
        ? `/api/admin/destinations/${editingDestination.id}`
        : "/api/admin/destinations";
      const method = editingDestination ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : "Save failed"));
      }

      onToast(editingDestination ? "Destination updated successfully!" : "Destination created successfully!");
      setModalOpen(false);
      fetchDestinations();
    } catch (err: any) {
      onToast(err.message || "Failed to save destination.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveModalTarget) return;
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/admin/destinations/${archiveModalTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to archive destination.");
      onToast(`Destination ${archiveModalTarget.name} has been archived.`);
      setArchiveModalTarget(null);
      fetchDestinations();
    } catch (err: any) {
      onToast(err.message || "Failed to archive destination.");
    } finally {
      setArchiveLoading(false);
    }
  };

  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch =
      dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || dest.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Geographic Catalog
            </span>
            <span style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px" }}>
              {destinations.length} Destinations
            </span>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Destination Management & Confidence
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Configure destination hubs, travel guides, highlight points, and view live vendor fulfillment scores.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={fetchDestinations}
            style={{
              padding: "9px 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="admin-btn-add-destination"
            onClick={openAddModal}
            style={{
              padding: "9px 18px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
            }}
          >
            <Plus size={16} />
            <span>Add Destination</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "8px 12px",
              width: "100%",
              maxWidth: "360px",
            }}
          >
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by name, state, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "12px",
                width: "100%",
                color: "#0f172a",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {(["all", "active", "draft", "archived"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
                border: statusFilter === st ? "1px solid #2563eb" : "1px solid #e2e8f0",
                background: statusFilter === st ? "#eff6ff" : "#ffffff",
                color: statusFilter === st ? "#1d4ed8" : "#64748b",
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Destinations Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", color: "#2563eb" }} />
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Loading destinations catalog...</p>
        </div>
      ) : filteredDestinations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <MapPin size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>No destinations found</h3>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
            {searchQuery ? "Try refining your search terms or filter." : "Create your first destination to get started."}
          </p>
          <button
            type="button"
            onClick={openAddModal}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={15} /> Add Destination
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {filteredDestinations.map((dest) => {
            const isArchived = dest.status === "archived";
            const isDraft = dest.status === "draft";
            const score = dest.confidenceScore ?? 95;
            const scoreColor = score >= 90 ? "#059669" : score >= 75 ? "#d97706" : "#dc2626";
            const scoreBg = score >= 90 ? "#ecfdf5" : score >= 75 ? "#fffbeb" : "#fef2f2";

            return (
              <div
                key={dest.id}
                id={`admin-destination-card-${dest.id}`}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                  opacity: isArchived ? 0.75 : 1,
                }}
              >
                {/* Hero Image Thumbnail */}
                <div style={{ position: "relative", height: "160px", background: "#f1f5f9" }}>
                  <img
                    src={dest.heroImage || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"}
                    alt={dest.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(15, 23, 42, 0.7) 0%, transparent 60%)",
                    }}
                  />

                  {/* Status Badge */}
                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background:
                          dest.status === "active"
                            ? "rgba(16, 185, 129, 0.9)"
                            : dest.status === "draft"
                            ? "rgba(245, 158, 11, 0.9)"
                            : "rgba(100, 116, 139, 0.9)",
                        color: "#ffffff",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {dest.status}
                    </span>

                    {/* Confidence Score Pill */}
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 800,
                        background: "rgba(15, 23, 42, 0.8)",
                        color: scoreColor,
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Computed from vendor acceptance, response times, and fulfillment reliability"
                    >
                      <ShieldCheck size={11} />
                      {score}% Confidence
                    </span>
                  </div>

                  {/* Public Link */}
                  <a
                    href={`/destinations/${dest.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.85)",
                      backdropFilter: "blur(4px)",
                      display: "grid",
                      placeItems: "center",
                      color: "#0f172a",
                      textDecoration: "none",
                    }}
                    title="View live destination page"
                  >
                    <ExternalLink size={13} />
                  </a>

                  {/* Name and State overlay */}
                  <div style={{ position: "absolute", bottom: "12px", left: "14px", right: "14px" }}>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                      {dest.name}
                    </h3>
                    <span style={{ fontSize: "12px", color: "#e2e8f0", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                      {dest.state}, {dest.country}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Overview snippet */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "#475569",
                      lineHeight: "1.5",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {dest.overview}
                  </p>

                  {/* Meta Info: Best Period & Packages */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      border: "1px solid #f1f5f9",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      <span style={{ display: "block", color: "#64748b", fontWeight: 600 }}>Best Season</span>
                      <strong style={{ color: "#0f172a", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Calendar size={12} color="#2563eb" /> {dest.bestTravelPeriod}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: "block", color: "#64748b", fontWeight: 600 }}>Active Packages</span>
                      <strong style={{ color: "#0f172a", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Package size={12} color="#059669" /> {dest.packageCount || 0} Listed
                      </strong>
                    </div>
                  </div>

                  {/* Highlights preview */}
                  {Array.isArray(dest.highlights) && dest.highlights.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {dest.highlights.slice(0, 3).map((h, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "10.5px",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          ✦ {h}
                        </span>
                      ))}
                      {dest.highlights.length > 3 && (
                        <span style={{ fontSize: "10.5px", color: "#94a3b8", alignSelf: "center" }}>
                          +{dest.highlights.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
                      /{dest.slug}
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(dest)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#334155",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => setArchiveModalTarget(dest)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #fee2e2",
                            background: "#fef2f2",
                            color: "#dc2626",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="Archive Destination"
                        >
                          <Archive size={12} /> Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT DESTINATION MODAL
         ========================================================================= */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setModalOpen(false);
          }}
        >
          <div
            style={{
              width: "min(100%, 720px)",
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>
                  {editingDestination ? "Edit Destination" : "Create New Destination"}
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  {editingDestination ? editingDestination.name : "New Destination Guide"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "24px", display: "grid", gap: "16px" }}>
              {/* Row 1: Name and Slug */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Destination Name <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kashmir Valley"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    URL Slug <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kashmir-valley"
                    value={slug}
                    onChange={(e) => setSlug(handleSlugify(e.target.value))}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      outline: "none",
                      background: editingDestination ? "#f8fafc" : "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: State, City, Country */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    State / Province <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jammu and Kashmir"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    City (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Srinagar"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Country <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Best Period & Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Best Travel Period <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. March to August (Spring & Summer)"
                    value={bestTravelPeriod}
                    onChange={(e) => setBestTravelPeriod(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Catalog Status <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <select
                    value={destStatus}
                    onChange={(e) => setDestStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    <option value="active">Active (Visible to public)</option>
                    <option value="draft">Draft (Admin review)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Hero Image */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Hero Image URL <span style={{ color: "#e11d48" }}>*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={heroImage}
                  onChange={(e) => setHeroImage(e.target.value)}
                  style={{
                    width: "100%",
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Overview */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Destination Overview / Travel Story <span style={{ color: "#e11d48" }}>*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide an enticing description of this travel destination..."
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    fontFamily: "inherit",
                    lineHeight: "1.5",
                  }}
                />
              </div>

              {/* Highlights (One per line) */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Highlights & Key Attractions (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Dal Lake Shikara Ride&#10;Gulmarg Gondola World's Highest Cable Car&#10;Pahalgam Valley of Shepherds"
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    fontFamily: "inherit",
                    lineHeight: "1.5",
                  }}
                />
              </div>

              {/* FAQs Section */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", margin: 0 }}>
                    Frequently Asked Questions ({faqs.length})
                  </label>
                  <button
                    type="button"
                    onClick={addFaqField}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#2563eb",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <PlusCircle size={14} /> Add FAQ
                  </button>
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  {faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>FAQ #{idx + 1}</span>
                        {faqs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFaqField(idx)}
                            style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", padding: 0 }}
                          >
                            <MinusCircle size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Question (e.g. Is a special permit required?)"
                        value={faq.question}
                        onChange={(e) => updateFaq(idx, "question", e.target.value)}
                        style={{
                          width: "100%",
                          height: "34px",
                          padding: "0 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "12px",
                          outline: "none",
                          background: "#ffffff",
                        }}
                      />
                      <textarea
                        rows={2}
                        placeholder="Answer..."
                        value={faq.answer}
                        onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "12px",
                          outline: "none",
                          background: "#ffffff",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  paddingTop: "14px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: "9px 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "9px 24px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{editingDestination ? "Update Destination" : "Create Destination"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONFIRM ARCHIVE MODAL
         ========================================================================= */}
      {archiveModalTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !archiveLoading) setArchiveModalTarget(null);
          }}
        >
          <div
            style={{
              width: "min(100%, 460px)",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Archive size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>Archive Destination?</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Safe lifecycle preservation</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
              Are you sure you want to archive <strong>{archiveModalTarget.name}</strong>? It will be hidden from the public traveler catalog and search, but existing packages and booking histories remain intact.
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setArchiveModalTarget(null)}
                disabled={archiveLoading}
                style={{
                  padding: "8px 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveLoading}
                style={{
                  padding: "8px 20px",
                  background: "#dc2626",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: archiveLoading ? 0.7 : 1,
                }}
              >
                {archiveLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <Archive size={14} />
                    <span>Archive Destination</span>
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
