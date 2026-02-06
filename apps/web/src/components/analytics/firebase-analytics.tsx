"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase";

export function FirebaseAnalytics() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return null;
}
