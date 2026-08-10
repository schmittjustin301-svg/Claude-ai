import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import { Button, Modal, Input, Select } from "./ui";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/library", label: "Content Library" },
  { to: "/generator", label: "Video Generator" },
  { to: "/videos", label: "Videos" },
];

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { projects, selectedProjectId, fetchProjects, selectProject, createProject } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createProject(name.trim());
      setName("");
      setModalOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-cf-border bg-cf-surface p-4">
        <div className="mb-6 px-2 text-lg font-semibold tracking-tight">
          Content <span className="text-cf-accent">Factory</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-cf-accent/15 text-cf-accent" : "text-cf-muted hover:bg-cf-surface-2 hover:text-cf-text",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-cf-border pt-4 text-xs text-cf-muted">
          <span>{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={logout} className="justify-start px-0">
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-cf-border bg-cf-bg px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-cf-muted">Project</span>
            <Select
              className="w-56"
              value={selectedProjectId ?? ""}
              onChange={(e) => selectProject(e.target.value)}
            >
              {projects.length === 0 && <option value="">No projects yet</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + New Project
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {selectedProjectId ? (
            <Outlet />
          ) : (
            <div className="mx-auto mt-24 max-w-md text-center text-cf-muted">
              Create a project to start uploading hooks, main clips and CTAs.
              <div className="mt-4">
                <Button onClick={() => setModalOpen(true)}>+ New Project</Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New project">
        <div className="flex flex-col gap-3">
          <Input
            placeholder="e.g. Road to Olympia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Create project"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
