import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vehicle Vision Console",
  description: "Vehicle / plate detection console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <div className="px-4 py-4 border-b border-slate-800">
              <div className="text-lg font-semibold">Vehicle Console</div>
              <div className="text-xs text-slate-400">Detection & Analytics</div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
              <Link
                href="/dashboard"
                className="block px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Dashboard
              </Link>
              <div className="mt-4 text-xs font-semibold text-slate-500 uppercase">
                Workspaces
              </div>
              <Link
                href="/workspace/image"
                className="block px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Image
              </Link>
              <Link
                href="/workspace/video"
                className="block px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Video
              </Link>
              <Link
                href="/workspace/stream"
                className="block px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Stream
              </Link>

              <div className="mt-4 text-xs font-semibold text-slate-500 uppercase">
                Data
              </div>
              <Link
                href="/history"
                className="block px-3 py-2 rounded-md hover:bg-slate-800"
              >
                History
              </Link>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col">
            {/* Top bar */}
            <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4 text-sm">
              <div className="font-medium">Vehicle Detection Platform</div>
              <div className="text-slate-400">v0.1 • Local Dev</div>
            </header>

            {/* Page content */}
            <div className="flex-1 overflow-auto p-4">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
