import React from 'react';
import { X, Printer, ChevronRight } from 'lucide-react';

interface FDPrintCertificateProps {
  data: any;
  settings: any;
  currentLogo: string | null;
  terms: Array<{ np?: string; text?: string; en?: string; title?: string }>;
  isSixYear: boolean;
  onBack: () => void;
  onClose: () => void;
}

const nepaliToEnglishNumber = (str: string): string => {
  const map: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  return (str || '').replace(/[०-९]/g, (d) => map[d]);
};

const englishToNepaliNumber = (val: string | number): string => {
  if (val === undefined || val === null || val === '') return '';
  const map: Record<string, string> = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९', '.': '.'
  };
  return val.toString().replace(/[0-9.]/g, (d) => map[d] || d);
};

const NEP_DIGITS = [
  "शून्य", "एक", "दुई", "तीन", "चार", "पाँच", "छ", "सात", "आठ", "नौ", "दश",
  "एघार", "बाह्र", "तेह्र", "चौध", "पन्ध्र", "सोह्र", "सत्र", "अठार", "उन्नाइस", "बीस",
  "एक्काइस", "बाइस", "तेइस", "चौबिस", "पच्चिस", "छब्बीस", "सत्ताइस", "अठ्ठाइस", "उनन्तीस", "तीस",
  "एकतीस", "बत्तीस", "तेत्तीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अठतीस", "उनन्चालीस", "चालीस",
  "एकचालीस", "बयालीस", "त्रिचालीस", "चवालीस", "पैंतालीस", "छयालीस", "सत्तालीस", "अठचालीस", "उनन्चास", "पचास",
  "एकाउन्न", "बाउन्न", "त्रिपन्न", "चौपन्न", "पचपन्न", "छपन्न", "सन्ताउन्न", "अन्ठाउन्न", "उनन्साठ्ठी", "साठ्ठी",
  "एकसठ्ठी", "बासठ्ठी", "त्रिसठ्ठी", "चौसठ्ठी", "पैंसठ्ठी", "छैसठ्ठी", "सत्सठ्ठी", "अठसठ्ठी", "उनन्सत्तरी", "सत्तरी",
  "एकहत्तर", "बहत्तर", "त्रिहत्तर", "चौहत्तर", "पचहत्तर", "छहत्तर", "सतहत्तर", "अठहत्तर", "उनन्असी", "असी",
  "एकासी", "बयासी", "त्रियासी", "चौरासी", "पचासी", "छयासी", "सत्तासी", "अठासी", "उनन्नब्बे", "नब्बे",
  "एकानब्बे", "बयानब्बे", "त्रियानब्बे", "चौरानब्बे", "पञ्चानब्बे", "छ्यानब्बे", "सन्तानब्बे", "अन्ठानब्बे", "उनन्सय"
];

const numberToNepaliWords = (n: number): string => {
  if (isNaN(n) || n === 0) return "शून्य रुपैयाँ मात्र ।";
  
  const isNegative = n < 0;
  const absN = Math.abs(n);
  const rupees = Math.floor(absN);
  const paisa = Math.round((absN - rupees) * 100);

  const convertTwoDigits = (num: number): string => {
    if (num <= 0) return "";
    if (num < 100) return NEP_DIGITS[num] || num.toString();
    return num.toString();
  };

  const convertThreeDigits = (num: number): string => {
    let text = "";
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    if (hundred > 0) {
      text += NEP_DIGITS[hundred] + " सय ";
    }
    if (rest > 0) {
      text += convertTwoDigits(rest) + " ";
    }
    return text.trim();
  };

  let words = "";
  if (rupees === 0) {
    words = "शून्य";
  } else {
    let rem = rupees;

    const crore = Math.floor(rem / 10000000);
    rem = rem % 10000000;

    const lakh = Math.floor(rem / 100000);
    rem = rem % 100000;

    const thousand = Math.floor(rem / 1000);
    rem = rem % 1000;

    const hundredAndRest = rem;

    if (crore > 0) {
      words += (crore < 100 ? NEP_DIGITS[crore] : crore.toString()) + " करोड ";
    }
    if (lakh > 0) {
      words += NEP_DIGITS[lakh] + " लाख ";
    }
    if (thousand > 0) {
      words += NEP_DIGITS[thousand] + " हजार ";
    }
    if (hundredAndRest > 0) {
      words += convertThreeDigits(hundredAndRest) + " ";
    }
  }

  let finalStr = words.trim() + " रुपैयाँ";

  if (paisa > 0 && paisa < 100) {
    finalStr += " " + NEP_DIGITS[paisa] + " पैसा";
  }

  finalStr += " मात्र ।";
  if (isNegative) finalStr = "ऋण " + finalStr;
  return finalStr;
};

