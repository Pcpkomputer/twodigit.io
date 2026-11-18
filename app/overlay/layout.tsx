"use client";

import { useEffect } from "react";

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Add overlay classes and inline styles to html & body to guarantee transparency in streaming software (OBS, TikTok Live Studio)
    document.documentElement.classList.add("overlay-active");
    document.body.classList.add("overlay-active");
    document.documentElement.style.backgroundColor = "transparent";
    document.documentElement.style.background = "transparent";
    document.body.style.backgroundColor = "transparent";
    document.body.style.background = "transparent";

    return () => {
      document.documentElement.classList.remove("overlay-active");
      document.body.classList.remove("overlay-active");
      document.documentElement.style.backgroundColor = "";
      document.documentElement.style.background = "";
      document.body.style.backgroundColor = "";
      document.body.style.background = "";
    };
  }, []);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background-color: transparent !important;
              background: transparent !important;
              overflow: hidden !important;
            }
          `,
        }}
      />
      <div className="overlay-container fixed inset-0 w-screen h-screen bg-transparent overflow-hidden pointer-events-none">
        {children}
      </div>
    </>
  );
}
