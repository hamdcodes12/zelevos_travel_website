/**
 * PARKED COMPONENT: Marketplace (Legacy AI Marketplace / Experiences Section)
 * 
 * Status: PARKED (Not part of active V1 Curated Marketplace customer journey)
 * PRD Reference: Wayora_PRD_Without_APIs Section 7.1 & Section 8
 * Replaced by CuratedPackagesSection on the V1 homepage. Preserved per directive's "park, don't delete" rule.
 */

import { Star, ArrowRight } from "lucide-react";
import type { AuthUser } from "@/components/auth-dialog";

export interface MarketplaceProps {
  user: AuthUser | null;
  onLogin: () => void;
  onToast: (message: string) => void;
}

const imageSources = {
  kerala: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=85",
  udaipur: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=85",
  rajasthan: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=85",
};

export function Marketplace({ user, onLogin, onToast }: MarketplaceProps) {
  const cards = [
    { id: "experience-2", name: "Meera", role: "Jaipur food & culture host", detail: "4-hour local food walk", price: 2200, rating: "4.9", image: imageSources.rajasthan },
    { id: "experience-4", name: "Arjun", role: "Rajasthan photographer", detail: "Sunrise couple photography", price: 3200, rating: "4.8", image: imageSources.udaipur },
    { id: "experience-3", name: "Sana", role: "Kerala slow travel guide", detail: "Backwater day with a local", price: 2400, rating: "5.0", image: imageSources.kerala },
  ];

  const book = async (card: typeof cards[number]) => {
    if (!user) {
      onLogin();
      return;
    }
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ACTIVITY",
          itemId: card.id,
          amount: card.price,
          payload: { name: card.name, detail: card.detail, mode: "DEMO" },
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Demo experience booking failed.");
      onToast(payload.message || "Demo experience booked.");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Demo experience booking failed.");
    }
  };

  return (
    <section id="marketplace" className="marketplace">
      <div className="page-shell">
        <div className="marketplace-heading">
          <div className="section-heading">
            <div className="eyebrow"><span className="eyebrow-line" />PARKED EXPERIENCES</div>
            <h2>Go beyond the <span>guidebook.</span></h2>
            <p>Meet local people, trusted suppliers, and experiences worth making room for.</p>
          </div>
        </div>
        <div className="marketplace-grid">
          {cards.map((card) => (
            <article className="hero-card" key={card.name}>
              <img src={card.image} alt={card.role} />
              <div className="hero-card-content">
                <div className="hero-avatar">{card.name.slice(0, 1)}</div>
                <div>
                  <strong>{card.name}</strong>
                  <span>{card.role}</span>
                </div>
                <span className="rating"><Star size={13} fill="currentColor" /> {card.rating}</span>
                <p>{card.detail}</p>
                <div>
                  <strong>₹{card.price.toLocaleString("en-IN")}</strong> <span>/ person · DEMO</span>
                  <button className="button button-primary" onClick={() => void book(card)}>Book now</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