export const FDPrintCertificate: React.FC<FDPrintCertificateProps> = ({
  data,
  settings,
  currentLogo,
  terms,
  isSixYear,
  onBack,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[7000] overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible fd-cert-print-modal fd-cert-scope">
      {/* Certificate Style Isolation */}
      <style>{`
        .fd-cert-scope {
          --emerald-deep: #0B4F3F;
          --emerald: #146B52;
          --emerald-light: #DCEBE4;
          --bronze: #B8865B;
          --paper: #FFFFFF;
          --panel: #F6F5F1;
          --charcoal: #0A0C0A;
          --muted: #3A3F3A;
          --line: #E3E1D8;
          --np-teal: #4FAE93;
          --en-coral: #E8735C;
        }
        .fd-cert-scope * {
          box-sizing: border-box;
        }
        .fd-cert-scope .sheet {
          width: 1200px;
          max-width: 100%;
          background: var(--paper);
          box-shadow: 0 16px 44px rgba(20,30,25,0.22);
          font-family: 'Libre Franklin', sans-serif;
          color: var(--charcoal);
          margin: 0 auto;
        }

        /* ===== TOP STRIP ===== */
        .fd-cert-scope .top-strip {
          display: flex;
          justify-content: space-between;
          padding: 12px 44px;
          font-size: 13px;
          color: var(--muted);
        }
        .fd-cert-scope .top-strip .np { font-family: 'Mukta', sans-serif; }
        .fd-cert-scope .top-strip b { color: var(--charcoal); font-weight: 700; }
        .fd-cert-scope .top-strip span {
          display: inline-block;
          min-width: 120px;
          border-bottom: 1px dotted var(--muted);
          padding: 0 4px 1px;
          color: var(--charcoal);
          font-weight: 600;
        }

        .fd-cert-scope .body-pad {
          padding: 36px 56px 40px;
        }

        /* ===== HEADER ===== */
        .fd-cert-scope .header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-bottom: 18px;
          width: 100%;
        }
        .fd-cert-scope .header-brand-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          width: 100%;
        }
        .fd-cert-scope .mark {
          width: 88px;
          height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: transparent;
        }
        .fd-cert-scope .mark-spacer {
          width: 88px;
          height: 88px;
          flex-shrink: 0;
        }
        .fd-cert-scope .mark-text {
          font-family: 'Mukta', sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: var(--np-teal);
          letter-spacing: .5px;
          text-align: center;
        }
        .fd-cert-scope .co-block { 
          text-align: center;
          flex-grow: 1;
          padding: 0;
        }
        .fd-cert-scope .co-name-np {
          display: block;
          text-align: center;
          font-family: 'Mukta', sans-serif;
          font-weight: 800;
          font-size: 38px;
          color: var(--np-teal);
          letter-spacing: .4px;
          white-space: nowrap;
          line-height: 1.2;
        }
        .fd-cert-scope .co-name-en {
          display: block;
          text-align: center;
          font-style: italic;
          font-weight: 700;
          font-size: 26px;
          color: var(--en-coral);
          letter-spacing: .6px;
          white-space: nowrap;
          margin-top: 4px;
          line-height: 1.2;
        }
        .fd-cert-scope .co-address {
          margin-top: 8px;
          font-family: 'Mukta', sans-serif;
          font-size: 15px;
          color: var(--muted);
          font-weight: 600;
          line-height: 1.4;
        }
        .fd-cert-scope .co-email {
          margin-top: 2px;
          font-size: 13.5px;
          color: var(--muted);
        }

        /* ===== TITLE ===== */
        .fd-cert-scope .title-band {
          text-align: center;
          padding: 18px 10px 20px;
          margin-bottom: 24px;
          background: linear-gradient(180deg, var(--emerald-light) 0%, rgba(220,235,228,0) 100%);
          border-top: 1px solid var(--bronze);
          border-bottom: 1px solid var(--bronze);
          position: relative;
        }
        .fd-cert-scope .title-ornament {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .fd-cert-scope .title-ornament .diamond {
          width: 7px;
          height: 7px;
          background: var(--bronze);
          transform: rotate(45deg);
          flex-shrink: 0;
        }
        .fd-cert-scope .title-en {
          font-weight: 700;
          font-size: 21px;
          letter-spacing: 3.5px;
          text-transform: uppercase;
          color: var(--emerald-deep);
          margin: 0;
        }
        .fd-cert-scope .title-rule {
          width: 46px;
          height: 2px;
          background: var(--bronze);
          margin: 8px auto;
        }
        .fd-cert-scope .title-np {
          font-family: 'Mukta', sans-serif;
          font-weight: 700;
          font-size: 17px;
          color: var(--emerald-deep);
          margin: 0;
          display: inline-block;
          padding: 4px 24px;
          border: 1px solid var(--emerald-deep);
          border-radius: 16px;
          background: var(--paper);
        }
        .fd-cert-scope .branch-line {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .fd-cert-scope .branch-line .lbl { text-align: left; line-height: 1.3; }
        .fd-cert-scope .branch-line .lbl .en { display: block; font-weight: 600; color: var(--charcoal); font-size: 12px; }
        .fd-cert-scope .branch-line .lbl .np { display: block; font-family: 'Mukta', sans-serif; font-size: 12px; font-weight: 600; }
        .fd-cert-scope .branch-line .colon { font-weight: 700; color: var(--muted); margin-right: 2px; }
        .fd-cert-scope .branch-line .blank {
          display: inline-block;
          min-width: 220px;
          border-bottom: 1px dotted var(--muted);
          padding: 0 8px 1px 4px;
          color: var(--charcoal);
          font-weight: 700;
          text-align: left;
        }

        /* ===== INTRO ===== */
        .fd-cert-scope .intro {
          font-size: 13.5px;
          line-height: 1.7;
          color: var(--charcoal);
          text-align: center;
          max-width: 880px;
          margin: 0 auto 24px;
        }
        .fd-cert-scope .intro .np {
          display: block;
          font-family: 'Mukta', sans-serif;
          font-size: 13.5px;
          margin-top: 2px;
        }

        /* ===== DETAILS (zebra rows & aligned colons) ===== */
        .fd-cert-scope .details {
          border-top: 1px solid var(--line);
          margin-bottom: 26px;
        }
        .fd-cert-scope .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .fd-cert-scope .row:nth-child(even) { background: var(--panel); }
        .fd-cert-scope .field {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          border-bottom: 1px solid var(--line);
          flex-wrap: nowrap;
        }
        .fd-cert-scope .row .field:first-child { border-right: 1px solid var(--line); }
        .fd-cert-scope .field .label { 
          width: 145px;
          min-width: 145px;
          font-size: 12.5px; 
          color: var(--muted); 
          flex-shrink: 0; 
          line-height: 1.3;
        }
        .fd-cert-scope .field .label .en { font-weight: 600; color: var(--charcoal); display: block; }
        .fd-cert-scope .field .label .np {
          display: block;
          font-family: 'Mukta', sans-serif;
          font-weight: 600;
          font-size: 11.5px;
          color: var(--muted);
          margin-top: 1px;
        }
        .fd-cert-scope .field .colon {
          width: 12px;
          min-width: 12px;
          font-weight: 700;
          font-size: 13px;
          color: var(--muted);
          flex-shrink: 0;
          text-align: center;
        }
        .fd-cert-scope .field .val-container {
          flex: 1;
          display: flex;
          align-items: baseline;
          gap: 6px;
          border-bottom: 1px dotted var(--line);
          min-height: 20px;
          padding-bottom: 2px;
          text-align: left;
        }
        .fd-cert-scope .field .unit {
          font-size: 13.5px;
          color: var(--charcoal);
          flex-shrink: 0;
          font-weight: 600;
          white-space: nowrap;
        }
        .fd-cert-scope .field .blank {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: var(--charcoal);
          text-align: left;
        }
        .fd-cert-scope .field.stacked-val {
          align-items: flex-start;
          padding-top: 10px;
          padding-bottom: 10px;
        }
        .fd-cert-scope .field.stacked-val .colon {
          margin-top: 1px;
        }
        .fd-cert-scope .field.stacked-val .val-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          border-bottom: 1px dotted var(--line);
          padding-bottom: 3px;
        }
        .fd-cert-scope .field.stacked-val .amount-row {
          display: flex;
          align-items: baseline;
          gap: 5px;
          width: 100%;
        }
        .fd-cert-scope .field.stacked-val .amount-words {
          font-family: 'Mukta', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--charcoal);
          line-height: 1.35;
          text-align: left;
          width: 100%;
          margin-top: 2px;
        }
        .fd-cert-scope .field.stacked-val .amount-words .np-word {
          display: block;
        }
        .fd-cert-scope .row.highlight .field.stacked-val .amount-words {
          font-size: 15px;
          font-weight: 700;
          color: var(--emerald-deep);
          line-height: 1.35;
        }
        .fd-cert-scope .row.full .field { border-right: none; }
        .fd-cert-scope .row.highlight {
          background: var(--paper);
          border-top: 2px solid var(--emerald-deep);
          border-bottom: 2px solid var(--emerald-deep);
        }
        .fd-cert-scope .row.highlight .field { border-bottom: none; padding: 13px 18px; }
        .fd-cert-scope .row.highlight .label .en { color: var(--emerald-deep); font-size: 13.5px; }
        .fd-cert-scope .row.highlight .label .np { color: var(--emerald-deep); font-size: 12px; }
        .fd-cert-scope .row.highlight .colon { color: var(--emerald-deep); }
        .fd-cert-scope .row.highlight .unit { color: var(--emerald-deep); font-weight: 700; font-size: 16px; }
        .fd-cert-scope .row.highlight .val-container { border-bottom: 1px dotted var(--emerald-deep); }
        .fd-cert-scope .row.highlight .blank { color: var(--emerald-deep); font-weight: 700; font-size: 16px; text-align: left; }

        /* ===== TERMS ===== */
        .fd-cert-scope .terms { margin-top: 6px; }
        .fd-cert-scope .terms-title {
          font-weight: 700;
          font-size: 13.5px;
          color: var(--emerald-deep);
          text-transform: uppercase;
          letter-spacing: 1.4px;
          margin: 0 0 2px;
        }
        .fd-cert-scope .terms-title-np {
          font-family: 'Mukta', sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: var(--emerald-deep);
          margin: 0 0 12px;
        }
        .fd-cert-scope .terms ol {
          margin: 0;
          padding-left: 0;
          columns: 2;
          column-gap: 36px;
          list-style: none;
          counter-reset: term;
        }
        .fd-cert-scope .terms li {
          counter-increment: term;
          font-family: 'Mukta', sans-serif;
          font-size: 11.8px;
          line-height: 1.6;
          color: var(--charcoal);
          margin-bottom: 10px;
          break-inside: avoid;
          padding-left: 18px;
          position: relative;
        }
        .fd-cert-scope .terms li::before {
          content: counter(term) ".";
          position: absolute;
          left: 0;
          top: 0;
          color: var(--bronze);
          font-family: 'Libre Franklin', sans-serif;
          font-weight: 700;
          font-size: 11.5px;
        }
        .fd-cert-scope .terms li .en {
          display: block;
          font-family: 'Libre Franklin', sans-serif;
          font-style: italic;
          font-size: 10.6px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* ===== FOOTER ===== */
        .fd-cert-scope .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 36px;
          padding: 0 40px;
        }
        .fd-cert-scope .sign { text-align: center; width: 220px; }
        .fd-cert-scope .sign .line {
          border-bottom: 1px solid var(--charcoal);
          height: 36px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--charcoal);
          padding-bottom: 2px;
        }
        .fd-cert-scope .sign .cap { margin-top: 6px; font-size: 12.5px; color: var(--charcoal); font-weight: 600; }
        .fd-cert-scope .sign .cap .np {
          display: block;
          font-family: 'Mukta', sans-serif;
          font-size: 12px;
          color: var(--muted);
        }
        .fd-cert-scope .seal-box {
          width: 180px;
          height: 80px;
          border: none;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          text-align: center;
          padding-bottom: 6px;
          flex-shrink: 0;
        }
        .fd-cert-scope .seal-box-text {
          font-size: 12px;
          letter-spacing: 1px;
          line-height: 1.5;
          font-weight: 700;
          color: var(--muted);
        }
        .fd-cert-scope .seal-box-text .np {
          display: block;
          font-family: 'Mukta', sans-serif;
          font-size: 12px;
          font-weight: 600;
        }

        @media print {
          body {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body > #root > div > main,
          body > #root > div > div > aside,
          .no-print,
          [no-print] {
            display: none !important;
          }
          .fd-cert-print-modal {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .fd-cert-scope .sheet {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            margin: 0 !important;
          }
          .fd-cert-scope .row.highlight,
          .fd-cert-scope .top-strip {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .fd-cert-scope .top-strip {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            justify-content: space-between !important;
            width: 100% !important;
            padding: 5px 22px !important;
            font-size: 9.5px !important;
          }
          .fd-cert-scope .top-strip > div { white-space: nowrap; flex-shrink: 0; }
          .fd-cert-scope .top-strip span { min-width: 90px !important; }

          .fd-cert-scope .body-pad { padding: 12px 22px 14px !important; }

          .fd-cert-scope .header {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding-bottom: 8px !important;
            width: 100% !important;
          }
          .fd-cert-scope .header-brand-row {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .fd-cert-scope .mark { 
            position: static !important;
            transform: none !important;
            width: 58px !important; 
            height: 58px !important; 
            flex-shrink: 0 !important;
            border: none !important; 
          }
          .fd-cert-scope .mark-spacer {
            width: 58px !important;
            height: 58px !important;
            flex-shrink: 0 !important;
          }
          .fd-cert-scope .mark-text { font-size: 8px !important; }
          .fd-cert-scope .co-block {
            width: auto !important;
            flex-grow: 1 !important;
            text-align: center !important;
            padding: 0 !important;
          }
          .fd-cert-scope .co-name-np { font-size: 24px !important; font-weight: 800 !important; white-space: nowrap !important; }
          .fd-cert-scope .co-name-en { font-size: 16px !important; font-weight: 700 !important; margin-top: 2px !important; white-space: nowrap !important; }
          .fd-cert-scope .co-address { font-size: 10px !important; margin-top: 3px !important; }
          .fd-cert-scope .co-email { font-size: 9.5px !important; margin-top: 1px !important; }

          .fd-cert-scope .title-band { padding: 8px 8px !important; margin-bottom: 8px !important; }
          .fd-cert-scope .title-en { font-size: 14px !important; letter-spacing: 2px !important; }
          .fd-cert-scope .title-rule { margin: 4px auto !important; width: 34px !important; }
          .fd-cert-scope .title-np { font-size: 11.5px !important; padding: 2px 14px !important; }
          .fd-cert-scope .branch-line { margin-top: 5px !important; font-size: 9.5px !important; }
          .fd-cert-scope .branch-line .blank { min-width: 150px !important; text-align: left !important; padding-left: 4px !important; }

          .fd-cert-scope .intro { font-size: 9px !important; line-height: 1.35 !important; margin-bottom: 8px !important; max-width: 100% !important; }
          .fd-cert-scope .intro .np { font-size: 9px !important; margin-top: 1px !important; }

          .fd-cert-scope .details { margin-bottom: 10px !important; }
          .fd-cert-scope .row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .fd-cert-scope .row:nth-child(even) {
            background: var(--panel) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .fd-cert-scope .field {
            flex-wrap: nowrap !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 5px 12px !important;
            gap: 6px !important;
          }
          .fd-cert-scope .field .label { width: 115px !important; min-width: 115px !important; font-size: 9.5px !important; }
          .fd-cert-scope .field .label .np { font-size: 8.5px !important; margin-top: 0 !important; }
          .fd-cert-scope .field .colon { width: 10px !important; min-width: 10px !important; font-size: 9.5px !important; }
          .fd-cert-scope .field.stacked-val {
            padding: 4px 12px !important;
            align-items: flex-start !important;
          }
          .fd-cert-scope .field.stacked-val .colon {
            margin-top: 0px !important;
          }
          .fd-cert-scope .field.stacked-val .val-container {
            gap: 1px !important;
            padding-bottom: 1px !important;
          }
          .fd-cert-scope .field.stacked-val .amount-words {
            font-size: 9.5px !important;
            line-height: 1.25 !important;
          }
          .fd-cert-scope .row.highlight .field.stacked-val .amount-words {
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          .fd-cert-scope .field .val-container { min-height: 14px !important; padding-bottom: 1px !important; }
          .fd-cert-scope .field .unit { font-size: 9.5px !important; }
          .fd-cert-scope .field .blank { font-size: 9.5px !important; }
          .fd-cert-scope .row.highlight .label .en { font-size: 10.5px !important; }
          .fd-cert-scope .row.highlight .label .np { font-size: 9px !important; }
          .fd-cert-scope .row.highlight .unit { font-size: 11.5px !important; }
          .fd-cert-scope .row.highlight .blank { font-size: 11.5px !important; }

          .fd-cert-scope .terms { margin-top: 4px !important; padding: 4px 0 !important; }
          .fd-cert-scope .terms-title { font-size: 10.5px !important; margin-bottom: 1px !important; }
          .fd-cert-scope .terms-title-np { font-size: 9.5px !important; margin-bottom: 5px !important; }
          .fd-cert-scope .terms ol { column-gap: 24px !important; }
          .fd-cert-scope .terms li {
            font-size: 8.5px !important;
            line-height: 1.35 !important;
            margin-bottom: 4px !important;
            padding-left: 14px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .fd-cert-scope .terms li::before { font-size: 7.5px !important; }
          .fd-cert-scope .terms li .en { font-size: 7.5px !important; margin-top: 1px !important; }

          .fd-cert-scope .footer {
            margin-top: 14px !important;
            padding: 0 20px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .fd-cert-scope .sign { width: 160px !important; }
          .fd-cert-scope .sign .line { height: 22px !important; font-size: 9.5px !important; }
          .fd-cert-scope .sign .cap { margin-top: 3px !important; font-size: 9px !important; }
          .fd-cert-scope .sign .cap .np { font-size: 8.5px !important; }
          .fd-cert-scope .seal-box { width: 140px !important; height: 50px !important; border: none !important; padding-bottom: 3px !important; }
          .fd-cert-scope .seal-box-text { font-size: 8.5px !important; }
          .fd-cert-scope .seal-box-text .np { font-size: 8.5px !important; }

          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
        }

        @media (max-width: 760px) {
          .fd-cert-scope .body-pad { padding: 24px 20px; }
          .fd-cert-scope .row { grid-template-columns: 1fr; }
          .fd-cert-scope .row .field:first-child { border-right: none; border-bottom: 1px solid var(--line); }
          .fd-cert-scope .terms ol { columns: 1; }
          .fd-cert-scope .top-strip { flex-direction: column; gap: 4px; text-align: center; padding: 12px 20px; }
          .fd-cert-scope .header { flex-direction: column; text-align: center; }
          .fd-cert-scope .co-name-np,
          .fd-cert-scope .co-name-en { white-space: normal; }
        }
      `}</style>

      {/* Top Control Bar for Screen Preview */}
      <div className="p-3 border-b flex justify-between items-center no-print bg-slate-800 text-white sticky top-0 z-50 shadow-xl">
         <div className="flex items-center space-x-3">
            <button onClick={onBack} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer">
               <ChevronRight size={14} className="rotate-180" />
               <span>Back to Editor</span>
            </button>
            <button onClick={() => window.print()} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center space-x-2 hover:bg-emerald-500 shadow-lg transition-all cursor-pointer">
               <Printer size={14} />
               <span>Execute Print (A4 Portrait)</span>
            </button>
         </div>
         <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-all cursor-pointer"><X size={22}/></button>
      </div>

      {/* Canvas Preview */}
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center print:p-0 print:m-0">
        <div className="sheet">

          {/* TOP STRIP */}
          <div className="top-strip">
            <div>
              <b>Reg. No.</b> : <span>{settings?.registrationNo && settings.registrationNo !== "४२/०५१/०५२" ? settings.registrationNo : "1140/069/70"}</span>
            </div>
            <div>
              <b>PAN</b> : <span>{settings?.panNo || "305681610"}</span>
            </div>
          </div>

          <div className="body-pad">

            {/* HEADER */}
            <div className="header">
              <div className="header-brand-row">
                <div className="mark">
                  {currentLogo ? (
                    <img src={currentLogo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="mark-text">LOGO</span>
                  )}
                </div>
                <div className="co-block">
                  <p className="co-name-np">{settings?.organizationNameNp || "रतौली बचत तथा ऋण सहकारी संस्था लि."}</p>
                  <p className="co-name-en">{settings?.organizationName || "Ratauli Saving and Credit Co-operative Ltd."}</p>
                  <div className="co-address">
                    {settings?.addressNp || "रतौली, पिपरा, महोत्तरी, मधेश प्रदेश, नेपाल"}
                  </div>
                  <div className="co-email">Email: {settings?.email || "info@rataulisaccos.com.np"}</div>
                </div>
                <div className="mark-spacer" aria-hidden="true" />
              </div>
            </div>

            {/* TITLE */}
            <div className="title-band">
              <div className="title-ornament">
                <span className="diamond"></span>
                <p className="title-en">Fixed Deposit Certificate</p>
                <span className="diamond"></span>
              </div>
              <div className="title-rule"></div>
              <p className="title-np">मुद्दती निक्षेप प्रमाणपत्र</p>
              <div className="branch-line">
                <span className="lbl"><span className="en">Branch</span><span className="np">शाखा</span></span>
                <span className="colon">:</span>
                <span className="blank">{data.selectedBranch || "मुख्य शाखा"}</span>
              </div>
            </div>

            {/* INTRO */}
            <p className="intro">
              This is to certify that the fixed deposit particulars mentioned below have been recorded in the books of the institution.
              <span className="np">यसद्वारा प्रमाणित गरिन्छ कि तलका विवरण अनुसारको रकम यस संस्थामा मुद्दती निक्षेपको रूपमा जम्मा गरिएको छ।</span>
            </p>

            {/* DETAILS */}
            <div className="details">
              <div className="row">
                <div className="field stacked-val">
                  <div className="label"><span className="en">Depositor's Name</span><span className="np">ग्राहकको नाम</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">
                      {data.holderName ? data.holderName.toUpperCase() : (data.holderNameNp || <>&nbsp;</>)}
                    </div>
                    {data.holderNameNp && data.holderName && (
                      <div className="amount-words" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--charcoal)', marginTop: '2px', letterSpacing: '0.2px' }}>
                        {data.holderNameNp}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <div className="label"><span className="en">Account Number</span><span className="np">खाता नम्बर</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{data.accountNo ? englishToNepaliNumber(data.accountNo) : <>&nbsp;</>}</div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <div className="label"><span className="en">Types of Product</span><span className="np">खाताको प्रकार</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{data.accountType || <>&nbsp;</>}</div>
                  </div>
                </div>
                <div className="field">
                  <div className="label"><span className="en">Period</span><span className="np">अवधि</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{data.duration || <>&nbsp;</>}</div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <div className="label"><span className="en">Interest Rate</span><span className="np">ब्याज दर</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{data.interestRate === '२ गुणा' ? '२ गुणा (Double Scheme)' : englishToNepaliNumber(data.interestRate)}</div>
                    <span className="unit">{data.interestRate === '२ गुणा' ? '' : '% per annum'}</span>
                  </div>
                </div>
                <div className="field">
                  <div className="label"><span className="en">Tax Rate</span><span className="np">कर दर</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{englishToNepaliNumber(data.tax || '६')}</div>
                    <span className="unit">%</span>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <div className="label"><span className="en">Deposit / Open Date</span><span className="np">खोलेको मिति</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{englishToNepaliNumber(data.issueDate) || <>&nbsp;</>}</div>
                  </div>
                </div>
                <div className="field">
                  <div className="label"><span className="en">Maturity Date</span><span className="np">परिपक्व मिति</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="blank">{englishToNepaliNumber(data.maturityDate) || <>&nbsp;</>}</div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="field stacked-val">
                  <div className="label"><span className="en">Principal Amount</span><span className="np">साँवा रकम</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="amount-row">
                      <span className="unit">Rs.</span>
                      <div className="blank">
                        {parseFloat(nepaliToEnglishNumber(data.amount || '0')) > 0 ? (
                          `${englishToNepaliNumber(parseFloat(nepaliToEnglishNumber(data.amount || '0')).toLocaleString())}/-`
                        ) : <>&nbsp;</>}
                      </div>
                    </div>
                    {(data.amountInWords || (parseFloat(nepaliToEnglishNumber(data.amount || '0')) > 0)) && (
                      <div className="amount-words">
                        ({data.amountInWords || numberToNepaliWords(parseFloat(nepaliToEnglishNumber(data.amount || '0')))})
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <div className="label"><span className="en">Interest Amount</span><span className="np">ब्याज रकम</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <span className="unit">Rs.</span>
                    <div className="blank">
                      {parseFloat(data.totalInterest || '0') > 0 ? (
                        `${englishToNepaliNumber(parseFloat(data.totalInterest || '0').toLocaleString(undefined, {minimumFractionDigits: 2}))}/-`
                      ) : '०.००/-'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row full">
                <div className="field stacked-val">
                  <div className="label"><span className="en">Tax Amount</span><span className="np">कर रकम</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="amount-row">
                      <span className="unit">Rs.</span>
                      <div className="blank">
                        {parseFloat(data.taxDeduction || '0') > 0 ? (
                          `${englishToNepaliNumber(parseFloat(data.taxDeduction || '0').toLocaleString(undefined, {minimumFractionDigits: 2}))}/-`
                        ) : '०.००/-'}
                      </div>
                    </div>
                    {parseFloat(data.taxDeduction || '0') > 0 && (
                      <div className="amount-words">
                        ({numberToNepaliWords(parseFloat(data.taxDeduction || '0'))})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="row full highlight">
                <div className="field stacked-val">
                  <div className="label"><span className="en">Maturity Amount</span><span className="np">परिपक्व रकम</span></div>
                  <div className="colon">:</div>
                  <div className="val-container">
                    <div className="amount-row">
                      <span className="unit">Rs.</span>
                      <div className="blank">
                        {parseFloat(data.maturityAmount || '0') > 0 ? (
                          `${englishToNepaliNumber(parseFloat(data.maturityAmount || '0').toLocaleString(undefined, {minimumFractionDigits: 2}))}/-`
                        ) : <>&nbsp;</>}
                      </div>
                    </div>
                    {(data.maturityInWords || (parseFloat(data.maturityAmount || '0') > 0)) && (
                      <div className="amount-words">
                        ({data.maturityInWords || numberToNepaliWords(parseFloat(data.maturityAmount || '0'))})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* TERMS */}
            <div className="terms">
              <p className="terms-title">Terms &amp; Conditions</p>
              <p className="terms-title-np">शर्त तथा नियमहरू</p>
              <ol>
                {terms.map((t, idx) => (
                  <li key={idx}>
                    {t.np || t.text}
                    <span className="en">{t.en || t.title}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* FOOTER / SIGNATURES */}
            <div className="footer">
              <div className="seal-box">
                <div className="seal-box-text">Company Seal<span className="np">कम्पनी छाप</span></div>
              </div>

              <div className="sign">
                <div className="line">{data.signatoryName}</div>
                <div className="cap">Authorized Signature<span className="np">अधिकृत हस्ताक्षर</span></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
