import React, { useState } from "react";
import {
  X,
  Sparkles,
  Calendar,
  Users,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  Building,
  Car,
  Plane,
  Bus,
  Utensils,
  Shield,
  HeartHandshake,
  Paperclip,
  Trash2,
  FileText,
  UploadCloud,
  Check,
  Compass,
} from "lucide-react";
import { useModalA11y } from "./ui/modal-helper";

interface UploadedDoc {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export function CustomTripModal({ onClose, user }: { onClose: () => void; user?: any }) {
  const [step, setStep] = useState<"form" | "submitting" | "success">("form");

  // 1. Where would you like to travel?
  const [startingLocation, setStartingLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [destinations, setDestinations] = useState("");
  const [datesFlexible, setDatesFlexible] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [durationDays, setDurationDays] = useState(6);

  // 2. Travellers & Budget
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [budget, setBudget] = useState(90000);
  const [budgetRange, setBudgetRange] = useState("Comfort (₹50,000 - ₹1,00,000)");

  // 3. Stay Preferences
  const [stayPreference, setStayPreference] = useState("Hotels & Resorts");
  const [hotelCategory, setHotelCategory] = useState("4 Star / Boutique");
  const [roomType, setRoomType] = useState("Deluxe Room");
  const [roomsCount, setRoomsCount] = useState(1);

  // 4. Transport Preferences (Extensible model: flight, cab, bus, pickup/drop, local transport)
  const [transportCab, setTransportCab] = useState(true);
  const [cabVehicleType, setCabVehicleType] = useState("SUV (Innova Crysta / Ertiga)");
  const [airportPickup, setAirportPickup] = useState(true);
  const [airportDrop, setAirportDrop] = useState(true);
  const [localSightseeing, setLocalSightseeing] = useState(true);

  const [transportFlight, setTransportFlight] = useState(false);
  const [flightClass, setFlightClass] = useState("Economy");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");

  const [transportBus, setTransportBus] = useState(false);
  const [busSeatingType, setBusSeatingType] = useState("Volvo Multi-Axle AC Sleeper");

  // 5. Meal Preferences
  const [mealBreakfast, setMealBreakfast] = useState(true);
  const [mealLunch, setMealLunch] = useState(false);
  const [mealDinner, setMealDinner] = useState(true);
  const [mealAll, setMealAll] = useState(false);
  const [dietType, setDietType] = useState<"Vegetarian" | "Non-Vegetarian" | "Both">("Non-Vegetarian");
  const [hasDietaryRestrictions, setHasDietaryRestrictions] = useState(false);
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [hasFoodAllergies, setHasFoodAllergies] = useState(false);
  const [foodAllergies, setFoodAllergies] = useState("");

  // 6. Activities & Experiences
  const [activities, setActivities] = useState<string[]>([
    "Scenic & Nature Drives",
    "Local Heritage & Culture",
    "Curated Dining",
  ]);

  // 7. Accessibility & Safety
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState(false);
  const [wheelchairAssistance, setWheelchairAssistance] = useState(false);
  const [accessibilityDetails, setAccessibilityDetails] = useState("");
  const [travelInsurancePreference, setTravelInsurancePreference] = useState(true);

  // 8. Emergency Contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  // 9. Special Requests
  const [specialRequests, setSpecialRequests] = useState("");

  // 10. Documents & Template
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Contact Details
  const [customerName, setCustomerName] = useState(user?.fullName || "");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");

  const displayCustomerId = user?.customerId || (user?.id ? `ZLV-CUS-${user.id.slice(0, 6).toUpperCase()}` : "ZLV-CUS-GUEST");

  const [leadNumber, setLeadNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isDirty = step === "form" && Boolean(destination.trim() || destinations.trim() || specialRequests.trim());
  const { contentRef, requestClose, handleBackdropClick } = useModalA11y({
    isOpen: true,
    onClose,
    isDirty,
  });

  // Calculate duration automatically if both dates selected
  const handleDateChange = (start: string, end: string) => {
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setDurationDays(diffDays);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size exceeds 10MB limit. Please upload a smaller document.");
      return;
    }

    setUploadingDoc(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/custom-trips/upload-document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.document) {
        throw new Error(data.message || "Failed to upload document.");
      }

      setDocuments((prev) => [...prev, data.document]);
    } catch (err: any) {
      setUploadError(err.message || "Document upload failed. Please try again.");
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleActivity = (act: string) => {
    setActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("submitting");
    setErrorMessage("");

    const effectiveDest = destination.trim() || destinations.trim();
    if (!effectiveDest) {
      setErrorMessage("Please enter where you would like to travel.");
      setStep("form");
      return;
    }

    const transportTypes: string[] = [];
    if (transportCab) transportTypes.push("cab");
    if (transportFlight) transportTypes.push("flight");
    if (transportBus) transportTypes.push("bus");

    const mealPlans: string[] = [];
    if (mealAll) mealPlans.push("All Meals (AP)");
    else {
      if (mealBreakfast) mealPlans.push("Breakfast (CP)");
      if (mealLunch) mealPlans.push("Lunch");
      if (mealDinner) mealPlans.push("Dinner (MAP)");
    }

    const totalTravellers = adultsCount + childrenCount + infantsCount;

    try {
      const res = await fetch("/api/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          startingLocation: startingLocation.trim() || undefined,
          destination: effectiveDest,
          destinations: destinations.split(",").map((d) => d.trim()).filter(Boolean).length > 0
            ? destinations.split(",").map((d) => d.trim()).filter(Boolean)
            : [effectiveDest],
          datesFlexible,
          startDate: startDate || undefined,
          travelDate: startDate || undefined,
          endDate: returnDate || undefined,
          returnDate: returnDate || undefined,
          durationDays: Number(durationDays),
          travellersCount: totalTravellers,
          adultsCount: Number(adultsCount),
          childrenCount: Number(childrenCount),
          infantsCount: Number(infantsCount),
          budget: Number(budget),
          budgetRange,
          budgetPerPerson: Math.round(Number(budget) / (totalTravellers || 1)),
          stayPreference,
          hotelPreference: hotelCategory,
          hotelCategory,
          roomType,
          roomsCount: Number(roomsCount),
          transportPreference: transportCab ? "Private Cab" : transportFlight ? "Flight" : "Self/Local",
          transportTypes,
          flightPreference: transportFlight
            ? {
                required: true,
                class: flightClass,
                departureAirport,
                arrivalAirport,
              }
            : undefined,
          cabPreference: transportCab
            ? {
                required: true,
                vehicleType: cabVehicleType,
                airportPickup,
                airportDrop,
                localSightseeing,
              }
            : undefined,
          busPreference: transportBus
            ? {
                required: true,
                seatingType: busSeatingType,
              }
            : undefined,
          mealPreferences: {
            plans: mealPlans,
            dietType,
            dietaryRestrictions: hasDietaryRestrictions ? dietaryRestrictions : undefined,
            foodAllergies: hasFoodAllergies ? foodAllergies : undefined,
            breakfast: mealBreakfast,
            lunch: mealLunch,
            dinner: mealDinner,
            allMeals: mealAll,
          },
          activitiesInterests: activities,
          accessibility: hasAccessibilityNeeds
            ? {
                required: true,
                wheelchairAssistance,
                details: accessibilityDetails,
              }
            : undefined,
          travelInsurancePreference,
          emergencyContact: emergencyName
            ? {
                name: emergencyName,
                phone: emergencyPhone,
                relationship: emergencyRelation,
              }
            : undefined,
          specialRequests,
          documents,
          isTemplate,
          templateName: isTemplate ? templateName || `${effectiveDest} Vacation Template` : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.request) {
        throw new Error(data.message || "Failed to submit custom request.");
      }

      setLeadNumber(data.request.leadNumber || data.leadNumber || `LEAD-${Date.now().toString().slice(-6)}`);
      setStep("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not submit custom trip request.");
      setStep("form");
    }
  };

  const activityOptions = [
    "Scenic & Nature Drives",
    "Local Heritage & Culture",
    "Curated Dining",
    "Adventure & Trekking",
    "Water Activities / Boating",
    "Photography & Wildlife",
    "Spa, Wellness & Yoga",
    "Shopping & Local Crafts",
  ];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-y-auto"
    >
      <div
        ref={contentRef}
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">Build My Trip — Complete Vacation Request</h3>
              <p className="text-xs text-blue-200">Personalized itinerary tailored by Zelevos destination experts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            id="close-custom-trip-btn"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECTION 1: DESTINATION & DATES */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <MapPin size={16} /> 1. Where would you like to travel & when?
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starting Location (City / Airport)
                  </label>
                  <input
                    type="text"
                    id="custom-starting-location-input"
                    value={startingLocation}
                    onChange={(e) => setStartingLocation(e.target.value)}
                    placeholder="e.g. Mumbai, New Delhi, Bengaluru"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Destination *
                  </label>
                  <input
                    type="text"
                    id="custom-destinations-input"
                    required
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      if (!destinations) setDestinations(e.target.value);
                    }}
                    placeholder="e.g. Kashmir, Ladakh, Kerala, Rajasthan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Travel Date</label>
                  <input
                    type="date"
                    id="custom-start-date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      handleDateChange(e.target.value, returnDate);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Date</label>
                  <input
                    type="date"
                    id="custom-return-date"
                    value={returnDate}
                    onChange={(e) => {
                      setReturnDate(e.target.value);
                      handleDateChange(startDate, e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trip Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    id="custom-duration-days"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="custom-dates-flexible"
                  checked={datesFlexible}
                  onChange={(e) => setDatesFlexible(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="custom-dates-flexible" className="text-xs text-slate-600 select-none cursor-pointer">
                  My travel dates are flexible (± 3 days for better rates & availability)
                </label>
              </div>
            </div>

            {/* SECTION 2: NUMBER OF TRAVELLERS & BUDGET */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <Users size={16} /> 2. Number of Travellers & Budget
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adults (12y+)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    id="custom-adults-count"
                    value={adultsCount}
                    onChange={(e) => setAdultsCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Children (2-11y)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    id="custom-children-count"
                    value={childrenCount}
                    onChange={(e) => setChildrenCount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Infants (&lt;2y)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    id="custom-infants-count"
                    value={infantsCount}
                    onChange={(e) => setInfantsCount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Smart Conditional helper for children */}
              {childrenCount > 0 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2">
                  <Check size={14} className="text-blue-600 flex-shrink-0" />
                  <span>
                    Travelling with {childrenCount} child{childrenCount > 1 ? "ren" : ""}. We'll suggest family-friendly hotels with extra beds and kids menus.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Approx. Total Budget (₹)</label>
                  <input
                    type="number"
                    step={5000}
                    id="custom-budget-input"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget Range Preference</label>
                  <select
                    id="custom-budget-range"
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option>Standard (₹30,000 - ₹50,000)</option>
                    <option>Comfort (₹50,000 - ₹1,00,000)</option>
                    <option>Premium (₹1,00,000 - ₹2,00,000)</option>
                    <option>Luxury Curated (₹2,00,000+)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: STAY PREFERENCES & ROOM DETAILS */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <Building size={16} /> 3. Stay Preference & Room Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stay Category</label>
                  <select
                    id="custom-stay-preference"
                    value={stayPreference}
                    onChange={(e) => setStayPreference(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option>Hotels & Resorts</option>
                    <option>Boutique Heritage Havelis</option>
                    <option>Eco Cottages & Homestays</option>
                    <option>Luxury Private Villas</option>
                    <option>Camps & Glamping</option>
                    <option>None (Self-Booked)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hotel Star Rating</label>
                  <select
                    id="custom-hotel-category"
                    value={hotelCategory}
                    onChange={(e) => setHotelCategory(e.target.value)}
                    disabled={stayPreference === "None (Self-Booked)"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option>4 Star / Boutique</option>
                    <option>5 Star Luxury</option>
                    <option>3 Star Comfort</option>
                    <option>Heritage Palace</option>
                  </select>
                </div>
              </div>

              {stayPreference !== "None (Self-Booked)" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Room Type</label>
                    <select
                      id="custom-room-type"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option>Deluxe Room</option>
                      <option>Super Deluxe / Premium</option>
                      <option>Executive Suite</option>
                      <option>Family Suite / Interconnecting</option>
                      <option>Villa with Private Pool</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Rooms</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      id="custom-rooms-count"
                      value={roomsCount}
                      onChange={(e) => setRoomsCount(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4: TRANSPORT PREFERENCES */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                  <Car size={16} /> 4. Transport Preferences
                </div>
                <span className="text-[11px] text-slate-500 italic">Select all applicable</span>
              </div>

              {/* Mode toggles */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="toggle-transport-cab"
                  onClick={() => setTransportCab(!transportCab)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    transportCab
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Car size={14} /> Private Cab
                </button>
                <button
                  type="button"
                  id="toggle-transport-flight"
                  onClick={() => setTransportFlight(!transportFlight)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    transportFlight
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Plane size={14} /> Flight
                </button>
                <button
                  type="button"
                  id="toggle-transport-bus"
                  onClick={() => setTransportBus(!transportBus)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    transportBus
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Bus size={14} /> Bus / Coach
                </button>
              </div>

              {/* Conditional Cab preferences */}
              {transportCab && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Car size={14} className="text-blue-600" /> Cab Preferences
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vehicle Type</label>
                    <select
                      id="custom-cab-vehicle-type"
                      value={cabVehicleType}
                      onChange={(e) => setCabVehicleType(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option>SUV (Innova Crysta / Ertiga)</option>
                      <option>Sedan (Dzire / Etios / City)</option>
                      <option>Luxury Sedan (BMW / Mercedes / Camry)</option>
                      <option>Tempo Traveller (9-16 Seater)</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={airportPickup}
                        onChange={(e) => setAirportPickup(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Airport / Station Pickup</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={airportDrop}
                        onChange={(e) => setAirportDrop(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Airport / Station Drop</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSightseeing}
                        onChange={(e) => setLocalSightseeing(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Local Sightseeing Cab</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Conditional Flight preferences */}
              {transportFlight && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Plane size={14} className="text-blue-600" /> Flight Assistance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Departure City</label>
                      <input
                        type="text"
                        placeholder="e.g. BOM / DEL"
                        value={departureAirport}
                        onChange={(e) => setDepartureAirport(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Arrival City</label>
                      <input
                        type="text"
                        placeholder="e.g. SXR / IXL"
                        value={arrivalAirport}
                        onChange={(e) => setArrivalAirport(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cabin Class</label>
                      <select
                        value={flightClass}
                        onChange={(e) => setFlightClass(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option>Economy</option>
                        <option>Premium Economy</option>
                        <option>Business Class</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Bus preference */}
              {transportBus && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Bus size={14} className="text-blue-600" /> Bus / Coach Details
                  </div>
                  <select
                    value={busSeatingType}
                    onChange={(e) => setBusSeatingType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option>Volvo Multi-Axle AC Sleeper</option>
                    <option>AC Semi-Sleeper Coach</option>
                    <option>Luxury BharatBenz Seater</option>
                  </select>
                </div>
              )}
            </div>

            {/* SECTION 5: MEAL PREFERENCES & DIETARY */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <Utensils size={16} /> 5. Meal Preferences & Dietary Requirements
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={mealBreakfast}
                    onChange={(e) => setMealBreakfast(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Breakfast</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={mealLunch}
                    onChange={(e) => setMealLunch(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Lunch</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={mealDinner}
                    onChange={(e) => setMealDinner(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Dinner</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={mealAll}
                    onChange={(e) => {
                      setMealAll(e.target.checked);
                      if (e.target.checked) {
                        setMealBreakfast(true);
                        setMealLunch(true);
                        setMealDinner(true);
                      }
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className="font-bold text-blue-800">All Meals (Full Board)</span>
                </label>
              </div>

              {/* Diet Type */}
              <div className="flex items-center gap-4 text-xs pt-1">
                <span className="font-semibold text-slate-700">Diet Type:</span>
                {(["Vegetarian", "Non-Vegetarian", "Both"] as const).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="diet-type"
                      checked={dietType === type}
                      onChange={() => setDietType(type)}
                      className="text-blue-600"
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>

              {/* Dietary Restrictions toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={hasDietaryRestrictions}
                      onChange={(e) => setHasDietaryRestrictions(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold">Special Dietary Restrictions</span>
                  </label>
                  {hasDietaryRestrictions && (
                    <input
                      type="text"
                      placeholder="e.g. Jain food, Vegan, Halal, Gluten-free"
                      value={dietaryRestrictions}
                      onChange={(e) => setDietaryRestrictions(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={hasFoodAllergies}
                      onChange={(e) => setHasFoodAllergies(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold">Food Allergies</span>
                  </label>
                  {hasFoodAllergies && (
                    <input
                      type="text"
                      placeholder="e.g. Peanuts, Shellfish, Dairy, Lactose"
                      value={foodAllergies}
                      onChange={(e) => setFoodAllergies(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 6: ACTIVITIES & EXPERIENCES */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <Compass size={16} /> 6. Activities & Experiences
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activityOptions.map((act) => {
                  const isSelected = activities.includes(act);
                  return (
                    <button
                      type="button"
                      key={act}
                      onClick={() => toggleActivity(act)}
                      className={`p-2 text-left rounded-xl border text-xs font-semibold transition ${
                        isSelected
                          ? "bg-blue-50 border-blue-500 text-blue-800"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="line-clamp-1">{act}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 7: ACCESSIBILITY, INSURANCE & EMERGENCY CONTACT */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <Shield size={16} /> 7. Accessibility, Safety & Insurance
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAccessibilityNeeds}
                    onChange={(e) => setHasAccessibilityNeeds(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-semibold">Accessibility / Mobility Requirements</span>
                </label>

                {hasAccessibilityNeeds && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={wheelchairAssistance}
                        onChange={(e) => setWheelchairAssistance(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Wheelchair assistance required at airport / hotels</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Specify accessibility requirements (e.g. ground floor room, elevator)"
                      value={accessibilityDetails}
                      onChange={(e) => setAccessibilityDetails(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={travelInsurancePreference}
                    onChange={(e) => setTravelInsurancePreference(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Include comprehensive travel insurance coverage with medical & trip cancellation protection</span>
                </label>
              </div>

              {/* Emergency Contact */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-slate-700 mb-2">Emergency Contact</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Spouse, Parent)"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 8: SPECIAL REQUESTS */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700">
                Special Requests & Notes for Travel Specialist
              </label>
              <textarea
                rows={2}
                id="custom-special-requests"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Anniversary celebration, honeymoon room setup, photography preferences, mountain view rooms, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* SECTION 9: DOCUMENT ATTACHMENTS & TEMPLATE */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                  <Paperclip size={16} /> 8. Document Attachments
                </div>
                <span className="text-[11px] text-slate-500">PDF, JPG, PNG, DOCX (Max 10MB)</span>
              </div>

              {uploadError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-1.5">
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}

              {/* Uploaded Documents List */}
              {documents.length > 0 && (
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={16} className="text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{doc.fileName}</span>
                        <span className="text-slate-500 text-[11px]">
                          ({Math.round(doc.fileSize / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded transition"
                        title="Remove document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <div>
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition">
                  <UploadCloud size={16} />
                  <span>{uploadingDoc ? "Uploading Document..." : "Upload Document (ID, Itinerary Draft, Visa, etc.)"}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                    onChange={handleFileUpload}
                    disabled={uploadingDoc}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Save as Template */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTemplate}
                    onChange={(e) => setIsTemplate(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-semibold">Save as Template for future vacation bookings</span>
                </label>
                {isTemplate && (
                  <input
                    type="text"
                    placeholder="Template Name (e.g. Annual Family Mountain Getaway)"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="mt-2 w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                )}
              </div>
            </div>

            {/* SECTION 10: CONTACT DETAILS */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider block">
                  Your Verified Contact Details
                </span>
                <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Customer ID: {displayCustomerId}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    id="custom-contact-name"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="Email"
                    id="custom-contact-email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    id="custom-contact-phone"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submission CTA */}
            <div className="pt-2">
              <button
                type="submit"
                id="submit-custom-trip-btn"
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-base transition transform active:scale-[0.99]"
              >
                Submit Travel Requirements <ArrowRight size={18} />
              </button>
            </div>
          </form>
        )}

        {step === "submitting" && (
          <div className="p-16 text-center space-y-4 my-auto">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
            <h4 className="font-extrabold text-slate-900 text-lg">Submitting Your Travel Requirements...</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Saving your travel preferences to the Zelevos destination desk and assigning a curated operations specialist.
            </p>
          </div>
        )}

        {step === "success" && (
          <div id="custom-trip-success-view" className="p-8 sm:p-12 text-center space-y-6 my-auto">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={44} />
            </div>
            <div>
              <h4 className="text-2xl font-extrabold text-slate-900">Custom Trip Request Received!</h4>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto">
                Your travel requirements have been successfully logged and routed to our bespoke planning desk. A dedicated destination specialist will curate a handcrafted proposal within 24 hours.
              </p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block">
                Lead Reference Number
              </span>
              <span id="custom-trip-lead-number" className="text-2xl sm:text-3xl font-mono font-extrabold text-blue-900 mt-1 block">
                {leadNumber}
              </span>
            </div>
            <button
              onClick={onClose}
              id="close-custom-trip-success-btn"
              className="px-8 py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition text-sm shadow-md"
            >
              Done & Browse More Holidays
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
