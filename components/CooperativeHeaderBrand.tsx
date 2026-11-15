import React from 'react';

interface CooperativeHeaderBrandProps {
  className?: string;
  showAddress?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'cert';
  addressClassName?: string;
}

const NEPALI_WORDS = ['रतौली', 'बचत', 'तथा', 'ऋण', 'सहकारी', 'संस्था', 'लिमिटेड'];
const ENGLISH_WORDS = ['RATAULI', 'SAVING', '&', 'CREDIT', 'CO-OPERATIVE', 'LIMITED'];

export const CooperativeHeaderBrand: React.FC<CooperativeHeaderBrandProps> = ({
  className = '',
  showAddress = true,
  size = '2xl',
  addressClassName
}) => {
  const is2xl = size === '2xl' || size === 'cert';
  const isXl = size === 'xl';
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  // Sizing tailored so both Nepali and English lines are exactly uniform ("ek nash ko") edge-to-edge
  const config = is2xl ? {
    maxWidth: 'max-w-[600px] sm:max-w-[620px]',
    nepaliSize: 'text-2xl sm:text-[27px] md:text-[28.5px]',
    englishSize: 'text-base sm:text-[18px] md:text-[19px]',
    gap: 'space-y-1',
    addressSize: 'text-xs sm:text-sm text-slate-800 font-bold mt-1.5'
  } : isXl ? {
    maxWidth: 'max-w-[540px] sm:max-w-[560px]',
    nepaliSize: 'text-xl sm:text-2xl md:text-[25px]',
    englishSize: 'text-sm sm:text-base md:text-[17px]',
    gap: 'space-y-0.5',
    addressSize: 'text-xs sm:text-sm text-slate-700 font-semibold mt-1'
  } : isLg ? {
    maxWidth: 'max-w-[460px] sm:max-w-[480px]',
    nepaliSize: 'text-lg sm:text-xl md:text-[22px]',
    englishSize: 'text-xs sm:text-sm md:text-[15px]',
    gap: 'space-y-0.5',
    addressSize: 'text-[11px] sm:text-xs text-slate-700 font-medium mt-0.5'
  } : isSm ? {
    maxWidth: 'max-w-[320px]',
    nepaliSize: 'text-sm sm:text-base',
    englishSize: 'text-[10.5px] sm:text-xs',
    gap: 'space-y-0.5',
    addressSize: 'text-[9.5px] text-slate-600 mt-0.5'
  } : {
    // Default 'md'
    maxWidth: 'max-w-[420px] sm:max-w-[440px]',
    nepaliSize: 'text-base sm:text-lg md:text-[20px]',
    englishSize: 'text-xs sm:text-[13.5px]',
    gap: 'space-y-0.5',
    addressSize: 'text-[11px] text-slate-600 font-medium mt-0.5'
  };

  const finalAddressClassName = addressClassName || config.addressSize;

  return (
    <div className={`text-center flex flex-col items-center justify-center ${className}`}>
      {/* Container ensures both lines start and end at the exact same edge ("ek nash ko chaudaie") */}
      <div className={`w-full ${config.maxWidth} px-0.5 select-none flex flex-col items-center justify-center ${config.gap}`}>
        {/* Line 1: Green Nepali Text - Perfectly justified across full width */}
        <div 
          className={`w-full flex justify-between items-baseline ${config.nepaliSize} font-black text-[#047857] leading-tight select-none drop-shadow-2xs`}
          style={{
            fontFamily: "'Mukta', 'Noto Sans Devanagari', sans-serif"
          }}
        >
          {NEPALI_WORDS.map((word, i) => (
            <span key={i} className="whitespace-nowrap">{word}</span>
          ))}
        </div>

        {/* Line 2: Bold Red English Text - Perfectly justified across full width, aligning with Line 1 */}
        <div 
          className={`w-full flex justify-between items-baseline ${config.englishSize} font-black text-[#dc2626] leading-tight uppercase select-none drop-shadow-2xs`}
          style={{
            fontFamily: "'Poppins', system-ui, sans-serif"
          }}
        >
          {ENGLISH_WORDS.map((word, i) => (
            <span key={i} className="whitespace-nowrap">{word}</span>
          ))}
        </div>
      </div>

      {showAddress && (
        <p className={`${finalAddressClassName} tracking-wide font-sans text-center`}>
          पिपरा गाउँपालिका -६, रतौली, महोत्तरी
        </p>
      )}
    </div>
  );
};
