"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pingBackend } from "@/lib/api";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await pingBackend();
        setBackendStatus("online");
      } catch {
        setBackendStatus("offline");
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">ANPR System</h1>
              <p className="text-sm text-slate-400">Automatic Number Plate Recognition</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                backendStatus === "online"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : backendStatus === "offline"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}>
                <div className={`h-2 w-2 rounded-full ${
                  backendStatus === "online"
                    ? "animate-pulse bg-emerald-400"
                    : backendStatus === "offline"
                    ? "bg-red-400"
                    : "animate-pulse bg-amber-400"
                }`} />
                {backendStatus === "online"
                  ? "Backend Online"
                  : backendStatus === "offline"
                  ? "Backend Offline"
                  : "Checking..."}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* HERO SECTION */}
        <div className="mb-16">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8">
            <h2 className="mb-3 text-2xl font-semibold text-slate-100">
              Welcome to ANPR
            </h2>
            <p className="mb-6 text-slate-400">
              End-to-end vehicle detection and license plate recognition system powered by ONNX models and cloud storage.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/workspace/image"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image Inference
              </a>
              <a
                href="/workspace/video"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-blue-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Video Inference
              </a>
            </div>
          </div>
        </div>

        {/* WORKSPACE CARDS */}
        <div className="mb-12">
          <h3 className="mb-4 text-lg font-semibold text-slate-200">Workspaces</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {/* IMAGE WORKSPACE */}
            <Link href="/workspace/image">
              <div className="group rounded-lg border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-500/50 hover:bg-slate-900/80">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="mb-2 text-lg font-semibold text-slate-100 group-hover:text-emerald-400">
                      Image Inference
                    </h4>
                    <p className="text-sm text-slate-400">
                      Upload and process single images for vehicle detection and plate recognition
                    </p>
                  </div>
                  <svg className="h-8 w-8 text-slate-600 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />
                  Fast processing • Real-time feedback
                </div>
              </div>
            </Link>

            {/* VIDEO WORKSPACE */}
            <Link href="/workspace/video">
              <div className="group rounded-lg border border-slate-800 bg-slate-900/50 p-6 transition hover:border-blue-500/50 hover:bg-slate-900/80">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="mb-2 text-lg font-semibold text-slate-100 group-hover:text-blue-400">
                      Video Inference
                    </h4>
                    <p className="text-sm text-slate-400">
                      Process videos with frame-by-frame detection and async job management
                    </p>
                  </div>
                  <svg className="h-8 w-8 text-slate-600 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
                  Batch processing • Progress tracking
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* FEATURES SECTION */}
        <div className="mb-12">
          <h3 className="mb-4 text-lg font-semibold text-slate-200">Key Features</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Vehicle Detection",
                description: "Detect vehicles with ONNX-powered inference on 640×640 images",
                icon: "🚗",
              },
              {
                title: "License Plate Recognition",
                description: "Identify and extract license plate regions with confidence scores",
                icon: "🏷️",
              },
              {
                title: "Cloud Storage",
                description: "Annotated images and videos stored in Supabase S3-compatible buckets",
                icon: "☁️",
              },
              {
                title: "Real-time Processing",
                description: "Sub-second image inference with instant visual feedback",
                icon: "⚡",
              },
              {
                title: "Async Video Jobs",
                description: "Process videos in background with progress tracking and polling",
                icon: "🎬",
              },
              {
                title: "Detection Details",
                description: "View bounding boxes, confidence scores, and frame metadata",
                icon: "📊",
              },
            ].map((feature, idx) => (
              <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                <div className="mb-3 text-2xl">{feature.icon}</div>
                <h4 className="mb-1 font-semibold text-slate-100">{feature.title}</h4>
                <p className="text-xs text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* INFO CARDS */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* SYSTEM INFO */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-6">
            <h4 className="mb-4 font-semibold text-slate-200">System Info</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Backend</span>
                <span className={backendStatus === "online" ? "text-emerald-400" : "text-red-400"}>
                  {backendStatus === "online" ? "FastAPI" : "Offline"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Frontend</span>
                <span className="text-slate-300">Next.js 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inference</span>
                <span className="text-slate-300">ONNX Runtime</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Storage</span>
                <span className="text-slate-300">Supabase</span>
              </div>
            </div>
          </div>

          {/* QUICK START */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-6">
            <h4 className="mb-4 font-semibold text-slate-200">Quick Start</h4>
            <ol className="space-y-3 text-sm text-slate-400">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-100">1</span>
                <span>Select a workspace (Image or Video)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-100">2</span>
                <span>Choose detection task (vehicle/plate)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-100">3</span>
                <span>Upload file and run inference</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-100">4</span>
                <span>View results with bounding boxes</span>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
