import React, { useState, useEffect } from "react";
import {
  Plus,
  Package,
  Check,
  X,
  ShieldCheck,
  RefreshCw,
  Eye,
  Edit2,
  Pause,
  Play,
  Archive,
  Trash2,
  Calendar,
  Building,
  Car,
  Compass,
  FileText,
  DollarSign,
  Layers,
  MapPin,
  Lock,
  Clock,
} from "lucide-react";
import { PackageDetailModal } from "./package-detail-modal";

interface PackageDayInput {
  dayNumber: number;
  title: string;
  description: string;
  mealsIncluded?: string;
  hotelDetails?: string;
}

interface HotelInput {
  name: string;
  starRating: number;
  roomType: string;
  mealPlan: string;
  address: string;
  city: string;
  baseCostPerNight: number;
  sellingPricePerNight: number;
}

interface TransferInput {
  transferType: string;
  vehicleType: string;
  pickupLocation: string;
  dropLocation: string;
  durationMinutes: number;
  baseCost: number;
  sellingPrice: number;
}

interface ActivityInput {
  name: string;
  durationHours: number;
  difficultyLevel: string;
  meetingPoint: string;
  baseCost: number;
  sellingPrice: number;
}

export function AdminPackagesTab({ onToast }: { onToast: (msg: string) => void }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [approvedSupplierServices, setApprovedSupplierServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"basics" | "commercials" | "itinerary" | "components" | "policies">("basics");

  // Preview state
  const [previewPackageId, setPreviewPackageId] = useState<string | null>(null);

  // Form Fields - Neutral defaults per Phase 1 direction correction (ZL-KASH-002 placeholder removed)
  const [packageId, setPackageId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [locations, setLocations] = useState("");
  const [durationDays, setDurationDays] = useState(5);
  const [durationNights, setDurationNights] = useState(4);
  const [theme, setTheme] = useState("family");
  const [travellerSuitability, setTravellerSuitability] = useState("");
  const [baseCost, setBaseCost] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [markupType, setMarkupType] = useState<"fixed" | "percentage">("fixed");
  const [markupValue, setMarkupValue] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [inventory, setInventory] = useState(10);
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [assignedVendors, setAssignedVendors] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "archived">("draft");
  const [featured, setFeatured] = useState(false);
  const [isMembersOnly, setIsMembersOnly] = useState(false);
  const [offerExpiresAt, setOfferExpiresAt] = useState("");

  // Dynamic Day-by-Day Itinerary
  const [days, setDays] = useState<PackageDayInput[]>([]);

  // Component Services: Hotels
  const [hotels, setHotels] = useState<HotelInput[]>([]);

  // Component Services: Transfers
  const [transfers, setTransfers] = useState<TransferInput[]>([]);

  // Component Services: Activities
  const [activities, setActivities] = useState<ActivityInput[]>([]);

  // Policies & Media
  const [cancellationPolicy, setCancellationPolicy] = useState("Free cancellation up to 7 days before departure. 50% refund between 7 to 3 days. Non-refundable within 72 hours.");
  const [modificationPolicy, setModificationPolicy] = useState("One free date modification allowed up to 48 hours prior to scheduled departure.");
  const [childPolicy, setChildPolicy] = useState("Children below 5 years stay complimentary without extra bed. Ages 5-11 charged at 60% of adult rate.");
  const [paymentPolicy, setPaymentPolicy] = useState("100% advance payment required for guaranteed instant voucher issuance.");
  const [heroImage, setHeroImage] = useState("/kashmir-dawn.jpg");
  const [galleryUrls, setGalleryUrls] = useState("/kashmir-dawn.jpg, /ladakh-road.jpg");

  // Destination Management Modal state
  const [showDestModal, setShowDestModal] = useState(false);
  const [destFormMode, setDestFormMode] = useState<"list" | "create" | "edit">("list");
  const [destEditingId, setDestEditingId] = useState<string | null>(null);
  const [destName, setDestName] = useState("");
  const [destSlug, setDestSlug] = useState("");
  const [destCountry, setDestCountry] = useState("India");
  const [destState, setDestState] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destOverview, setDestOverview] = useState("");
  const [destTravelPeriod, setDestTravelPeriod] = useState("");
  const [destHeroImage, setDestHeroImage] = useState("/kashmir-dawn.jpg");
  const [destFaqs, setDestFaqs] = useState("");
  const [destStatus, setDestStatus] = useState<"active" | "draft" | "archived">("active");
  const [destSubmitting, setDestSubmitting] = useState(false);

  // Synchronized Commercials & Markup Calculation (PRD Section 8)
  const updateCommercials = (
    field: "baseCost" | "markupValue" | "markupType" | "serviceFee" | "sellingPrice",
    val: any
  ) => {
    const newBase = field === "baseCost" ? Number(val) : baseCost;
    const newMarkupVal = field === "markupValue" ? Number(val) : markupValue;
    const newMarkupType = field === "markupType" ? (val as "fixed" | "percentage") : markupType;
    const newFee = field === "serviceFee" ? Number(val) : serviceFee;
    const newSelling = field === "sellingPrice" ? Number(val) : sellingPrice;

    if (field === "baseCost") setBaseCost(newBase);
    if (field === "markupValue") setMarkupValue(newMarkupVal);
    if (field === "markupType") setMarkupType(newMarkupType);
    if (field === "serviceFee") setServiceFee(newFee);

    if (field === "sellingPrice") {
      setSellingPrice(newSelling);
      if (newMarkupType === "fixed") {
        setMarkupValue(Math.max(0, newSelling - newBase - newFee));
      } else {
        const margin = newBase > 0 ? ((newSelling - newFee - newBase) / newBase) * 100 : 0;
        setMarkupValue(Math.max(0, Math.round(margin * 10) / 10));
      }
    } else {
      if (newMarkupType === "fixed") {
        setSellingPrice(newBase + newMarkupVal + newFee);
      } else {
        setSellingPrice(Math.round(newBase * (1 + newMarkupVal / 100)) + newFee);
      }
    }
  };

  const openCreateDest = () => {
    setDestFormMode("create");
    setDestEditingId(null);
    setDestName("");
    setDestSlug("");
    setDestCountry("India");
    setDestState("");
    setDestCity("");
    setDestOverview("");
    setDestTravelPeriod("");
    setDestHeroImage("/kashmir-dawn.jpg");
    setDestFaqs("Q: What is the best season to visit?\nA: October to March is pleasant.");
    setDestStatus("active");
  };

  const openEditDest = (d: any) => {
    setDestFormMode("edit");
    setDestEditingId(d.id);
    setDestName(d.name);
    setDestSlug(d.slug);
    setDestCountry(d.country || "India");
    setDestState(d.state || "");
    setDestCity(d.city || "");
    setDestOverview(d.overview || "");
    setDestTravelPeriod(d.bestTravelPeriod || "");
    setDestHeroImage(d.heroImage || "/kashmir-dawn.jpg");
    setDestFaqs(
      Array.isArray(d.faqs)
        ? d.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
        : ""
    );
    setDestStatus(d.status || "active");
  };

  const handleSaveDestination = async () => {
    if (!destName.trim() || !destState.trim() || !destOverview.trim()) {
      onToast("Destination Name, State, and Overview are required.");
      return;
    }

    const generatedSlug =
      destSlug.trim() ||
      destName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const parsedFaqs: Array<{ question: string; answer: string }> = [];
    if (destFaqs.trim()) {
      const blocks = destFaqs.split("\n\n");
      for (const b of blocks) {
        const lines = b.split("\n");
        const qLine = lines.find((l) => l.toLowerCase().startsWith("q:")) || lines[0] || "";
        const aLine = lines.find((l) => l.toLowerCase().startsWith("a:")) || lines[1] || "";
        const q = qLine.replace(/^q:\s*/i, "").trim();
        const a = aLine.replace(/^a:\s*/i, "").trim();
        if (q && a) parsedFaqs.push({ question: q, answer: a });
      }
    }

    const payload = {
      name: destName.trim(),
      slug: generatedSlug,
      country: destCountry.trim() || "India",
      state: destState.trim(),
      city: destCity.trim() || undefined,
      overview: destOverview.trim(),
      bestTravelPeriod: destTravelPeriod.trim() || "Year round",
      heroImage: destHeroImage.trim() || "/kashmir-dawn.jpg",
      faqs: parsedFaqs,
      status: destStatus,
    };

    setDestSubmitting(true);
    try {
      const endpoint =
        destFormMode === "create"
          ? "/api/admin/destinations"
          : `/api/admin/destinations/${destEditingId}`;
      const method = destFormMode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save destination.");
      }

      onToast(`Destination ${payload.name} saved successfully!`);
      setDestFormMode("list");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to save destination.");
    } finally {
      setDestSubmitting(false);
    }
  };

  const handleArchiveDestination = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/destinations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to archive destination.");
      onToast("Destination archived.");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to archive destination.");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkgsRes, destsRes, supplierServicesRes] = await Promise.all([
        fetch(`/api/admin/packages${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`).then((r) => r.json()),
        fetch("/api/admin/destinations", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : fetch("/api/destinations").then((res) => res.json())))
          .catch(() => fetch("/api/destinations").then((res) => res.json())),
        fetch("/api/admin/supplier-services/approved", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : { services: [] }))
          .catch(() => ({ services: [] })),
      ]);

      const pkgList = Array.isArray(pkgsRes.results) ? pkgsRes.results : [];
      setPackages(pkgList);

      const destList = Array.isArray(destsRes.results)
        ? destsRes.results
        : Array.isArray(destsRes.destinations)
        ? destsRes.destinations
        : [];
      setDestinations(destList);
      if (destList.length > 0 && !destinationId) {
        setDestinationId(destList[0].id);
      }

      setApprovedSupplierServices(Array.isArray(supplierServicesRes.services) ? supplierServicesRes.services : []);
    } catch (err) {
      onToast("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setPackageId(`ZL-PKG-${Math.floor(100 + Math.random() * 900)}`);
    setTitle("Golden Triangle Heritage & Palaces");
    setSlug(`golden-triangle-${Date.now().toString().slice(-4)}`);
    if (destinations.length > 0) setDestinationId(destinations[0].id);
    setStatus("draft");
    setIsMembersOnly(false);
    setOfferExpiresAt("");
    setActiveFormTab("basics");
    setShowModal(true);
  };

  const openEditModal = async (pkg: any) => {
    setModalMode("edit");
    setEditingId(pkg.id);
    setPackageId(pkg.packageId);
    setTitle(pkg.title);
    setSlug(pkg.slug);
    setDestinationId(pkg.destinationId);
    setLocations(Array.isArray(pkg.locations) ? pkg.locations.join(", ") : "");
    setDurationDays(pkg.durationDays);
    setDurationNights(pkg.durationNights);
    setTheme(pkg.theme);
    setTravellerSuitability(pkg.travellerSuitability || "");
    setBaseCost(pkg.baseCost);
    setSellingPrice(pkg.sellingPrice);
    setMarkupType(pkg.markupType || "fixed");
    setMarkupValue(Number(pkg.markupValue || 0));
    setServiceFee(pkg.serviceFee || 0);
    setInventory(pkg.inventory || 10);
    setInclusions(Array.isArray(pkg.inclusions) ? pkg.inclusions.join("\n") : "");
    setExclusions(Array.isArray(pkg.exclusions) ? pkg.exclusions.join("\n") : "");
    setAssignedVendors(Array.isArray(pkg.assignedVendorIds) ? pkg.assignedVendorIds.join(", ") : "");
    setStatus(pkg.status);
    setFeatured(Boolean(pkg.featured));
    setIsMembersOnly(Boolean(pkg.isMembersOnly));
    setOfferExpiresAt(pkg.offerExpiresAt ? new Date(pkg.offerExpiresAt).toISOString().slice(0, 16) : "");

    if (pkg.policies) {
      setCancellationPolicy(pkg.policies.cancellation || "");
      setModificationPolicy(pkg.policies.modification || "");
      setChildPolicy(pkg.policies.child || "");
      setPaymentPolicy(pkg.policies.payment || "");
    }

    if (pkg.media) {
      setHeroImage(pkg.media.heroImage || "/kashmir-dawn.jpg");
      setGalleryUrls(Array.isArray(pkg.media.gallery) ? pkg.media.gallery.join(", ") : "/kashmir-dawn.jpg");
    }

    // Fetch existing package components
    try {
      const res = await fetch(`/api/packages/${pkg.id}?preview=true`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.package?.days && detail.package.days.length > 0) {
          setDays(detail.package.days.map((d: any) => ({
            dayNumber: d.dayNumber,
            title: d.title,
            description: d.description,
            mealsIncluded: d.mealsIncluded || "Breakfast",
            hotelDetails: d.hotelDetails || "",
          })));
        }
        if (detail.package?.components?.hotels) {
          setHotels(detail.package.components.hotels.map((h: any) => ({
            name: h.name,
            starRating: Number(h.starRating || 4),
            roomType: h.roomType || "Deluxe Room",
            mealPlan: h.mealPlan || "CP",
            address: h.address || "City Center",
            city: h.city || "Destination",
            baseCostPerNight: Number(h.baseCostPerNight || 0),
            sellingPricePerNight: Number(h.sellingPricePerNight || 0),
          })));
        }
        if (detail.package?.components?.transfers) {
          setTransfers(detail.package.components.transfers.map((t: any) => ({
            transferType: t.transferType || "private",
            vehicleType: t.vehicleType || "Sedan",
            pickupLocation: t.pickupLocation || "Pickup",
            dropLocation: t.dropLocation || "Drop",
            durationMinutes: Number(t.durationMinutes || 60),
            baseCost: Number(t.baseCost || 0),
            sellingPrice: Number(t.sellingPrice || 0),
          })));
        }
        if (detail.package?.components?.activities) {
          setActivities(detail.package.components.activities.map((a: any) => ({
            name: a.name,
            durationHours: Number(a.durationHours || 2),
            difficultyLevel: a.difficultyLevel || "Easy",
            meetingPoint: a.meetingPoint || "Sightseeing point",
            baseCost: Number(a.baseCost || 0),
            sellingPrice: Number(a.sellingPrice || 0),
          })));
        }
      }
    } catch (e) {
      console.warn("Could not load full components for edit:", e);
    }

    setActiveFormTab("basics");
    setShowModal(true);
  };

  const handleStatusTransition = async (pkgId: string, newStatus: "active" | "paused" | "archived") => {
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update package status.");
      }

      onToast(`Status transitioned to ${newStatus.toUpperCase()} successfully.`);
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Status transition failed.");
    }
  };

  const handleExpireOffer = async (pkgId: string) => {
    if (!window.confirm("Expire this offer immediately? This will pause sales and set the expiry timestamp to now.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}/expire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to expire offer.");
      onToast("Offer expired & sales paused.");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to expire offer.");
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this package? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}?hard=true`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete package.");
      onToast("Package deleted successfully.");
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to delete package.");
    }
  };

  const handleSavePackage = async (targetStatus?: "draft" | "active") => {
    setSubmitting(true);
    const finalStatus = targetStatus || status;

    try {
      const payload = {
        packageId: packageId.trim(),
        title: title.trim(),
        slug: slug.trim(),
        destinationId: destinationId || destinations[0]?.id,
        locations: locations.split(",").map((l) => l.trim()).filter(Boolean),
        durationDays: Number(durationDays),
        durationNights: Number(durationNights),
        theme: theme.trim(),
        travellerSuitability: travellerSuitability.trim(),
        baseCost: Number(baseCost),
        sellingPrice: Number(sellingPrice),
        markupType,
        markupValue: Number(markupValue),
        serviceFee: Number(serviceFee),
        inventory: Number(inventory),
        inclusions: inclusions.split("\n").map((i) => i.trim()).filter(Boolean),
        exclusions: exclusions.split("\n").map((i) => i.trim()).filter(Boolean),
        assignedVendorIds: assignedVendors.split(",").map((v) => v.trim()).filter(Boolean),
        policies: {
          cancellation: cancellationPolicy.trim(),
          modification: modificationPolicy.trim(),
          child: childPolicy.trim(),
          payment: paymentPolicy.trim(),
        },
        media: {
          heroImage: heroImage.trim() || "/kashmir-dawn.jpg",
          gallery: galleryUrls.split(",").map((g) => g.trim()).filter(Boolean),
        },
        status: finalStatus,
        featured,
        isMembersOnly,
        offerExpiresAt: offerExpiresAt ? new Date(offerExpiresAt).toISOString() : null,
        days: days.map((d, i) => ({ ...d, dayNumber: i + 1 })),
        hotels,
        transfers,
        activities,
      };

      const endpoint = modalMode === "create" ? "/api/admin/packages" : `/api/admin/packages/${editingId}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || (!data.package && !data.id)) {
        throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : "Save failed."));
      }

      onToast(
        modalMode === "create"
          ? `Package ${payload.packageId} created with status ${finalStatus.toUpperCase()}!`
          : `Package ${payload.packageId} updated successfully!`
      );
      setShowModal(false);
      void loadData();
    } catch (err: any) {
      onToast(err.message || "Failed to save package.");
    } finally {
      setSubmitting(false);
    }
  };

  // Itinerary helper handlers
  const addDay = () => {
    const nextNum = days.length + 1;
    setDays([
      ...days,
      {
        dayNumber: nextNum,
        title: `Day ${nextNum}: Excursion & Exploration`,
        description: "Scheduled activities, guided sightseeing, and leisure time.",
        mealsIncluded: "Breakfast",
        hotelDetails: "Comfort stay",
      },
    ]);
  };

  const removeDay = (idx: number) => {
    if (days.length <= 1) {
      onToast("A package must have at least 1 day itinerary.");
      return;
    }
    const updated = days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, dayNumber: i + 1 }));
    setDays(updated);
  };

  const updateDay = (idx: number, field: keyof PackageDayInput, val: any) => {
    const copy = [...days];
    copy[idx] = { ...copy[idx], [field]: val };
    setDays(copy);
  };

  // Hotel helper handlers
  const addHotel = () => {
    setHotels([
      ...hotels,
      {
        name: "Grand View Resort",
        starRating: 4,
        roomType: "Deluxe Valley Room",
        mealPlan: "CP (Breakfast)",
        address: "Hill View Area",
        city: "Destination City",
        baseCostPerNight: 4000,
        sellingPricePerNight: 6000,
      },
    ]);
  };

  const removeHotel = (idx: number) => {
    setHotels(hotels.filter((_, i) => i !== idx));
  };

  // Transfer helper handlers
  const addTransfer = () => {
    setTransfers([
      ...transfers,
      {
        transferType: "private",
        vehicleType: "Sedan (Dzire / Etios)",
        pickupLocation: "Airport / Station",
        dropLocation: "Hotel Check-in",
        durationMinutes: 45,
        baseCost: 1500,
        sellingPrice: 2200,
      },
    ]);
  };

  const removeTransfer = (idx: number) => {
    setTransfers(transfers.filter((_, i) => i !== idx));
  };

  // Activity helper handlers
  const addActivity = () => {
    setActivities([
      ...activities,
      {
        name: "Heritage City Guided Walk",
        durationHours: 2.5,
        difficultyLevel: "Easy",
        meetingPoint: "City Clock Tower",
        baseCost: 600,
        sellingPrice: 1200,
      },
    ]);
  };

  const removeActivity = (idx: number) => {
    setActivities(activities.filter((_, i) => i !== idx));
  };

  const filteredPackages = packages.filter((pkg) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      pkg.title?.toLowerCase().includes(q) ||
      pkg.packageId?.toLowerCase().includes(q) ||
      pkg.theme?.toLowerCase().includes(q) ||
      pkg.destinationName?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Curated Package & Inventory Management (Phase 2)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Create and publish verified holiday packages with days, hotels, transfers, activities, and commercial markups.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            id="admin-refresh-packages-btn"
            onClick={loadData}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            id="admin-manage-destinations-btn"
            onClick={() => {
              setDestFormMode("list");
              setShowDestModal(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <MapPin size={15} className="text-blue-600" /> Manage Destinations ({destinations.length})
          </button>
          <button
            type="button"
            id="admin-create-package-btn"
            onClick={openCreateModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
            }}
          >
            <Plus size={16} /> Create New Package
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: "6px" }}>
          {["all", "active", "draft", "paused", "archived"].map((st) => (
            <button
              key={st}
              type="button"
              id={`filter-status-${st}`}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: statusFilter === st ? 700 : 500,
                background: statusFilter === st ? "#2563eb" : "#f1f5f9",
                color: statusFilter === st ? "#ffffff" : "#475569",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ minWidth: "260px" }}>
          <input
            type="text"
            id="admin-package-search-input"
            placeholder="Search by title, ID, theme..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Packages Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Package ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Title & Destination</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Duration</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Pricing (Base / Sell)</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Components</th>
              <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Loading inventory packages...
                </td>
              </tr>
            ) : filteredPackages.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                  No packages matching this filter.
                </td>
              </tr>
            ) : (
              filteredPackages.map((pkg) => {
                const confScore = pkg.tripConfidenceScore?.score ?? 96;
                const statusColor =
                  pkg.status === "active"
                    ? { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" }
                    : pkg.status === "draft"
                    ? { bg: "#fffbeb", text: "#b45309", border: "#fde68a" }
                    : pkg.status === "paused"
                    ? { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" }
                    : { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };

                return (
                  <tr key={pkg.id} id={`package-row-${pkg.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 800, color: "#2563eb" }}>
                      {pkg.packageId}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong style={{ color: "#0f172a" }}>{pkg.title}</strong>
                        {pkg.isMembersOnly && (
                          <span
                            id={`exclusive-tag-${pkg.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#fef3c7",
                              color: "#92400e",
                              border: "1px solid #fde68a",
                              fontSize: "10px",
                              fontWeight: 800,
                            }}
                          >
                            <Lock size={10} /> MEMBER EXCLUSIVE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                        {pkg.destinationName || "Regional"} · /{pkg.slug} · {pkg.theme}
                      </span>
                      {pkg.offerExpiresAt && (
                        <div style={{ marginTop: "3px" }}>
                          <span
                            id={`expiry-tag-${pkg.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: new Date(pkg.offerExpiresAt) < new Date() ? "#fee2e2" : "#e0f2fe",
                              color: new Date(pkg.offerExpiresAt) < new Date() ? "#b91c1c" : "#0369a1",
                              fontSize: "10px",
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={10} />
                            {new Date(pkg.offerExpiresAt) < new Date() ? "Expired: " : "Expires: "}
                            {new Date(pkg.offerExpiresAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155" }}>
                      {pkg.durationDays}D / {pkg.durationNights}N
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#059669" }}>₹{(pkg.sellingPrice || 0).toLocaleString("en-IN")}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "#94a3b8" }}>
                        Cost: ₹{(pkg.baseCost || 0).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", fontSize: "11px", color: "#475569" }}>
                        <span title="Itinerary Days" style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          📅 {pkg.daysCount ?? 0}D
                        </span>
                        <span title="Hotels" style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          🏨 {pkg.hotelsCount ?? 0}
                        </span>
                        <span title="Transfers" style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          🚗 {pkg.transfersCount ?? 0}
                        </span>
                        <span title="Activities" style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          🧭 {pkg.activitiesCount ?? 0}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        id={`status-badge-${pkg.id}`}
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: statusColor.bg,
                          color: statusColor.text,
                          border: `1px solid ${statusColor.border}`,
                          fontWeight: 700,
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        {/* Preview Action */}
                        <button
                          type="button"
                          id={`preview-btn-${pkg.id}`}
                          title="Preview Customer View"
                          onClick={() => setPreviewPackageId(pkg.id)}
                          style={{
                            padding: "6px 8px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          <Eye size={13} />
                        </button>

                        {/* Edit Action */}
                        <button
                          type="button"
                          id={`edit-btn-${pkg.id}`}
                          title="Edit Package"
                          onClick={() => openEditModal(pkg)}
                          style={{
                            padding: "6px 8px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            color: "#2563eb",
                            cursor: "pointer",
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Lifecycle: Publish (Draft -> Active) */}
                        {pkg.status === "draft" && (
                          <button
                            type="button"
                            id={`publish-btn-${pkg.id}`}
                            title="Publish to Live Customer Catalog"
                            onClick={() => handleStatusTransition(pkg.id, "active")}
                            style={{
                              padding: "6px 10px",
                              background: "#ecfdf5",
                              border: "1px solid #10b981",
                              borderRadius: "6px",
                              color: "#047857",
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Check size={13} /> Publish
                          </button>
                        )}

                        {/* Lifecycle: Pause (Active -> Paused) */}
                        {pkg.status === "active" && (
                          <button
                            type="button"
                            id={`pause-btn-${pkg.id}`}
                            title="Pause Sales (Hide from customer catalog)"
                            onClick={() => handleStatusTransition(pkg.id, "paused")}
                            style={{
                              padding: "6px 10px",
                              background: "#fffbeb",
                              border: "1px solid #f59e0b",
                              borderRadius: "6px",
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Pause size={13} /> Pause
                          </button>
                        )}

                        {/* Lifecycle: Resume (Paused -> Active) */}
                        {pkg.status === "paused" && (
                          <button
                            type="button"
                            id={`resume-btn-${pkg.id}`}
                            title="Resume Sales (Publish back to customer catalog)"
                            onClick={() => handleStatusTransition(pkg.id, "active")}
                            style={{
                              padding: "6px 10px",
                              background: "#eff6ff",
                              border: "1px solid #3b82f6",
                              borderRadius: "6px",
                              color: "#1d4ed8",
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Play size={13} /> Resume
                          </button>
                        )}

                        {/* 1-Click Expire Offer */}
                        <button
                          type="button"
                          id={`expire-btn-${pkg.id}`}
                          title="Expire Offer & Pause Sales"
                          onClick={() => handleExpireOffer(pkg.id)}
                          style={{
                            padding: "6px 8px",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: "6px",
                            color: "#d97706",
                            fontWeight: 700,
                            fontSize: "11px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Clock size={12} /> Expire
                        </button>

                        {/* Lifecycle: Archive (Active/Paused/Draft -> Archived) */}
                        {pkg.status !== "archived" && (
                          <button
                            type="button"
                            id={`archive-btn-${pkg.id}`}
                            title="Archive Package"
                            onClick={() => handleStatusTransition(pkg.id, "archived")}
                            style={{
                              padding: "6px 8px",
                              background: "#fef2f2",
                              border: "1px solid #fca5a5",
                              borderRadius: "6px",
                              color: "#b91c1c",
                              cursor: "pointer",
                            }}
                          >
                            <Archive size={13} />
                          </button>
                        )}

                        {/* Permanent Delete */}
                        <button
                          type="button"
                          id={`delete-btn-${pkg.id}`}
                          title="Delete / Remove Package"
                          onClick={() => handleDeletePackage(pkg.id)}
                          style={{
                            padding: "6px 8px",
                            background: "#fee2e2",
                            border: "1px solid #fca5a5",
                            borderRadius: "6px",
                            color: "#dc2626",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PREVIEW MODAL */}
      {previewPackageId && (
        <PackageDetailModal
          packageIdOrSlug={previewPackageId}
          isPreview={true}
          onClose={() => setPreviewPackageId(null)}
          onBook={() => {
            onToast("Booking is disabled during admin catalog preview.");
          }}
        />
      )}

      {/* CREATE & EDIT PACKAGE MODAL WITH COMPLETE SECTION 8 & GAP 1 FIELDS */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15,23,42,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "880px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                  {modalMode === "create" ? "Create New Package" : `Edit Package: ${packageId}`}
                </h3>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Configure day-by-day itinerary, hotel stays, transfers, sightseeing passes, and commercial pricing.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                id="close-package-modal"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "6px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", padding: "0 24px", background: "#ffffff" }}>
              {[
                { id: "basics", label: "1. Basics & Destination", icon: MapPin },
                { id: "commercials", label: "2. Pricing & Slots", icon: DollarSign },
                { id: "itinerary", label: `3. Itinerary (${days.length} Days)`, icon: Calendar },
                { id: "components", label: "4. Services (Hotels/Cabs/Acts)", icon: Building },
                { id: "policies", label: "5. Policies & Media", icon: FileText },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeFormTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveFormTab(t.id as any)}
                    style={{
                      padding: "12px 14px",
                      border: "none",
                      borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                      color: active ? "#2563eb" : "#64748b",
                      fontWeight: active ? 700 : 500,
                      fontSize: "12px",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {/* TAB 1: BASICS */}
              {activeFormTab === "basics" && (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Package ID *
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-id"
                        required
                        value={packageId}
                        onChange={(e) => setPackageId(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Package Title *
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-title"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        URL Slug *
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-slug"
                        required
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 2fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Destination *
                      </label>
                      <select
                        id="admin-pkg-destination"
                        value={destinationId}
                        onChange={(e) => setDestinationId(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.state})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Theme *
                      </label>
                      <select
                        id="admin-pkg-theme"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="adventure">Adventure</option>
                        <option value="family">Family</option>
                        <option value="honeymoon">Honeymoon</option>
                        <option value="luxury">Luxury</option>
                        <option value="culture">Culture & Heritage</option>
                        <option value="budget">Budget</option>
                        <option value="weekend">Weekend Getaway</option>
                        <option value="pilgrimage">Pilgrimage</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Locations Covered (comma separated)
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-locations"
                        value={locations}
                        onChange={(e) => setLocations(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Duration Days *
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-days"
                        min={1}
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Duration Nights *
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-nights"
                        min={0}
                        value={durationNights}
                        onChange={(e) => setDurationNights(Number(e.target.value))}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Traveller Suitability
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-suitability"
                        value={travellerSuitability}
                        onChange={(e) => setTravellerSuitability(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", alignItems: "center" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Assigned Vendors (IDs comma separated)
                      </label>
                      <input
                        type="text"
                        id="admin-pkg-vendors"
                        value={assignedVendors}
                        onChange={(e) => setAssignedVendors(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div style={{ paddingTop: "18px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          id="admin-pkg-featured"
                          checked={featured}
                          onChange={(e) => setFeatured(e.target.checked)}
                          style={{ width: "16px", height: "16px" }}
                        />
                        Featured on Home Catalog
                      </label>
                    </div>
                  </div>

                  {/* EXCLUSIVE MEMBERS-ONLY DEAL SECTION */}
                  <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: "10px", padding: "14px", marginTop: "4px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="admin-pkg-members-only"
                        checked={isMembersOnly}
                        onChange={(e) => setIsMembersOnly(e.target.checked)}
                        style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#d97706", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <label htmlFor="admin-pkg-members-only" style={{ fontSize: "13px", fontWeight: 800, color: "#854d0e", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Lock size={14} className="text-amber-600" /> Exclusive Members-Only Deal (Locked for Non-Logged-in Customers)
                        </label>
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#a16207", lineHeight: "1.4" }}>
                          Non-logged-in visitors see this package with a locked secret price badge. Once they sign in with email, the package instantly unlocks with full pricing and booking access.
                        </p>
                      </div>
                    </div>

                    {isMembersOnly && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #fde047", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <label htmlFor="admin-pkg-offer-expiry" style={{ fontSize: "12px", fontWeight: 700, color: "#854d0e", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={13} /> Offer Expiry Date (Optional):
                        </label>
                        <input
                          type="datetime-local"
                          id="admin-pkg-offer-expiry"
                          value={offerExpiresAt}
                          onChange={(e) => setOfferExpiresAt(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", color: "#0f172a" }}
                        />
                        {offerExpiresAt && (
                          <button
                            type="button"
                            onClick={() => setOfferExpiresAt("")}
                            style={{ fontSize: "11px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                          >
                            Clear Expiry
                          </button>
                        )}
                        <span style={{ fontSize: "11px", color: "#713f12", fontStyle: "italic" }}>
                          After this date/time, the offer will be automatically marked expired.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: COMMERCIALS */}
              {activeFormTab === "commercials" && (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Supplier Base Net Cost (₹) *
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-base-cost"
                        value={baseCost}
                        onChange={(e) => updateCommercials("baseCost", e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Retail Selling Price (₹) *
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-selling-price"
                        value={sellingPrice}
                        onChange={(e) => updateCommercials("sellingPrice", e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Markup Value ({markupType === "fixed" ? "₹" : "%"})
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-markup-val"
                        value={markupValue}
                        onChange={(e) => updateCommercials("markupValue", e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Markup Model
                      </label>
                      <select
                        id="admin-pkg-markup-type"
                        value={markupType}
                        onChange={(e) => updateCommercials("markupType", e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="fixed">Fixed ₹ Amount</option>
                        <option value="percentage">Percentage Margin (%)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Service & Platform Fee (₹)
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-service-fee"
                        value={serviceFee}
                        onChange={(e) => updateCommercials("serviceFee", e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Inventory Sellable Slots
                      </label>
                      <input
                        type="number"
                        id="admin-pkg-inventory"
                        value={inventory}
                        onChange={(e) => setInventory(Number(e.target.value))}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  {/* Calculated Commercials Badge */}
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: "#166534",
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      Computed Gross Profit: <strong>₹{(sellingPrice - baseCost).toLocaleString("en-IN")}</strong> per booking
                    </span>
                    <span>
                      Margin:{" "}
                      <strong>
                        {baseCost > 0 ? Math.round(((sellingPrice - baseCost) / baseCost) * 100) : 0}%
                      </strong>
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Inclusions (one item per line)
                      </label>
                      <textarea
                        rows={4}
                        id="admin-pkg-inclusions"
                        value={inclusions}
                        onChange={(e) => setInclusions(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Exclusions (one item per line)
                      </label>
                      <textarea
                        rows={4}
                        id="admin-pkg-exclusions"
                        value={exclusions}
                        onChange={(e) => setExclusions(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ITINERARY BUILDER */}
              {activeFormTab === "itinerary" && (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                      Day-by-Day Journey Schedule ({days.length} Days)
                    </span>
                    <button
                      type="button"
                      id="admin-add-day-btn"
                      onClick={addDay}
                      style={{
                        padding: "6px 12px",
                        background: "#eff6ff",
                        border: "1px solid #93c5fd",
                        borderRadius: "6px",
                        color: "#1d4ed8",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Plus size={14} /> Add Day
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: "12px" }}>
                    {days.map((day, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#f8fafc",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          padding: "14px",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "13px", color: "#2563eb" }}>
                            Day {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDay(idx)}
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                            title="Remove Day"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px" }}>
                          <input
                            type="text"
                            placeholder="Day Title (e.g. Arrival & Shikara Ride)"
                            value={day.title}
                            onChange={(e) => updateDay(idx, "title", e.target.value)}
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                          />
                          <input
                            type="text"
                            placeholder="Meals Included (e.g. Breakfast, Dinner)"
                            value={day.mealsIncluded || ""}
                            onChange={(e) => updateDay(idx, "mealsIncluded", e.target.value)}
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                          />
                          <input
                            type="text"
                            placeholder="Stay / Hotel location"
                            value={day.hotelDetails || ""}
                            onChange={(e) => updateDay(idx, "hotelDetails", e.target.value)}
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                          />
                        </div>

                        <textarea
                          rows={2}
                          placeholder="Day narrative and excursion details..."
                          value={day.description}
                          onChange={(e) => updateDay(idx, "description", e.target.value)}
                          style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: COMPONENT SERVICES */}
              {activeFormTab === "components" && (
                <div style={{ display: "grid", gap: "20px" }}>
                  {/* Approved Supplier Services Quick Link */}
                  {approvedSupplierServices.length > 0 && (
                    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Building size={14} /> Link Approved Supplier Services ({approvedSupplierServices.length})
                        </span>
                        <span style={{ fontSize: "11px", color: "#3b82f6" }}>One-click attach from verified suppliers</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {approvedSupplierServices.map((item: any, idx: number) => {
                          const svc = item.service;
                          const st = (svc.serviceType || "").toLowerCase();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (st.includes("hotel") || st.includes("stay") || st.includes("resort")) {
                                  setHotels([
                                    ...hotels,
                                    {
                                      name: svc.title,
                                      starRating: 4,
                                      roomType: "Deluxe Valley View",
                                      mealPlan: "CP",
                                      address: svc.location,
                                      city: svc.location.split(",")[0] || "Destination",
                                      baseCostPerNight: Number(svc.rate) || 2500,
                                      sellingPricePerNight: Math.round((Number(svc.rate) || 2500) * 1.25),
                                    },
                                  ]);
                                } else if (st.includes("cab") || st.includes("transfer") || st.includes("bus")) {
                                  setTransfers([
                                    ...transfers,
                                    {
                                      transferType: "Private Dedicated Cab",
                                      vehicleType: svc.title,
                                      pickupLocation: svc.location,
                                      dropLocation: svc.location,
                                      durationMinutes: 90,
                                      baseCost: Number(svc.rate) || 1800,
                                      sellingPrice: Math.round((Number(svc.rate) || 1800) * 1.25),
                                    },
                                  ]);
                                } else {
                                  setActivities([
                                    ...activities,
                                    {
                                      name: svc.title,
                                      durationHours: 3,
                                      difficultyLevel: "Moderate",
                                      meetingPoint: svc.location,
                                      baseCost: Number(svc.rate) || 1200,
                                      sellingPrice: Math.round((Number(svc.rate) || 1200) * 1.25),
                                    },
                                  ]);
                                }
                                if (item.supplierId && !assignedVendors.includes(item.supplierId)) {
                                  setAssignedVendors(assignedVendors ? `${assignedVendors}, ${item.supplierId}` : item.supplierId);
                                }
                                onToast(`Linked "${svc.title}" from supplier "${item.supplierName}"!`);
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: "#ffffff",
                                border: "1px solid #93c5fd",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#1e3a8a",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>+ {svc.title}</span>
                              <span style={{ fontSize: "10px", color: "#059669", fontWeight: 700 }}>₹{svc.rate}</span>
                              <span style={{ fontSize: "10px", color: "#64748b" }}>({item.supplierName})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hotels */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Building size={16} className="text-blue-600" /> Accommodations & Hotels ({hotels.length})
                      </span>
                      <button
                        type="button"
                        onClick={addHotel}
                        style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >
                        + Add Hotel
                      </button>
                    </div>

                    {hotels.map((h, i) => (
                      <div key={i} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "8px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700 }}>Hotel #{i + 1}</span>
                          <button type="button" onClick={() => removeHotel(i)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", gap: "6px" }}>
                          <input
                            type="text"
                            placeholder="Hotel Name"
                            value={h.name}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].name = e.target.value;
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="number"
                            step="0.5"
                            placeholder="Star Rating"
                            value={h.starRating}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].starRating = Number(e.target.value);
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="text"
                            placeholder="Room Type"
                            value={h.roomType}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].roomType = e.target.value;
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "6px" }}>
                          <input
                            type="text"
                            placeholder="Meal Plan (e.g. CP, MAP)"
                            value={h.mealPlan}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].mealPlan = e.target.value;
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="number"
                            placeholder="Base Cost/Night ₹"
                            value={h.baseCostPerNight}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].baseCostPerNight = Number(e.target.value);
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="number"
                            placeholder="Selling Price/Night ₹"
                            value={h.sellingPricePerNight}
                            onChange={(e) => {
                              const copy = [...hotels];
                              copy[i].sellingPricePerNight = Number(e.target.value);
                              setHotels(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Transfers */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Car size={16} className="text-emerald-600" /> Ground Transfers ({transfers.length})
                      </span>
                      <button
                        type="button"
                        onClick={addTransfer}
                        style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >
                        + Add Transfer
                      </button>
                    </div>

                    {transfers.map((t, i) => (
                      <div key={i} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "8px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700 }}>Transfer #{i + 1}</span>
                          <button type="button" onClick={() => removeTransfer(i)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                          <input
                            type="text"
                            placeholder="Vehicle (e.g. Innova)"
                            value={t.vehicleType}
                            onChange={(e) => {
                              const copy = [...transfers];
                              copy[i].vehicleType = e.target.value;
                              setTransfers(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="text"
                            placeholder="Pickup Location"
                            value={t.pickupLocation}
                            onChange={(e) => {
                              const copy = [...transfers];
                              copy[i].pickupLocation = e.target.value;
                              setTransfers(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="text"
                            placeholder="Drop Location"
                            value={t.dropLocation}
                            onChange={(e) => {
                              const copy = [...transfers];
                              copy[i].dropLocation = e.target.value;
                              setTransfers(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Activities */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Compass size={16} className="text-indigo-600" /> Sightseeing & Activities ({activities.length})
                      </span>
                      <button
                        type="button"
                        onClick={addActivity}
                        style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >
                        + Add Activity
                      </button>
                    </div>

                    {activities.map((a, i) => (
                      <div key={i} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "8px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700 }}>Activity #{i + 1}</span>
                          <button type="button" onClick={() => removeActivity(i)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", gap: "6px" }}>
                          <input
                            type="text"
                            placeholder="Activity Title"
                            value={a.name}
                            onChange={(e) => {
                              const copy = [...activities];
                              copy[i].name = e.target.value;
                              setActivities(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="number"
                            placeholder="Hours"
                            value={a.durationHours}
                            onChange={(e) => {
                              const copy = [...activities];
                              copy[i].durationHours = Number(e.target.value);
                              setActivities(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                          <input
                            type="text"
                            placeholder="Meeting Point"
                            value={a.meetingPoint}
                            onChange={(e) => {
                              const copy = [...activities];
                              copy[i].meetingPoint = e.target.value;
                              setActivities(copy);
                            }}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: POLICIES & MEDIA */}
              {activeFormTab === "policies" && (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Hero Image URL *
                    </label>
                    <input
                      type="text"
                      id="admin-pkg-hero-image"
                      value={heroImage}
                      onChange={(e) => setHeroImage(e.target.value)}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Gallery URLs (comma separated)
                    </label>
                    <input
                      type="text"
                      id="admin-pkg-gallery"
                      value={galleryUrls}
                      onChange={(e) => setGalleryUrls(e.target.value)}
                      style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Cancellation Policy
                      </label>
                      <textarea
                        rows={3}
                        id="admin-pkg-cancellation"
                        value={cancellationPolicy}
                        onChange={(e) => setCancellationPolicy(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Date Modification Policy
                      </label>
                      <textarea
                        rows={3}
                        id="admin-pkg-modification"
                        value={modificationPolicy}
                        onChange={(e) => setModificationPolicy(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Child Policy
                      </label>
                      <textarea
                        rows={3}
                        id="admin-pkg-child-policy"
                        value={childPolicy}
                        onChange={(e) => setChildPolicy(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Payment Terms
                      </label>
                      <textarea
                        rows={3}
                        id="admin-pkg-payment-policy"
                        value={paymentPolicy}
                        onChange={(e) => setPaymentPolicy(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: "0 0 16px 16px",
              }}
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: "8px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 600, fontSize: "12px", color: "#475569", cursor: "pointer" }}
              >
                Cancel
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  id="admin-save-draft-btn"
                  disabled={submitting}
                  onClick={() => handleSavePackage("draft")}
                  style={{
                    padding: "8px 18px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#334155",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  id="admin-submit-package-btn"
                  disabled={submitting}
                  onClick={() => handleSavePackage("active")}
                  style={{
                    padding: "8px 22px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#ffffff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Publish Package</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DESTINATION MANAGEMENT MODAL (PRD Section 7.2 & 8) */}
      {showDestModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  Destination Catalogue Management
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Manage regional destinations, best travel periods, hero media, and regional FAQs.
                </p>
              </div>
              <button
                type="button"
                id="close-dest-modal-btn"
                onClick={() => setShowDestModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {destFormMode === "list" ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                      Active Destinations ({destinations.length})
                    </span>
                    <button
                      type="button"
                      id="admin-add-destination-btn"
                      onClick={openCreateDest}
                      style={{
                        padding: "6px 14px",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Plus size={14} /> Add Destination
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: "10px" }}>
                    {destinations.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "14px", color: "#0f172a" }}>{d.name}</strong>
                          <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>
                            ({d.state}, {d.country}) · Slug: <code style={{ color: "#2563eb" }}>{d.slug}</code>
                          </span>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#475569" }}>
                            {d.overview}
                          </p>
                          <small style={{ color: "#059669", fontWeight: 600 }}>
                            Best Season: {d.bestTravelPeriod} · Packages: {d.packageCount || 0}
                          </small>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => openEditDest(d)}
                            style={{
                              padding: "4px 10px",
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          {d.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => handleArchiveDestination(d.id)}
                              style={{
                                padding: "4px 10px",
                                background: "#fff",
                                border: "1px solid #fecaca",
                                color: "#b91c1c",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Destination Create / Edit Form */
                <div style={{ display: "grid", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>
                      {destFormMode === "create" ? "Create New Destination" : "Edit Destination"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setDestFormMode("list")}
                      style={{ background: "none", border: "none", color: "#2563eb", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      ← Back to Destinations List
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Destination Name *
                      </label>
                      <input
                        type="text"
                        id="dest-name-input"
                        value={destName}
                        onChange={(e) => setDestName(e.target.value)}
                        placeholder="e.g. Rajasthan Heritage"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        URL Slug *
                      </label>
                      <input
                        type="text"
                        id="dest-slug-input"
                        value={destSlug}
                        onChange={(e) => setDestSlug(e.target.value)}
                        placeholder="e.g. rajasthan-heritage"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        State *
                      </label>
                      <input
                        type="text"
                        id="dest-state-input"
                        value={destState}
                        onChange={(e) => setDestState(e.target.value)}
                        placeholder="e.g. Rajasthan"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Country
                      </label>
                      <input
                        type="text"
                        id="dest-country-input"
                        value={destCountry}
                        onChange={(e) => setDestCountry(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        City (Optional)
                      </label>
                      <input
                        type="text"
                        id="dest-city-input"
                        value={destCity}
                        onChange={(e) => setDestCity(e.target.value)}
                        placeholder="e.g. Jaipur"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Best Travel Period
                      </label>
                      <input
                        type="text"
                        id="dest-travel-period-input"
                        value={destTravelPeriod}
                        onChange={(e) => setDestTravelPeriod(e.target.value)}
                        placeholder="e.g. October to March"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Destination Overview *
                    </label>
                    <textarea
                      rows={3}
                      id="dest-overview-input"
                      value={destOverview}
                      onChange={(e) => setDestOverview(e.target.value)}
                      placeholder="Comprehensive overview of destination landscape, culture, and highlights..."
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Hero Image Path or URL
                      </label>
                      <input
                        type="text"
                        id="dest-hero-image-input"
                        value={destHeroImage}
                        onChange={(e) => setDestHeroImage(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Status
                      </label>
                      <select
                        id="dest-status-select"
                        value={destStatus}
                        onChange={(e) => setDestStatus(e.target.value as any)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="active">Active (Visible in Customer Catalog)</option>
                        <option value="draft">Draft (Admin Only)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Frequently Asked Questions (FAQs) — Separate Q&A blocks with double newline
                    </label>
                    <textarea
                      rows={4}
                      id="dest-faqs-input"
                      value={destFaqs}
                      onChange={(e) => setDestFaqs(e.target.value)}
                      placeholder={"Q: What permits are needed?\nA: Indian nationals only need valid government photo ID."}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setDestFormMode("list")}
                      style={{ padding: "8px 16px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="dest-save-btn"
                      disabled={destSubmitting}
                      onClick={handleSaveDestination}
                      style={{
                        padding: "8px 20px",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: destSubmitting ? "not-allowed" : "pointer",
                      }}
                    >
                      {destSubmitting ? "Saving..." : "Save Destination"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
