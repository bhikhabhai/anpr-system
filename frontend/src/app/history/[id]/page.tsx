"use client";

import { useEffect, useState } from "react";
import { getFrameDetail } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";

type FrameDetail = {
  id: number;
  image_url: string;
  captured_at: string;
  vehicle_count: number;
  plate_count: number;
  raw_meta: any;
  plates: Array<{
    id: number;
    plate_text: string;
    confidence: number;
    bbox_vehicle: { x1: number; y1: number; x2: number; y2: number };
    bbox_plate: { x1: number; y1: number; x2: number; y2: number };
  }>;
};

export default function FrameDetailPage() {
  const params = useParams();
  const frameId = parseInt(params.id as string);

  const [frame, setFrame] = useState<FrameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFrame = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getFrameDetail(frameId);
        setFrame(data);
      } catch (err: any) {
        setError(err.message || "Failed to load frame");
      } finally {
        setLoading(false);
      }
    };

    loadFrame();
  }, [frameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading frame details...</div>
      </div>
    );
  }

  if (error || !frame) {
    return (
      <div className="space-y-4">
        <Link href="/history" className="text-emerald-400 hover:text-emerald-300 text-sm">
          ← Back to History
        </Link>
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-sm text-red-400">
          {error || "Frame not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <Link href="/history" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">
          ← Back to History
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">Frame #{frame.id}</h1>
        <p className="text-sm text-slate-400">
          {new Date(frame.captured_at).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* IMAGE */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
            <img
              src={frame.image_url}
              alt={`Frame ${frame.id}`}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* STATS */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Vehicles</div>
            <div className="mt-2 text-3xl font-bold text-blue-400">
              {frame.vehicle_count}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Plates</div>
            <div className="mt-2 text-3xl font-bold text-amber-400">
              {frame.plate_count}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Frame ID</div>
            <div className="mt-2 text-xl font-mono text-slate-300">
              {frame.id}
            </div>
          </div>
        </div>
      </div>

      {/* PLATES */}
      {frame.plates && frame.plates.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-slate-100">
              Detected Plates ({frame.plates.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                    Plate ID
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                    Text
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                    Confidence
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                    Vehicle BBox
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                    Plate BBox
                  </th>
                </tr>
              </thead>
              <tbody>
                {frame.plates.map((plate) => (
                  <tr
                    key={plate.id}
                    className="border-b border-slate-800 hover:bg-slate-950/50 transition"
                  >
                    <td className="px-6 py-4 text-slate-300">#{plate.id}</td>
                    <td className="px-6 py-4 font-mono text-slate-100">
                      {plate.plate_text || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                        {(plate.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      [{plate.bbox_vehicle.x1.toFixed(0)}, {plate.bbox_vehicle.y1.toFixed(0)},
                      {plate.bbox_vehicle.x2.toFixed(0)}, {plate.bbox_vehicle.y2.toFixed(0)}]
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      [{plate.bbox_plate.x1.toFixed(0)}, {plate.bbox_plate.y1.toFixed(0)},
                      {plate.bbox_plate.x2.toFixed(0)}, {plate.bbox_plate.y2.toFixed(0)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* METADATA */}
      {frame.raw_meta && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="font-semibold text-slate-100 mb-4">Metadata</h2>
          <pre className="bg-slate-950 p-4 rounded text-xs text-slate-300 overflow-auto max-h-96">
            {JSON.stringify(frame.raw_meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
