import * as React from "react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
