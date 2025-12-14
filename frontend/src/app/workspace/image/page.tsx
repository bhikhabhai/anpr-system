"use client";

import { useState } from "react";
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
    const annotatedSrc =
            result?.storage_url || result?.image_url ||  result?.local_path || null;

    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        setFile(f);
        setResult(null);
        setError(null);
    };

    const handleRun = async () => {
        if (!file) {
            setError("Select an image first.");
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Image Workspace</h1>
                    <p className="text-xs text-slate-400">
                        Upload an image and run vehicle / plate detection via backend.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1">
                {/* Left: controls */}
                <div className="col-span-4 flex flex-col gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                        <div className="text-sm font-medium mb-2">Task</div>
                        <div className="flex gap-2">
                            <button
                                className={`px-3 py-1 rounded-md text-xs border ${task === "vehicle_detect"
                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                    : "border-slate-700 text-slate-300"
                                    }`}
                                onClick={() => setTask("vehicle_detect")}
                            >
                                Vehicle Detection
                            </button>
                            <button
                                className={`px-3 py-1 rounded-md text-xs border ${task === "plate_recognize"
                                    ? "bg-slate-100 text-slate-900 border-slate-100"
                                    : "border-slate-700 text-slate-300"
                                    }`}
                                onClick={() => setTask("plate_recognize")}
                            >
                                Plate Recognition
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                        <div className="text-sm font-medium mb-2">Image</div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="text-xs"
                        />
                        {file && (
                            <div className="text-xs text-slate-400">
                                Selected: <span className="text-slate-200">{file.name}</span>
                            </div>
                        )}
                    </div>

                    {/* ROI placeholder: we’ll build real ROI editor next */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                        <div className="text-sm font-medium">ROI (coming next)</div>
                        <p className="text-xs text-slate-500">
                            For now, inference runs on full image. We will add ROI drawing and
                            numeric controls here in the next step.
                        </p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                        <button
                            onClick={handleRun}
                            disabled={loading || !file}
                            className="w-full py-2 rounded-md text-sm font-medium bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950"
                        >
                            {loading ? "Running..." : "Run Inference"}
                        </button>
                        {error && (
                            <div className="text-xs text-red-400 break-words">{error}</div>
                        )}
                    </div>
                </div>

                {/* Right: preview + results */}
                <div className="col-span-8 flex flex-col gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex-1 flex flex-col">
                        <div className="text-lg font-semibold mb-4 text-slate-100">Preview</div>

                        <div className="grid grid-cols-2 gap-6 flex-1">
                            {/* Original image */}
                            <div className="flex flex-col">
                                <div className="text-sm font-medium text-slate-300 mb-3">Input Image</div>
                                <div className="flex-1 bg-slate-950 border-2 border-slate-700 rounded-lg flex items-center justify-center overflow-hidden hover:border-slate-600 transition-colors">
                                    {file ? (
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt="original"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-sm text-slate-500">Upload image</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Annotated image from backend (Supabase) */}
                            <div className="flex flex-col">
                                <div className="text-sm font-medium text-slate-300 mb-3">Inferred Image</div>
                                <div className="flex-1 bg-slate-950 border-2 border-emerald-600/30 rounded-lg flex items-center justify-center overflow-hidden hover:border-emerald-600/50 transition-colors">
                                    {annotatedSrc ? (
                                        <img
                                            src={annotatedSrc}
                                            alt="annotated"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            {loading ? (
                                                <>
                                                    <div className="animate-spin">
                                                        <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-sm text-emerald-400">Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-sm text-slate-500">Run inference</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">Result</div>
                            {result && (
                                <div className="text-xs text-slate-400">
                                    Detections:{" "}
                                    <span className="text-slate-100">{result.count}</span>
                                </div>
                            )}
                        </div>

                        {!result && (
                            <div className="text-xs text-slate-500">
                                Run inference to see detections here.
                            </div>
                        )}

                        {result && (
                            <div className="space-y-2">
                                {result.message && result.count === 0 && (
                                    <div className="text-sm text-amber-400 p-2 bg-amber-950 rounded-md">
                                        {result.message}
                                    </div>
                                )}
                                {result.detections && result.detections.length > 0 && (
                                <table className="w-full text-xs border-collapse mt-2">
                                    <thead className="border-b border-slate-800 text-slate-400">
                                        <tr>
                                            <th className="text-left py-1 pr-2">#</th>
                                            <th className="text-left py-1 pr-2">Class</th>
                                            <th className="text-left py-1 pr-2">Score</th>
                                            <th className="text-left py-1 pr-2">BBox [x1,y1,x2,y2]</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.detections && result.detections.map((d, idx) => (
                                            <tr
                                                key={idx}
                                                className="border-b border-slate-900 last:border-none"
                                            >
                                                <td className="py-1 pr-2 text-slate-400">{idx + 1}</td>
                                                <td className="py-1 pr-2">{d.class_id}</td>
                                                <td className="py-1 pr-2">
                                                    {d.score.toFixed(2)}
                                                </td>
                                                <td className="py-1 pr-2 text-slate-400">
                                                    [{d.bbox.map((v) => v.toFixed(1)).join(", ")}]
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
