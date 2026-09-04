"use client";

import { ROLES } from "@/config/roles";
import { setSelectedRole } from "@/store/dashboardSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Role } from "@/types/dashboard";

import styles from "./RoleSelector.module.css";

export default function RoleSelector() {
  const dispatch = useAppDispatch();
  const selectedRole = useAppSelector((state) => state.dashboardUi.selectedRole);

  return (
    <div className={styles.wrap} role="radiogroup" aria-label="Select role to configure">
      {ROLES.map((role) => (
        <button
          key={role.id}
          type="button"
          role="radio"
          aria-checked={role.id === selectedRole}
          className={`${styles.chip} ${role.id === selectedRole ? styles.chipActive : ""}`}
          onClick={() => dispatch(setSelectedRole(role.id as Role))}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}
