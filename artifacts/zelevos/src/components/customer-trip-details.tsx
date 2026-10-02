import React, { useState, useEffect } from 'react';
import {
  Hotel,
  Car,
  Compass,
  Phone,
  MapPin,
  Copy,
  Check,
  Download,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Bus,
  Utensils,
  Plane,
  Sparkles,
} from 'lucide-react';

interface CustomerTripDetailsProps {
  bookingId: string;
}

export function CustomerTripDetails({ bookingId }: CustomerTripDetailsProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadFulfillment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/fulfillment`, { credentials: 'include' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Could not load trip arrangements.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load trip details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      void loadFulfillment();
    }
  }, [bookingId]);

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  if (loading) {
    return (
      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
        <Clock size={20} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading confirmed trip fulfillment arrangements...</span>
      </div>
    );
  }

  if (error || !data) {
    return null; // Gracefully fail if not paid or no fulfillment record yet
  }

  const isConfirmed = data.status === 'confirmed';
  const isArranging = data.status === 'arranging';
  const components: any[] = data.components || [];

  return (
    <div style={{ marginTop: '16px', display: 'grid', gap: '14px' }}>
      {/* 1. Status Banner */}
      {isArranging && (
        <div
          id="fulfillment-arranging-banner"
          style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#fef3c7',
              display: 'grid',
              placeItems: 'center',
              color: '#d97706',
              flexShrink: 0,
            }}
          >
            <Clock size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '14px', color: '#92400e', display: 'block', marginBottom: '2px' }}>
              Arranging Your Trip Details
            </strong>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#b45309', lineHeight: 1.45 }}>
              Our team is arranging your trip. Hotel, driver and transport details will appear here and in your email.
            </p>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div
          id="fulfillment-confirmed-banner"
          style={{
            background: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#d1fae5',
                display: 'grid',
                placeItems: 'center',
                color: '#059669',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <strong style={{ fontSize: '14px', color: '#065f46', display: 'block', marginBottom: '2px' }}>
                Trip Confirmed A to Z
              </strong>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#047857', lineHeight: 1.4 }}>
                Your booking is fully confirmed from A to Z — you're all set to travel.
              </p>
            </div>
          </div>

          <a
            id="download-voucher-pdf-btn"
            href={`/api/bookings/${bookingId}/trip-voucher`}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#059669',
              color: '#ffffff',
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Download size={15} />
            <span>Download Voucher (PDF)</span>
          </a>
        </div>
      )}

      {/* 2. Component Cards */}
      {components.length > 0 && (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Confirmed Arrangements ({components.length})
            </span>
            {isConfirmed && (
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Verified with On-Ground Concierge
              </span>
            )}
          </div>

          {components.map((comp) => {
            const type = (comp.componentType || '').toUpperCase();
            const d = comp.details || {};

            // HOTEL CARD
            if (type === 'HOTEL') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-hotel-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <Hotel size={16} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.hotelName || comp.title || 'Hotel Stay'}</strong>
                    </div>
                    {d.roomType && (
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>
                        {d.roomType} {d.numberOfRooms ? `(${d.numberOfRooms} Room${d.numberOfRooms > 1 ? 's' : ''})` : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>CHECK-IN / OUT</span>
                      <strong style={{ color: '#1e293b' }}>
                        {d.checkInDate || 'Arrival Day'} ({d.checkInTime || '14:00'}) → {d.checkOutDate || 'Departure'} ({d.checkOutTime || '11:00'})
                      </strong>
                      {d.nights && <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>{d.nights} Night(s) Stay</span>}
                    </div>

                    {d.mealPlan && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>MEAL PLAN</span>
                        <strong style={{ color: '#1e293b' }}>{d.mealPlan}</strong>
                      </div>
                    )}

                    {d.confirmationNumber && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>HOTEL CONFIRMATION NO.</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{d.confirmationNumber}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(d.confirmationNumber, `htl-conf-${comp.id}`)}
                            title="Copy Confirmation Number"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                          >
                            {copiedKey === `htl-conf-${comp.id}` ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address & Google Maps link & Phone */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '12px', paddingTop: '4px' }}>
                    {d.fullAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                        <MapPin size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span>{d.fullAddress}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.fullAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}
                        >
                          <span>Open in Maps</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}

                    {d.hotelPhone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} color="#059669" />
                        <a href={`tel:${d.hotelPhone}`} style={{ color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
                          {d.hotelPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // CAB / TRANSFER CARD
            if (type === 'CAB') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-cab-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                        <Car size={16} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.vehicleModel || comp.title || 'Private Cab Transfer'}</strong>
                    </div>
                    {d.vehicleRegistrationNumber && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', padding: '3px 8px', borderRadius: '6px' }}>
                          {d.vehicleRegistrationNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(d.vehicleRegistrationNumber, `veh-reg-${comp.id}`)}
                          title="Copy Vehicle Reg"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                        >
                          {copiedKey === `veh-reg-${comp.id}` ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>ASSIGNED CHAUFFEUR</span>
                      <strong style={{ color: '#1e293b' }}>{d.driverName || 'Verified Driver'}</strong>
                      {d.driverPhone && (
                        <div style={{ marginTop: '3px' }}>
                          <a href={`tel:${d.driverPhone}`} style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={13} />
                            <span>{d.driverPhone}</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>PICKUP POINT & TIME</span>
                      <strong style={{ color: '#1e293b' }}>{d.pickupPoint || 'Airport / Station'}</strong>
                      {d.pickupDateTime && <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>{d.pickupDateTime}</span>}
                    </div>

                    {d.dropPoint && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>DROP / CIRCUIT ROUTE</span>
                        <strong style={{ color: '#1e293b' }}>{d.dropPoint}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // BUS CARD
            if (type === 'BUS') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-bus-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center' }}>
                        <Bus size={16} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.operatorName || comp.title || 'Luxury Coach / Bus'}</strong>
                    </div>
                    {d.busRegistrationNumber && (
                      <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', padding: '3px 8px', borderRadius: '6px' }}>
                        {d.busRegistrationNumber}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>BOARDING POINT & TIME</span>
                      <strong style={{ color: '#1e293b' }}>{d.boardingPoint || 'Central Terminal'}</strong>
                      {d.boardingTime && <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{d.boardingTime}</span>}
                    </div>
                    {d.seatNumbers && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SEATS</span>
                        <strong style={{ color: '#2563eb' }}>{d.seatNumbers}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // GUIDE CARD
            if (type === 'GUIDE') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-guide-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f5f3ff', color: '#7c3aed', display: 'grid', placeItems: 'center' }}>
                        <Compass size={16} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.guideName ? `${d.guideName} (Tour Guide)` : comp.title}</strong>
                    </div>
                    {d.languages && (
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px' }}>
                        {d.languages}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>MEETING POINT & TIME</span>
                      <strong style={{ color: '#1e293b' }}>{d.meetingPoint || 'Hotel Lobby'}</strong>
                      {d.dateTime && <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{d.dateTime}</span>}
                    </div>

                    {d.phone && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>CONTACT GUIDE</span>
                        <a href={`tel:${d.phone}`} style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={13} />
                          <span>{d.phone}</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // MEALS CARD
            if (type === 'MEALS') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-meals-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#fff1f2', color: '#e11d48', display: 'grid', placeItems: 'center' }}>
                      <Utensils size={16} />
                    </div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.restaurantName || comp.title}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                    <div><strong>Meal Type:</strong> {d.mealType || 'Breakfast & Dinner'}</div>
                    {d.timing && <div><strong>Timing:</strong> {d.timing}</div>}
                    {d.address && <div><strong>Location:</strong> {d.address}</div>}
                  </div>
                </div>
              );
            }

            // FLIGHT CARD
            if (type === 'FLIGHT') {
              return (
                <div
                  key={comp.id}
                  id={`fulfillment-card-flight-${comp.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <Plane size={16} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{d.airline ? `${d.airline} ${d.flightNumber || ''}` : comp.title}</strong>
                    </div>
                    {d.pnr && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#2563eb', fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', padding: '3px 8px', borderRadius: '6px' }}>
                          PNR: {d.pnr}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(d.pnr, `flt-pnr-${comp.id}`)}
                          title="Copy PNR"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                        >
                          {copiedKey === `flt-pnr-${comp.id}` ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // GENERIC / OTHER CARD
            return (
              <div
                key={comp.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '12px',
                }}
              >
                <strong>{comp.title}</strong>
                <pre style={{ margin: '6px 0 0', background: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(d, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Concierge 24x7 Helpdesk Box */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: '#475569',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="#2563eb" />
          <span>Need on-ground assistance during your trip? <strong>Zelevos 24/7 Concierge:</strong> +91 98765 43210</span>
        </div>
        <a href="tel:+919876543210" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
          Call Now
        </a>
      </div>
    </div>
  );
}
