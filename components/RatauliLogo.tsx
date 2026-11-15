import React, { useId } from 'react';

interface RatauliLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
}

export const RatauliOfficialEmblem: React.FC<{ 
  className?: string; 
  size?: number | string;
  withoutCircle?: boolean;
}> = ({ 
  className = "w-full h-full", 
  size,
  withoutCircle = false
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '_');
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id={`emblemBg_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ecfdf5" />
        </linearGradient>

        <linearGradient id={`greenRim_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="45%" stopColor="#065f46" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>

        <linearGradient id={`goldAccent_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        <linearGradient id={`kalashGold_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="30%" stopColor="#fbbf24" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        <linearGradient id={`sunGradient_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>

        {/* Text Paths for circular Devanagari text */}
        <path
          id={`topTextPath_${uid}`}
          d="M 27 100 A 73 73 0 0 1 173 100"
          fill="none"
        />
        <path
          id={`bottomTextPath_${uid}`}
          d="M 173 100 A 73 73 0 0 1 27 100"
          fill="none"
        />
      </defs>

      {!withoutCircle && (
        <g>
          {/* 1. Deepest outer base rim */}
          <circle cx="100" cy="100" r="98" fill="#064e3b" />

          {/* 2. Outer decorative gold ring with beaded dots */}
          <circle cx="100" cy="100" r="94" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
          
          {/* Decorative beaded ring */}
          <circle cx="100" cy="100" r="92" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2 3.5" />

          {/* 3. Official Deep Emerald Circular Band */}
          <circle cx="100" cy="100" r="88" fill={`url(#greenRim_${uid})`} />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#f59e0b" strokeWidth="1" />

          {/* 4. Inner White Shield Area */}
          <circle cx="100" cy="100" r="61" fill={`url(#emblemBg_${uid})`} stroke="#f59e0b" strokeWidth="2.5" />
          <circle cx="100" cy="100" r="57" fill="none" stroke="#10b981" strokeWidth="1.2" strokeDasharray="2.5 2.5" />

          {/* Top Text: रतौली बचत तथा ऋण सहकारी संस्था लि. */}
          <text
            fill="#ffffff"
            fontSize="11.5"
            fontWeight="900"
            letterSpacing="0.8"
            textAnchor="middle"
            filter="drop-shadow(0 1px 1px rgba(0,0,0,0.4))"
            style={{ fontFamily: "'Mukta', sans-serif" }}
          >
            <textPath href={`#topTextPath_${uid}`} startOffset="50%">
              रतौली बचत तथा ऋण सहकारी संस्था लि.
            </textPath>
          </text>

          {/* Bottom Text: ★ पिपरा-६, महोत्तरी • स्था: २०६२ ★ */}
          <text
            fill="#fef08a"
            fontSize="10"
            fontWeight="900"
            letterSpacing="0.9"
            textAnchor="middle"
            filter="drop-shadow(0 1px 1px rgba(0,0,0,0.5))"
            style={{ fontFamily: "'Mukta', sans-serif" }}
          >
            <textPath href={`#bottomTextPath_${uid}`} startOffset="50%">
              ★ पिपरा-६, महोत्तरी • स्था: २०६२ ★
            </textPath>
          </text>
        </g>
      )}

      {/* Center Sacred Emblem Group */}
      <g transform={withoutCircle ? "translate(100, 106) scale(1.85)" : "translate(100, 100)"}>
        {/* Radiant Sun / Rising Prosperity behind Kalash */}
        <circle cx="0" cy="-21" r="16" fill={`url(#sunGradient_${uid})`} opacity="0.8" />
        <g stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
          <line x1="0" y1="-39" x2="0" y2="-34" />
          <line x1="12" y1="-33" x2="9" y2="-30" />
          <line x1="-12" y1="-33" x2="-9" y2="-30" />
          <line x1="15" y1="-21" x2="11" y2="-21" />
          <line x1="-15" y1="-21" x2="-11" y2="-21" />
        </g>

        {/* Decorative Golden Paddy / Wheat Sheaves on Left & Right */}
        {/* Left Stalk */}
        <path
          d="M -44 11 C -48 -14, -36 -34, -20 -44 C -22 -35, -31 -14, -34 11 Z"
          fill="#059669"
          opacity="0.9"
        />
        <circle cx="-32" cy="-24" r="3" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="-25" cy="-34" r="2.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="-38" cy="-12" r="3.2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="-19" cy="-42" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />

        {/* Right Stalk */}
        <path
          d="M 44 11 C 48 -14, 36 -34, 20 -44 C 22 -35, 31 -14, 34 11 Z"
          fill="#059669"
          opacity="0.9"
        />
        <circle cx="32" cy="-24" r="3" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="25" cy="-34" r="2.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="38" cy="-12" r="3.2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <circle cx="19" cy="-42" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />

        {/* Sacred Mango Leaves (आमको पल्लव) */}
        <path d="M 0 -22 C -8 -33, -18 -31, -14 -20 Z" fill="#047857" />
        <path d="M 0 -22 C 8 -33, 18 -31, 14 -20 Z" fill="#047857" />
        <path d="M 0 -22 C -4 -39, 4 -39, 0 -22 Z" fill="#10b981" />
        <line x1="0" y1="-23" x2="0" y2="-37" stroke="#065f46" strokeWidth="0.7" />

        {/* Auspicious Coconut (श्रीफल / नारियल) */}
        <ellipse cx="0" cy="-22" rx="9" ry="10" fill="#78350f" stroke="#451a03" strokeWidth="1" />
        <path d="M -5 -25 Q 0 -30 5 -25" stroke="#451a03" strokeWidth="1.2" fill="none" />
        {/* Sacred Tilak on Coconut */}
        <ellipse cx="0" cy="-23" rx="1.8" ry="3" fill="#dc2626" />
        <circle cx="0" cy="-23" r="0.8" fill="#fef08a" />

        {/* Kalash Top Rim */}
        <ellipse cx="0" cy="-12" rx="14" ry="4" fill={`url(#goldAccent_${uid})`} stroke="#78350f" strokeWidth="1" />

        {/* Kalash Body (घड़ा / पवित्र कलश) */}
        <path
          d="M -13 -12 C -11 -8, -18 2, -18 10 C -18 18, -10 24, 0 24 C 10 24, 18 18, 18 10 C 18 2, 11 -8, 13 -12 Z"
          fill={`url(#kalashGold_${uid})`}
          stroke="#78350f"
          strokeWidth="1.5"
        />

        {/* Auspicious Swastika / Flower Motif on Kalash */}
        <circle cx="0" cy="8" r="7" fill="#dc2626" />
        <circle cx="0" cy="8" r="4.8" fill="#fef08a" />
        <circle cx="0" cy="8" r="2.2" fill="#dc2626" />

        {/* Kalash Base Pedestal */}
        <path
          d="M -10 23 L -12 28 C -12 29, 12 29, 12 28 L 10 23 Z"
          fill={`url(#goldAccent_${uid})`}
          stroke="#78350f"
          strokeWidth="1"
        />

        {/* Two Supporting Cooperative Hands Below (Cradling the Kalash) */}
        {/* Left Hand */}
        <path
          d="M -32 28 C -22 25, -14 30, -4 34 C -12 37, -22 36, -30 31 Z"
          fill="#fef08a"
          stroke="#064e3b"
          strokeWidth="1.3"
        />
        {/* Right Hand */}
        <path
          d="M 32 28 C 22 25, 14 30, 4 34 C 12 37, 22 36, 30 31 Z"
          fill="#fef08a"
          stroke="#064e3b"
          strokeWidth="1.3"
        />

        {/* Cooperative Community Arc underneath */}
        <path
          d="M -24 38 C -12 44, 12 44, 24 38"
          stroke="#047857"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
};

export const RatauliLogo: React.FC<RatauliLogoProps> = ({ 
  className = "w-16 h-16", 
  size, 
  showText = false 
}) => {
  return (
    <div className={`flex items-center gap-3 ${showText ? '' : 'justify-center'}`}>
      <div className={`shrink-0 overflow-hidden ${className}`}>
        <RatauliOfficialEmblem size={size} withoutCircle={false} />
      </div>
      {showText && (
        <div className="text-left leading-tight">
          <h2 className="text-sm font-extrabold text-[#047857] tracking-tight font-['Mukta',sans-serif]">
            रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
          </h2>
          <p className="text-[11px] font-extrabold text-[#dc2626] font-['Poppins',sans-serif]">
            Ratauli Saving & Credit Co-operative Limited
          </p>
        </div>
      )}
    </div>
  );
};
