"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  variant?: "drawer" | "modal";
  isJustified?: boolean;
};

export function SlideOver({ 
  open, 
  onClose, 
  title, 
  children, 
  footer, 
  side = "right",
  variant = "drawer",
  isJustified = false
}: SlideOverProps) {
  const isLeft = side === "left";
  const isModal = variant === "modal";

  // No body overflow lock needed — the panel is position:fixed so it
  // overlays the page without affecting layout. Locking body overflow
  // was causing the scrollbar to disappear and the page to shift right.

  return (

    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={`
              pointer-events-auto
              ${isModal 
                ? "relative w-[95%] max-w-2xl max-h-[90vh] rounded-2xl shadow-soft border border-et-border" 
                : `fixed ${isLeft ? "left-0" : "right-0"} top-0 h-full w-full ${isLeft ? "max-w-xs" : "max-w-2xl"} shadow-soft ${isLeft ? "border-r" : "border-l"} border-et-border`
              } 
              bg-white overflow-hidden flex flex-col
            `}
            initial={isModal ? { opacity: 0, scale: 0.95, y: 20 } : { x: isLeft ? "-100%" : "100%" }}
            animate={isModal ? { opacity: 1, scale: 1, y: 0 } : { x: 0 }}
            exit={isModal ? { opacity: 0, scale: 0.95, y: 20 } : { x: isLeft ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          >
            <header className="flex items-center justify-between border-b border-et-border px-6 py-4 flex-shrink-0">
              <h2 className="font-serif text-xl font-bold truncate pr-4 text-et-headline">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-et-section rounded-full transition-colors flex-shrink-0 text-et-headline"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </header>
            <div className={`flex-1 overflow-y-auto px-6 py-6 ${isJustified ? "text-justify" : ""}`}>
              {children}
            </div>
            {footer ? (
              <footer className="border-t border-et-border px-6 py-4 flex-shrink-0 bg-et-section">{footer}</footer>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

