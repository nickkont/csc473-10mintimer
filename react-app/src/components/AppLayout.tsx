import React from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export default function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
