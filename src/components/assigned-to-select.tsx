"use client";

import { useState, useEffect } from "react";

type OrgUser = { id: string; name: string | null; email: string };

export function AssignedToSelect({
  value,
  onChange,
  name,
}: {
  value?: string;
  onChange?: (name: string) => void;
  name?: string; // for form submission
}) {
  const [users, setUsers] = useState<OrgUser[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (d.data) setUsers(d.data); })
      .catch(() => {});
  }, []);

  return (
    <select
      name={name}
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">Unassigned</option>
      {users.map((u) => (
        <option key={u.id} value={u.name || u.email}>
          {u.name || u.email}
        </option>
      ))}
    </select>
  );
}
