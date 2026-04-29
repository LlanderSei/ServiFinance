import { useState } from "react";

export type DispatchViewMode = "all" | "mine";

export function useDispatchPage() {
  const [viewMode, setViewMode] = useState<DispatchViewMode>("all");

  return { viewMode, setViewMode };
}
