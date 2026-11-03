/**
 * HelpSupportDesk.tsx — Static Human-Operated Support & Helpdesk Widget
 *
 * PHASE 8 GOVERNANCE HARDENING:
 * Replaces the obsolete runtime AI chatbot with a strictly human-operated
 * BPO client support and direct communications interface.
 * Zero AI dependencies, zero external LLM calls.
 */

import { useState, useEffect } from "react";
import { Headphones, X, Phone, Mail, FileText, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export function HelpSupportDesk() {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Human Support floating widget globally disabled per UI requirements.
  // Implementation preserved below.
  return null;

  return (
    <>
      {/* Floating Support Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center gap-2 px-4 h-12 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer border border-blue-400/30"
        aria-label={isOpen ? "Close Helpdesk" : "Open Human Operations Support"}
        title="Human Support Desk"
      >
        {isOpen ? (
          <>
            <X className="w-5 h-5" />
            <span className="text-xs font-semibold tracking-wide">Close</span>
          </>
        ) : (
          <>
            <Headphones className="w-5 h-5" />
            <span className="text-xs font-semibold tracking-wide hidden sm:inline">Human Support</span>
          </>
        )}
      </button>

      {/* Support Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Human Operations Support"
          className="fixed bottom-22 right-6 z-40 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <Headphones className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white leading-tight">Thinkatic Support Desk</h3>
                <p className="text-[11px] text-blue-200/80">Human-Operated BPO Operations</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-4 space-y-2 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold px-1">
              Direct Assistance Channels
            </p>

            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                    Contact Operations Team
                  </div>
                  <div className="text-[10px] text-slate-500">Inquiries, escalation & account managers</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              href="/request-proposal"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    Request Custom Proposal
                  </div>
                  <div className="text-[10px] text-slate-500">Dedicated BPO capacity & SLA scope</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </Link>

            <Link
              href="/pricing"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                    BPO Plans & Pricing
                  </div>
                  <div className="text-[10px] text-slate-500">Seat tiers, SLAs & engagement models</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </Link>
          </div>

          {/* Operational Contact Info */}
          <div className="p-4 bg-white space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <a href="tel:+18008446528" className="hover:text-blue-700 font-medium">
                +1 (800) 844-6528
              </a>
              <span className="text-[10px] text-slate-400 ml-auto font-mono">Toll-Free</span>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <a href="mailto:support@thinkatic.com" className="hover:text-blue-700 font-medium truncate">
                support@thinkatic.com
              </a>
              <span className="text-[10px] text-slate-400 ml-auto font-mono">24/7 SLA</span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Delivery Centre:</span>
              <span className="font-semibold text-slate-700">Pune, India</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
