"use client";

import { motion } from "framer-motion";

export const LANGUAGES = [
  { code: "en", name: "English", label: "EN" },
  { code: "hi", name: "Hindi", label: "हि" },
  { code: "ta", name: "Tamil", label: "த" },
  { code: "te", name: "Telugu", label: "తె" },
  { code: "bn", name: "Bangla", label: "বা" }
];

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
}

export function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-[#F8F8F8] rounded-full border border-[#F0F0F0] shadow-sm">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onLanguageChange(lang.code)}
          className={`relative px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all flex items-center justify-center min-w-[32px] ${
            currentLanguage === lang.code 
              ? "text-white" 
              : "text-[#999999] hover:text-[#000000]"
          }`}
        >
          {currentLanguage === lang.code && (
            <motion.div 
              layoutId="activeLang"
              className="absolute inset-0 bg-[#E21B22] rounded-full"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10">{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
