// lib/api.ts

// Fallback to localhost:8000 if env is missing
export const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

console.log("API_URL =", API_URL); // TEMP: verify in browser console

export async function pingBackend() {
  if (!API_URL) {
    throw new Error("Backend URL not configured");
  }

  const res = await fetch(`${API_URL}/health`, {
    method: "GET",
  });
console.log("API_URL =", API_URL); // TEMP
  if (!res.ok) {
    throw new Error("Backend not responding");
  }

  return res.json();
}

export type ROI = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export async function inferImage(
  file: File,
  task: "vehicle_detect" | "plate_recognize",
  roi?: ROI
) {
  if (!API_URL) {
    throw new Error("Backend URL not configured");
  }

  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams();
  params.set("task", task);

  if (roi) {
    // If your backend expects ROI as JSON body instead of query, we’ll adjust later.
    params.set("x1", String(roi.x1));
    params.set("y1", String(roi.y1));
    params.set("x2", String(roi.x2));
    params.set("y2", String(roi.y2));
  }

  const res = await fetch(`${API_URL}/infer/image?${params.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Image inference failed");
  }

  const data = await res.json();
  
  // Transform backend response to match frontend expectations
  // Backend returns: { task, vehicle_count, plate_count, plates, raw_meta: { vehicles } ... }
  // Frontend expects: { task, count, detections: [{bbox, score, class_id}, ...], ... }
  
  let detections = [];
  
  // For vehicle_detection, show vehicles from raw_meta
  // For plate_recognition, show plates
  if (task === "vehicle_detect" && data.raw_meta?.vehicles) {
    detections = data.raw_meta.vehicles.map((v: any) => ({
      bbox: [v.bbox_vehicle.x1, v.bbox_vehicle.y1, v.bbox_vehicle.x2, v.bbox_vehicle.y2],
      score: v.confidence,
      class_id: v.class_id,
    }));
  } else if (data.plates) {
    detections = data.plates.map((p: any) => ({
      bbox: p.bbox_plate ? [p.bbox_plate.x1, p.bbox_plate.y1, p.bbox_plate.x2, p.bbox_plate.y2] : 
            p.bbox_vehicle ? [p.bbox_vehicle.x1, p.bbox_vehicle.y1, p.bbox_vehicle.x2, p.bbox_vehicle.y2] : [0,0,0,0],
      score: p.confidence || 0,
      class_id: 0,
    }));
  }
  
  const transformedData = {
    task: data.task,
    count: task === "vehicle_detect" ? data.vehicle_count : data.plate_count,
    detections: detections,
    storage_url: data.image_url,
    ...data
  };

  return transformedData;
}

export async function inferVideo(
  file: File,
  task: "vehicle_detect" | "plate_recognize",
  roi?: ROI
) {
  if (!API_URL) {
    throw new Error("Backend URL not configured");
  }

  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams();
  params.set("task", task);

  if (roi) {
    params.set("x1", String(roi.x1));
    params.set("y1", String(roi.y1));
    params.set("x2", String(roi.x2));
    params.set("y2", String(roi.y2));
  }

  const res = await fetch(`${API_URL}/infer/video?${params.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Video inference failed");
  }

  return res.json();
}

export async function getVideoStatus(jobId: string) {
  if (!API_URL) {
    throw new Error("Backend URL not configured");
  }

  const res = await fetch(`${API_URL}/infer/video/status/${jobId}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch video status");
  }

  const data = await res.json();

  // 🔑 normalize backend → frontend
  return {
    ...data,
    progress: data.progress ?? 0,
  };
}

