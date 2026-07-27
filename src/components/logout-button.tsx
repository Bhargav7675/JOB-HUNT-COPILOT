"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-secondary !min-h-10 !px-3.5 !py-2 text-sm"
      onClick={() => {
        void (async () => {
          await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "logout" }),
          });
          router.push("/");
          router.refresh();
        })();
      }}
    >
      Log out
    </button>
  );
}
