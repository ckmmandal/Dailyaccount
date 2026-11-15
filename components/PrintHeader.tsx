
import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { SystemSettings } from '../types';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({ title, subtitle }) => {
  const { settings: authSettings } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(authSettings);

  useEffect(() => {
    storageService.getSettings().then(s => {
      if (s) setSettings(s);
    });
  }, []);

  const currentSettings = settings || authSettings;
  const rawLogo = currentSettings?.logoUrl;
  const logoUrl = (rawLogo && !rawLogo.includes('picsum.photos')) ? rawLogo : '/system_logo.png';
  
  return (
    <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6 w-full">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-6">
          <img 
            src={logoUrl} 
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes('system_logo.png')) {
                target.src = '/system_logo.png';
              }
            }}
            className="w-24 h-24 object-contain" 
            alt="Logo" 
          />
          <div>
            {currentSettings?.systemNameNp && (
              <div className="text-lg font-black text-emerald-800 leading-tight mb-0.5">{currentSettings.systemNameNp}</div>
            )}
            <h1 className="text-3xl font-black text-slate-950 uppercase italic tracking-tighter leading-none mb-2">{currentSettings?.systemName || "RATAULI SACCOS"}</h1>
            <div className="space-y-1">
              {(currentSettings?.address || currentSettings?.addressNp) && (
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 italic">
                  <MapPin size={10}/>
                  <span>{currentSettings?.address}{currentSettings?.address && currentSettings?.addressNp ? ' • ' : ''}{currentSettings?.addressNp}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                {currentSettings?.phone && <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 italic"><Phone size={10}/> <span>{currentSettings.phone}</span></div>}
                {currentSettings?.email && <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 italic"><Mail size={10}/> <span>{currentSettings.email}</span></div>}
                {currentSettings?.registrationNo && <div className="text-xs font-bold text-slate-600 font-mono">Regd: {currentSettings.registrationNo}</div>}
                {currentSettings?.panNo && <div className="text-xs font-bold text-slate-600 font-mono">PAN: {currentSettings.panNo}</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-950 text-white px-6 py-2 rounded-xl text-lg font-black uppercase tracking-widest italic">{title}</div>
          {subtitle && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{subtitle}</p>}
          <p className="text-[9px] font-bold text-slate-300 mt-1 uppercase italic">Generated on: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};
