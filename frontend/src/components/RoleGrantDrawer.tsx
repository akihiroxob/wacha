import { useEffect, useRef, useState, type FormEvent, type ToggleEvent } from "react";
import type { ProjectGrantDto, ProjectGrantInput } from "@shared/apiTypes";
import { formatAbsoluteTime } from "@/lib/time";
import { useGrantProjectRole, useRevokeProjectRole } from "@/lib/queries";

const ASSIGNABLE_ROLES: { value: ProjectGrantInput["role"]; label: string }[] = [
  { value: "worker", label: "Worker" },
  { value: "reviewer", label: "Reviewer" },
  { value: "manager", label: "Manager" },
];

type RoleGrantDrawerProps = {
  projectId: string;
  projectName: string;
  grants: ProjectGrantDto[];
  onClose: () => void;
};

export const RoleGrantDrawer = ({
  projectId,
  projectName,
  grants,
  onClose,
}: RoleGrantDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [principalId, setPrincipalId] = useState("");
  const [role, setRole] = useState<ProjectGrantInput["role"]>("worker");
  const grantRole = useGrantProjectRole(projectId);
  const revokeRole = useRevokeProjectRole(projectId);
  const mutationError = grantRole.error ?? revokeRole.error;

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer && !drawer.matches(":popover-open")) drawer.showPopover();
  }, []);

  const handleToggle = (event: ToggleEvent<HTMLDivElement>) => {
    if (event.newState === "closed") onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPrincipalId = principalId.trim();
    if (!normalizedPrincipalId) return;
    grantRole.mutate(
      { principalId: normalizedPrincipalId, role },
      { onSuccess: () => setPrincipalId("") },
    );
  };

  return (
    <div
      ref={drawerRef}
      popover="auto"
      onToggle={handleToggle}
      className="fixed inset-y-0 left-auto right-0 m-0 h-full max-h-none w-[min(94vw,34rem)] overflow-y-auto border-l border-stone-200 bg-white shadow-2xl backdrop:bg-black/25"
    >
      <div className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 border-b border-stone-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                Project Role Grants
              </p>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">{projectName}</h2>
              <p className="mt-1 text-sm text-stone-500">
                Agent名ごとに、このProjectで利用できるRoleを管理します。
              </p>
            </div>
            <button
              type="button"
              onClick={() => drawerRef.current?.hidePopover()}
              className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
              aria-label="Role Grant管理を閉じる"
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-6 py-5">
          <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold text-stone-800">Roleを発行</h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Bearer tokenに設定するAgent名と、担当するRoleを指定してください。
            </p>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-stone-600">Agent名</span>
                <input
                  type="text"
                  value={principalId}
                  onChange={(event) => setPrincipalId(event.target.value)}
                  placeholder="例: E2EWorker"
                  autoFocus
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-stone-400"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-stone-600">Role</span>
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as ProjectGrantInput["role"])
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none transition focus:border-stone-400"
                >
                  {ASSIGNABLE_ROLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!principalId.trim() || grantRole.isPending}
                className="w-fit rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {grantRole.isPending ? "発行中..." : "Roleを発行"}
              </button>
            </form>
          </section>

          {mutationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {mutationError instanceof Error
                ? mutationError.message
                : "Roleの更新に失敗しました。"}
            </div>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">発行済みRole</h3>
              <span className="text-xs text-stone-400">{grants.length} grants</span>
            </div>
            {grants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-400">
                Role Grantはありません。
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {grants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <code className="block truncate text-sm font-medium text-stone-800">
                        {grant.principalId}
                      </code>
                      <p
                        className="mt-1 text-xs text-stone-400"
                        title={formatAbsoluteTime(grant.createdAt)}
                      >
                        {grant.role} ・ {formatAbsoluteTime(grant.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={revokeRole.isPending}
                      onClick={() =>
                        revokeRole.mutate({
                          principalId: grant.principalId,
                          role: grant.role as ProjectGrantInput["role"],
                        })
                      }
                      className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                    >
                      取消
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
