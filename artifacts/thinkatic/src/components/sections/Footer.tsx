import { Linkedin, Instagram } from 'lucide-react';
import BrandLogo from '../layout/BrandLogo';

function ThinkaticLogoMark() {
  return <BrandLogo compact />;
}

export function Footer() {
  return (
    <footer className="bg-white py-16 border-t border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-center md:text-left">
          <ThinkaticLogoMark />
          <div className="text-slate-600 mt-2">Building Intelligent AI Solutions</div>
        </div>
        
        <div className="flex gap-8 text-sm font-medium text-slate-600">
          <a href="#services" className="hover:text-[#214ECF] transition-colors">Services</a>
          <a href="#process" className="hover:text-[#214ECF] transition-colors">Process</a>
          <a href="#work" className="hover:text-[#214ECF] transition-colors">Work</a>
          <a href="#about" className="hover:text-[#214ECF] transition-colors">Contact</a>
        </div>

        <div className="flex gap-6">
          <a href="https://www.linkedin.com/company/thinkatic/" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#214ECF] transition-colors"><Linkedin size={20} /></a>
          <a href="https://www.instagram.com/thinkaticai?igsh=MWxuY2R4Ym5idGUzYg==" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#214ECF] transition-colors"><Instagram size={20} /></a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-16 text-center text-sm text-slate-500">
        © 2025 Thinkatic. All rights reserved.
      </div>
    </footer>
  );
}
