"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function SlideOver({ open, onClose, title, children, footer }: SlideOverProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-paper shadow-soft"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          >
            <header className="flex items-center justify-between border-b border-mist px-6 py-4">
              <h2 className="font-display text-xl">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full border border-mist px-3 py-1 text-xs uppercase tracking-[0.25em]"
              >
                Close
              </button>
            </header>
            <div className="h-[calc(100%-6.5rem)] overflow-y-auto px-6 py-6">
              {children}
            </div>
            {footer ? (
              <footer className="border-t border-mist px-6 py-4">{footer}</footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
