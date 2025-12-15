"use client";

import { useEffect, useState } from "react";
import { getFrames, getVideos, getStats } from "@/lib/api";
import Link from "next/link";

type Frame = {
  id: number;
  image_url: string;
  captured_at: string;
  vehicle_count: number;
  plate_count: number;
};

type Video = {
  id: number;
  job_id: string;
  filename: string;
  task: string;
  status: string;
  vehicle_count: number;
  plate_count: number;
  total_frames: number;
  output_video_url?: string;
  created_at: string;
  completed_at?: string;
};

type Stats = {
  total_frames: number;
  total_videos: number;
  completed_videos: number;
  total_vehicles_detected: number;
  total_plates_detected: number;
  total_plate_records: number;
};

type Tab = "frames" | "videos";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("frames");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameOffset, setFrameOffset] = useState(0);
  const [videoOffset, setVideoOffset] = useState(0);
  const [frameTotal, setFrameTotal] = useState(0);
  const [videoTotal, setVideoTotal] = useState(0);

  const limit = 50;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load stats
        const statsData = await getStats();
        setStats(statsData);

        // Load frames or videos based on active tab
        if (activeTab === "frames") {
          const framesData = await getFrames(limit, frameOffset);
          setFrames(framesData.frames);
          setFrameTotal(framesData.total);
        } else {
          const videosData = await getVideos(limit, videoOffset);
          setVideos(videosData.videos);
          setVideoTotal(videosData.total);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, frameOffset, videoOffset]);

  const frameTotalPages = Math.ceil(frameTotal / limit);
  const videoTotalPages = Math.ceil(videoTotal / limit);
  const frameCurrentPage = Math.floor(frameOffset / limit) + 1;
  const videoCurrentPage = Math.floor(videoOffset / limit) + 1;

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

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Detection History</h1>
        <p className="text-sm text-slate-400">View all processed frames and videos</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* STATS */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Total Detections</div>
            <div className="mt-1 text-2xl font-bold text-emerald-400">
              {stats.total_frames + stats.total_videos}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Vehicles Detected</div>
            <div className="mt-1 text-2xl font-bold text-blue-400">
              {stats.total_vehicles_detected}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Plates Detected</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">
              {stats.total_plates_detected}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">Completed Videos</div>
            <div className="mt-1 text-2xl font-bold text-purple-400">
              {stats.completed_videos}
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-slate-800">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab("frames");
              setFrameOffset(0);
            }}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === "frames"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Frames ({frameTotal})
          </button>
          <button
            onClick={() => {
              setActiveTab("videos");
              setVideoOffset(0);
            }}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === "videos"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Videos ({videoTotal})
          </button>
        </div>
      </div>

      {/* FRAMES TABLE */}
      {activeTab === "frames" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-slate-100">
              Frames {frameTotal > 0 && `(${frameOffset + 1}–${Math.min(frameOffset + limit, frameTotal)} of ${frameTotal})`}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400">Loading...</div>
            </div>
          ) : frames.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400">No frames found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">ID</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">Preview</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                      Captured
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                      Vehicles
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                      Plates
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {frames.map((frame) => (
                    <tr
                      key={frame.id}
                      className="border-b border-slate-800 hover:bg-slate-950/50 transition"
                    >
                      <td className="px-6 py-4 text-slate-300">#{frame.id}</td>
                      <td className="px-6 py-4">
                        {frame.image_url && (
                          <img
                            src={frame.image_url}
                            alt={`Frame ${frame.id}`}
                            className="h-10 w-10 rounded object-cover bg-slate-800"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-xs">
                        {new Date(frame.captured_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                          {frame.vehicle_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                          {frame.plate_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/history/frames/${frame.id}`}
                          className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {frameTotalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
              <button
                onClick={() => setFrameOffset(Math.max(0, frameOffset - limit))}
                disabled={frameOffset === 0}
                className="px-3 py-1 rounded text-sm bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {frameCurrentPage} of {frameTotalPages}
              </span>
              <button
                onClick={() => setFrameOffset(frameOffset + limit)}
                disabled={frameCurrentPage === frameTotalPages}
                className="px-3 py-1 rounded text-sm bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIDEOS TABLE */}
      {activeTab === "videos" && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-slate-100">
              Videos {videoTotal > 0 && `(${videoOffset + 1}–${Math.min(videoOffset + limit, videoTotal)} of ${videoTotal})`}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400">Loading...</div>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400">No videos found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">ID</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">Filename</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">Status</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                      Frames
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                      Vehicles
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-400">
                      Plates
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400">
                      Created
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => (
                    <tr
                      key={video.id}
                      className="border-b border-slate-800 hover:bg-slate-950/50 transition"
                    >
                      <td className="px-6 py-4 text-slate-300">#{video.id}</td>
                      <td className="px-6 py-4 text-slate-300 text-xs max-w-48 truncate">
                        {video.filename}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(video.status)}`}>
                          {video.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-300">
                        {video.total_frames}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                          {video.vehicle_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                          {video.plate_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(video.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/history/videos/${video.id}`}
                          className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {videoTotalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
              <button
                onClick={() => setVideoOffset(Math.max(0, videoOffset - limit))}
                disabled={videoOffset === 0}
                className="px-3 py-1 rounded text-sm bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {videoCurrentPage} of {videoTotalPages}
              </span>
              <button
                onClick={() => setVideoOffset(videoOffset + limit)}
                disabled={videoCurrentPage === videoTotalPages}
                className="px-3 py-1 rounded text-sm bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 text-slate-200"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
