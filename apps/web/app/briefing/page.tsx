import { Suspense } from "react";
import BriefingClient from "./BriefingClient";

export default function BriefingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <BriefingClient />
    </Suspense>
  );
}
