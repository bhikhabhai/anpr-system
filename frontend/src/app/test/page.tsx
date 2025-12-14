"use client";

import { useEffect, useState } from "react";
import { pingBackend } from "@/lib/api";

export default function TestPage() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    pingBackend()
      .then((data) => setStatus(`OK: ${JSON.stringify(data)}`))
      .catch((err) => setStatus("FAILED: " + err.message));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Backend Connection Test</h1>
      <p>Status: {status}</p>
    </div>
  );
}
