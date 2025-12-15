"use client";

import { useRef, useState } from "react";
import { inferImage } from "@/lib/api";

type Detection = {
    bbox: number[];
    score: number;
    class_id: number;
};

type InferenceResponse = {
    task: string;
    count: number;
    detections: Detection[];
    storage_url?: string;
    image_url?: string;
    frame_id: number;
    vehicle_count: number;
    plate_count: number;
    plates: any[];
    roi: any;
    local_path?: string;
};


export default function ImageWorkspacePage() {
    const [file, setFile] = useState<File | null>(null);
    const [task, setTask] = useState<"vehicle_detect" | "plate_recognize">(
        "vehicle_detect"
    );
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<InferenceResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Memoize file URL to prevent re-rendering
    const fileUrl = useRef<string | null>(null);

    const annotatedSrc =
        result?.storage_url || result?.image_url || result?.local_path || null;

    /* ---------------- FILE HANDLING ---------------- */

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;

        // Revoke old URL if exists
        if (fileUrl.current && fileUrl.current !== "") {
            URL.revokeObjectURL(fileUrl.current);
        }

        if (f) {
            // Create new URL
            fileUrl.current = URL.createObjectURL(f);
        } else {
            fileUrl.current = null;
        }

        setFile(f);
        setResult(null);
        setError(null);
    };

    /* ---------------- RUN INFERENCE ---------------- */

    const handleRun = async () => {
        if (!file) {
            setError("Select an image first");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await inferImage(file, task);
            setResult(data);
        } catch (err: any) {
            setError(err.message || "Inference failed");
        } finally {
            setLoading(false);
        }
    };

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
                            Input Image
                        </div>

                        <div className="flex-1 relative bg-slate-950 border-2 border-slate-700 rounded-lg overflow-hidden">
                            <label className="w-full h-full flex items-center justify-center cursor-pointer">
                                {!file ? (
                                    <div className="text-center text-slate-500 text-sm">
                                        Browse image
                                        <div className="text-xs mt-2">
                                            JPG, PNG, WebP
                                        </div>
                                    </div>
                                ) : (
                                    <img
                                        src={fileUrl.current || undefined}
                                        alt="input"
                                        className="w-full h-full object-contain"
                                    />
                                )}

                                <input
                                    type="file"
                                    accept="image/*"
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
                                        if (fileUrl.current) {
                                            URL.revokeObjectURL(fileUrl.current);
                                            fileUrl.current = null;
                                        }
                                        setFile(null);
                                        setResult(null);
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

                            {/* FINAL IMAGE */}
                            {result && annotatedSrc && (
                                <img
                                    src={annotatedSrc}
                                    alt="annotated"
                                    className="w-full h-full object-contain"
                                />
                            )}

                            {/* LOADING OVERLAY */}
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80">

                                    <div className="w-14 h-14 mb-4 relative">
                                        <div className="absolute inset-0 rounded-full border border-slate-700" />
                                        <div className="absolute inset-0 rounded-full border-t-emerald-500 border-r-emerald-500 border-2 animate-spin" />
                                    </div>

                                    <div className="text-emerald-400 text-sm font-medium">
                                        Processing...
                                    </div>
                                </div>
                            )}

                            {/* EMPTY STATE */}
                            {!result && !loading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm text-slate-500">Run inference</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RUN BUTTON + ERROR */}
                <div className="flex justify-between items-center">
                    <div>
                        {error && (
                            <div className="text-xs text-red-400 overflow-auto">{error}</div>
                        )}
                    </div>
                    <button
                        onClick={handleRun}
                        disabled={loading || !file}
                        className="px-5 py-2 rounded bg-emerald-500 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                        {loading ? "Processing…" : "Run Image Inference"}
                    </button>
                </div>
            </div>

            {/* RESULT SUMMARY */}
            {result && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <div className="flex justify-between mb-4">
                        <div className="text-lg font-semibold">
                            Detections & Results
                        </div>
                        <div className="text-xs text-slate-400">
                            Frame ID: {result.frame_id}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <div className="text-xs text-slate-400">Total Detections</div>
                            <div className="text-2xl font-bold text-emerald-400">{result.count}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Vehicles</div>
                            <div className="text-2xl font-bold text-blue-400">{result.vehicle_count}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Plates</div>
                            <div className="text-2xl font-bold text-amber-400">{result.plate_count}</div>
                        </div>
                    </div>

                    {result.detections && result.detections.length > 0 && (
                        <div>
                            <div className="text-sm font-semibold mb-2">Detection Details</div>
                            <table className="w-full text-xs border-collapse">
                                <thead className="border-b border-slate-800 text-slate-400">
                                    <tr>
                                        <th className="text-left py-2 pr-2">#</th>
                                        <th className="text-left py-2 pr-2">Class</th>
                                        <th className="text-left py-2 pr-2">Confidence</th>
                                        <th className="text-left py-2 pr-2">Bounding Box</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.detections.map((d, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-b border-slate-900 last:border-none hover:bg-slate-850"
                                        >
                                            <td className="py-2 pr-2 text-slate-400">{idx + 1}</td>
                                            <td className="py-2 pr-2">{d.class_id}</td>
                                            <td className="py-2 pr-2 text-emerald-400">{d.score.toFixed(3)}</td>
                                            <td className="py-2 pr-2 text-slate-400">
                                                [{d.bbox.map((v) => v.toFixed(1)).join(", ")}]
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {result.count === 0 && (
                        <div className="text-sm text-amber-400 p-3 bg-amber-950 rounded-md">
                            No detections found in this image. Try a different image or adjust detection parameters.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
