import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrProps {
  memberCode?: string;
  memberName?: string;
  designation?: string;
  size?: number;
  className?: string;
  showLabel?: boolean;
  qrData?: string;
}

export const OfficialSecurityQrCode: React.FC<QrProps> = ({
  memberCode = 'MEM-001',
  memberName = '',
  designation = '',
  size = 84,
  className = '',
  showLabel = true,
  qrData
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  // Official verification URL or custom data payload
  const verificationPayload = qrData || 
    `https://ratauli.org.np/verify?id=${encodeURIComponent(memberCode)}&name=${encodeURIComponent(memberName)}&role=${encodeURIComponent(designation)}`;

  useEffect(() => {
    let isMounted = true;

    QRCode.toDataURL(verificationPayload, {
      width: Math.max(size * 3, 260), // High DPI for crisp printing and scanning
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#064e3b', // Deep forest emerald matching cooperative logo
        light: '#ffffff'  // Pure crisp white for 100% scannability
      }
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch((err) => {
        console.error('QR code generation failed, using fallback:', err);
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [verificationPayload, size]);

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      {/* High-Security Framed QR Container */}
      <div 
        className="relative p-1.5 bg-white rounded-xl shadow-xs border-2 border-emerald-700/60 transition-all hover:border-amber-400"
        style={{ width: size, height: size }}
      >
        {/* Decorative Golden Corner Accents for Security Look */}
        <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t-2 border-l-2 border-amber-400 rounded-tl pointer-events-none" />
        <div className="absolute top-0.5 right-0.5 w-2 h-2 border-t-2 border-r-2 border-amber-400 rounded-tr pointer-events-none" />
        <div className="absolute bottom-0.5 left-0.5 w-2 h-2 border-b-2 border-l-2 border-amber-400 rounded-bl pointer-events-none" />
        <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b-2 border-r-2 border-amber-400 rounded-br pointer-events-none" />

        {/* Real Scannable QR Code Image */}
        {dataUrl && !error ? (
          <img 
            src={dataUrl} 
            alt={`Security QR Code for ${memberCode}`}
            className="w-full h-full object-contain block rounded-sm"
          />
        ) : (
          /* Fallback pattern while generating or in case of error */
          <div className="w-full h-full flex items-center justify-center bg-emerald-50 rounded text-emerald-800 text-[9px] font-mono font-bold">
            QR...
          </div>
        )}

        {/* Center Micro-Emblem Monogram (Authentic High-Security look) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#064e3b] to-[#047857] border border-amber-400 flex items-center justify-center shadow-xs">
            <span className="text-[6px] font-black text-[#fef08a] tracking-tighter">
              RS
            </span>
          </div>
        </div>
      </div>

      {showLabel && (
        <div className="flex items-center space-x-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          <span className="text-[7.5px] font-mono font-extrabold text-[#064e3b] tracking-wider uppercase">
            SCAN TO VERIFY
          </span>
        </div>
      )}
    </div>
  );
};
