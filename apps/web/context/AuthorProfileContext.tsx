"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { SlideOver } from "../components/SlideOver";
import { AuthorProfile } from "../components/AuthorProfile";

interface AuthorProfileContextType {
  openProfile: (authorId: string) => void;
  closeProfile: () => void;
}

const AuthorProfileContext = createContext<AuthorProfileContextType | undefined>(undefined);

export function AuthorProfileProvider({ children }: { children: ReactNode }) {
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);

  const openProfile = (authorId: string) => {
    setActiveAuthorId(authorId);
  };
  const closeProfile = () => setActiveAuthorId(null);

  return (
    <AuthorProfileContext.Provider value={{ openProfile, closeProfile }}>
      {children}
      
      <SlideOver
        open={Boolean(activeAuthorId)}
        onClose={closeProfile}
        title="Author Profile"
        variant="modal"
        isJustified={true}
      >
        {activeAuthorId && <AuthorProfile authorId={activeAuthorId} />}
      </SlideOver>
    </AuthorProfileContext.Provider>
  );
}

export function useAuthorProfile() {
  const context = useContext(AuthorProfileContext);
  if (!context) {
    throw new Error("useAuthorProfile must be used within an AuthorProfileProvider");
  }
  return context;
}
