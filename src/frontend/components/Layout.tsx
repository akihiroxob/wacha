import type { ReactNode } from "react";

export const Layout = ({ children }: { children: ReactNode }) => {
  return <div className="min-h-screen bg-white">{children}</div>;
};
