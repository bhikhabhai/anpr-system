"use client";

import { useEffect, useRef, useState } from "react";
import { inferVideo, getVideoStatus } from "@/lib/api";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

type JobStatus =
    | "upload_received"
    | "video_precheck"
    | "processing"
    | "processing_done"
    | "reencoding"
    | "uploading"
    | "completed"
    | "failed";

type VideoResult = {
    job_id: string;
    status: JobStatus;
    annotated_video_url?: string;
    vehicle_count?: number;
    plate_count?: number;
    progress?: number;
};

const STATUS_LABELS: Record<JobStatus, string> = {
    upload_received: "Uploading video",
    video_precheck: "Validating video",
    processing: "Processing frames",
    processing_done: "Finalizing processing",
    reencoding: "Re-encoding video",
    uploading: "Uploading output",
    completed: "Completed",
    failed: "Failed",
};

export default function VideoWorkspacePage() {
    const [file, setFile] = useState<File | null>(null);
    const [task, setTask] = useState<"vehicle_detect" | "plate_recognize">(
        "vehicle_detect"
    );

    const [jobId, setJobId] = useState<string | null>(null);
    const [result, setResult] = useState<VideoResult | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const [canceling, setCanceling] = useState(false);
    
    // Memoize file URL to prevent re-rendering
    const fileUrl = useRef<string | null>(null);
    useEffect(() => {
        if (file) {
            // Revoke old URL if exists
            if (fileUrl.current && fileUrl.current !== "") {
                URL.revokeObjectURL(fileUrl.current);
            }
            // Create new URL
            fileUrl.current = URL.createObjectURL(file);
            return () => {
                // Only cleanup on unmount or file change
                if (fileUrl.current && fileUrl.current !== "") {
                    URL.revokeObjectURL(fileUrl.current);
                    fileUrl.current = null;
                }
            };
        }
    }, [file]);

    /* ---------------- FILE HANDLING ---------------- */

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;

        if (f && f.size > MAX_VIDEO_SIZE) {
            setError("File size exceeds 200MB limit");
            setFile(null);
            return;
        }

        setFile(f);
        setError(null);
        resetJob();
    };

    const resetJob = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        setJobId(null);
        setResult(null);
    };

    /* ---------------- RUN INFERENCE ---------------- */

    const handleRun = async () => {
        if (!file) {
            setError("Select a video first");
            return;
        }

        try {
            setLoading(true);
            setError(null);
            resetJob();

            const resp = await inferVideo(file, task);

            // ✅ Job created
            setJobId(resp.job_id);

            // ✅ Seed UI state immediately (CRITICAL)
            setResult({
                job_id: resp.job_id,
                status: "upload_received",
                progress: 0,
            });
        } catch (err: any) {
            setError(err.message || "Failed to start inference");
        } finally {
            setLoading(false);
        }
    };

    /* ---------------- CANCEL ---------------- */

    const handleCancel = async () => {
        if (!jobId) return;

        try {
            setCanceling(true);
            await fetch(`/infer/video/cancel/${jobId}`, { method: "POST" });
        } catch {
            // best-effort cancel
        } finally {
            setCanceling(false);
        }

        // Reset UI after cancel
        resetJob();
    };

    /* ---------------- POLLING ---------------- */

    useEffect(() => {
        if (!jobId) return;

        pollingRef.current = setInterval(async () => {
            try {
                const status = await getVideoStatus(jobId);
                
                // Only update if something actually changed
                setResult(prev => {
                    if (!prev) return status;
                    
                    // Check if status changed
                    if (prev.status !== status.status) return status;
                    if (prev.progress !== status.progress) return status;
                    if (prev.annotated_video_url !== status.annotated_video_url) return status;
                    if (prev.vehicle_count !== status.vehicle_count) return status;
                    if (prev.plate_count !== status.plate_count) return status;
                    
                    // No changes, return prev to prevent re-render
                    return prev;
                });

                if (
                    status.status === "completed" ||
                    status.status === "failed"
                ) {
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                }
            } catch {
                /* ignore polling errors */
            }
        }, 1500);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [jobId]);

    /* ---------------- STATUS SOURCE OF TRUTH ---------------- */

    const effectiveStatus: JobStatus | null =
        jobId ? result?.status ?? "upload_received" : null;

    /* ================= UI ================= */

    return (
        <div className="h-full flex flex-col gap-4">

            {/* TASK SELECTION */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="text-sm font-medium mb-2">Select Task</div>
                <div className="flex gap-2">
                    {["vehicle_detect", "plate_recognize"].map(t => (
                        <button
                            key={t}
                            onClick={() => setTask(t as any)}
                            className={`px-3 py-1 rounded-md text-xs border ${task === t
                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                    : "border-slate-700 text-slate-300"
                                }`}
                        >
                            {t === "vehicle_detect"
                                ? "Vehicle Detection"
                                : "Plate Recognition"}
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN WORKSPACE */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex-1 flex flex-col gap-6">

                <div className="grid grid-cols-2 gap-6 flex-1">

                    {/* INPUT */}
                    <div className="flex flex-col">
                        <div className="text-sm mb-2 text-slate-300">
                            Input Video
                        </div>

                        <div className="flex-1 relative bg-slate-950 border-2 border-slate-700 rounded-lg overflow-hidden">
                            <label className="w-full h-full flex items-center justify-center cursor-pointer">
                                {!file ? (
                                    <div className="text-center text-slate-500 text-sm">
                                        Browse video
                                        <div className="text-xs mt-2">
                                            Max upload size: 200MB
                                        </div>
                                    </div>
                                ) : (
                                    <video
                                        controls
                                        src={fileUrl.current || ""}
                                        className="w-full h-full object-contain"
                                    />
                                )}

                                <input
                                    type="file"
                                    accept="video/*"
                                    hidden
                                    onChange={handleFileChange}
                                />
                            </label>

                            {file && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setFile(null);
                                        resetJob();
                                    }}
                                    className="absolute top-2 right-2 px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {/* OUTPUT */}
                    <div className="relative flex flex-col">
                        <div className="text-sm mb-2 text-slate-300">
                            Annotated Output
                        </div>

                        <div className="relative flex-1 bg-slate-950 border-2 border-emerald-600/40 rounded-lg overflow-hidden">

                            {/* FINAL VIDEO */}
                            {effectiveStatus === "completed" &&
                                result?.annotated_video_url && (
                                    <video
                                        controls
                                        src={result.annotated_video_url}
                                        className="w-full h-full object-contain"
                                    />
                                )}

                            {/* PROCESSING OVERLAY */}
                            {jobId &&
                                effectiveStatus !== "completed" &&
                                effectiveStatus !== "failed" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80">

                                        <div className="w-14 h-14 mb-4 relative">
                                            <div className="absolute inset-0 rounded-full border border-slate-700" />
                                            <div className="absolute inset-0 rounded-full border-t-emerald-500 border-r-emerald-500 border-2 animate-spin" />
                                        </div>

                                        <div className="text-emerald-400 text-sm font-medium">
                                            {STATUS_LABELS[effectiveStatus]}
                                        </div>

                                        {typeof result?.progress === "number" && (
                                            <div className="mt-3 w-40">
                                                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden shadow-lg">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 rounded-full transition-all duration-300 shadow-emerald-500/50"
                                                        style={{
                                                            width: `${Math.min(
                                                                result.progress,
                                                                100
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                                <div className="text-xs text-center mt-2 text-emerald-400 font-medium">
                                                    {Math.round(
                                                        result.progress
                                                    )}
                                                    % Complete
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleCancel}
                                            className="mt-4 px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}

                            {/* FAILED */}
                            {effectiveStatus === "failed" && (
                                <div className="absolute inset-0 flex items-center justify-center text-red-400">
                                    Processing failed
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RUN */}
                <div className="flex justify-end">
                    <button
                        onClick={handleRun}
                        disabled={loading || !file || !!jobId}
                        className="px-5 py-2 rounded bg-emerald-500 text-slate-900 disabled:opacity-50"
                    >
                        {loading ? "Uploading…" : "Run Video Inference"}
                    </button>
                </div>
            </div>

            {/* JOB & RESULT SUMMARY (PRESERVED) */}
            {jobId && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <div className="flex justify-between mb-2">
                        <div className="text-lg font-semibold">
                            Job & Result Summary
                        </div>
                        <div className="text-xs text-slate-400">
                            Job ID: {jobId}
                        </div>
                    </div>

                    <div className="text-sm">
                        Status:{" "}
                        <span className="text-emerald-400">
                            {effectiveStatus}
                        </span>
                    </div>

                    {result?.vehicle_count !== undefined && (
                        <div className="text-sm mt-1">
                            Vehicles detected: {result.vehicle_count}
                        </div>
                    )}

                    {result?.plate_count !== undefined && (
                        <div className="text-sm mt-1">
                            Plates detected: {result.plate_count}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}