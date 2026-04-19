"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type OrgUser = { id: string; name: string | null; email: string };

export function AssignedToSelect({
  value: controlledValue,
  onChange,
  name,
}: {
  value?: string;
  onChange?: (name: string) => void;
  name?: string;
}) {
  const t = useTranslations("Chat");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [uncontrolledValue, setUncontrolledValue] = useState(controlledValue || "");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (d.data) setUsers(d.data); })
      .catch(() => {});
  }, []);

  const handleChange = (val: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(val);
    }
    onChange?.(val);
  };

  const value = controlledValue ?? uncontrolledValue;

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">{t("unassigned")}</option>
      {users.map((u) => (
        <option key={u.id} value={u.name || u.email}>
          {u.name || u.email}
        </option>
      ))}
    </select>
  );
}
