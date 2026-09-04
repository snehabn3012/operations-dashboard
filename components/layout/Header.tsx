"use client";

import { ROLES, getRoleLabel } from "@/config/roles";
import { setSelectedRole } from "@/store/dashboardSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Role } from "@/types/dashboard";

import styles from "./Header.module.css";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const dispatch = useAppDispatch();
  const selectedRole = useAppSelector((state) => state.dashboardUi.selectedRole);
  const roleLabel = getRoleLabel(selectedRole);

  return (
    <header className={styles.header}>
      <span className={styles.title}>{title}</span>
      <div className={styles.right}>
        <div className={styles.roleField}>
          <span className={styles.roleLabel}>Viewing as</span>
          <select
            className={styles.select}
            value={selectedRole}
            onChange={(e) => dispatch(setSelectedRole(e.target.value as Role))}
          >
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.user}>
          <span className={styles.avatar}>{roleLabel.slice(0, 2).toUpperCase()}</span>
          <div>
            <div className={styles.userName}>{roleLabel}</div>
            <div className={styles.userRole}>Simulated session</div>
          </div>
        </div>
      </div>
    </header>
  );
}
