import { Suspense } from "react";
import SearchClient from "./SearchClient";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-et-section" />}>
      <SearchClient />
    </Suspense>
  );
}
