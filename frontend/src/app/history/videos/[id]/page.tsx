"use client";

import { useEffect, useState } from "react";
import { getVideoDetail } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";

type VideoDetail = {
  id: number;
  job_id: string;
  filename: string;
  task: string;
  status: string;
  vehicle_count: number;
  plate_count: number;
  total_frames: number;
  input_video_url?: string;
  output_video_url?: string;
  raw_meta: any;
  created_at: string;
  updated_at: string;
  completed_at?: string;
};

export default function VideoDetailPage() {
  const params = useParams();
  const videoId = parseInt(params.id as string);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getVideoDetail(videoId);
        setVideo(data);
      } catch (err: any) {
        setError(err.message || "Failed to load video");
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-300";
      case "failed":
        return "bg-red-500/20 text-red-300";
      case "processing":
        return "bg-blue-500/20 text-blue-300";
      default:
        return "bg-amber-500/20 text-amber-300";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading video details...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="space-y-4">
        <Link href="/history" className="text-emerald-400 hover:text-emerald-300 text-sm">
          ← Back to History
        </Link>
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-sm text-red-400">
          {error || "Video not found"}
        </div>
      </div>
    );
  }

  const duration = video.completed_at
    ? new Date(video.completed_at).getTime() - new Date(video.created_at).getTime()
    : null;
  const durationMinutes = duration ? Math.floor(duration / 60000) : null;
  const durationSeconds = duration ? Math.floor((duration % 60000) / 1000) : null;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <Link href="/history" className="text-emerald-400 hover:text-emerald-300 text-sm mb-4 inline-block">
          ← Back to History
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">Video #{video.id}</h1>
        <p className="text-sm text-slate-400">Job: {video.job_id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* INFO */}
        <div className="lg:col-span-2 space-y-4">
          {/* FILENAME & STATUS */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-4">
              <div className="text-xs text-slate-400 mb-1">Filename</div>
              <div className="font-mono text-slate-100 text-sm break-all">
                {video.filename}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 mb-1">Status</div>
                <span className={`inline-block px-3 py-1 rounded font-medium text-sm ${getStatusColor(video.status)}`}>
                  {video.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Task</div>
                <div className="text-slate-100 font-medium">
                  {video.task === "vehicle_detect" ? "Vehicle Detection" : "Plate Recognition"}
                </div>
              </div>
            </div>
          </div>

          {/* TIMESTAMPS */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs text-slate-400 mb-2">Created</div>
              <div className="text-sm text-slate-200">
                {new Date(video.created_at).toLocaleString()}
              </div>
            </div>
            {video.completed_at && (
              <>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="text-xs text-slate-400 mb-2">Completed</div>
                  <div className="text-sm text-slate-200">
                    {new Date(video.completed_at).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="text-xs text-slate-400 mb-2">Duration</div>
                  <div className="text-sm text-slate-200">
                    {durationMinutes}m {durationSeconds}s
                  </div>
                </div>
              </>
            )}
          </div>

          {/* VIDEO PLAYER */}
          {video.output_video_url && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="font-semibold text-slate-100">Processed Video</h2>
              </div>
              <div className="aspect-video bg-slate-950 flex items-center justify-center">
                <video
                  src={video.output_video_url}
                  controls
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* STATS */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Total Frames</div>
            <div className="mt-2 text-3xl font-bold text-blue-400">
              {video.total_frames}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Vehicles</div>
            <div className="mt-2 text-3xl font-bold text-blue-400">
              {video.vehicle_count}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Plates</div>
            <div className="mt-2 text-3xl font-bold text-amber-400">
              {video.plate_count}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Video ID</div>
            <div className="mt-2 text-sm font-mono text-slate-300 break-all">
              {video.id}
            </div>
          </div>
        </div>
      </div>

      {/* METADATA */}
      {video.raw_meta && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="font-semibold text-slate-100 mb-4">Metadata</h2>
          <pre className="bg-slate-950 p-4 rounded text-xs text-slate-300 overflow-auto max-h-96">
            {JSON.stringify(video.raw_meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
