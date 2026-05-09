"use client";
import { usePathname } from "next/navigation";
import NotificationListener from "@/app/notif/notif";

/**
 * ClientShell — thin client wrapper around the root layout.
 *
 * Responsibilities:
 *  - Reads the current pathname (requires "use client")
 *  - Mounts NotificationListener on every page EXCEPT /chat,
 *    because on /chat the user is already reading the conversation.
 */
export default function ClientShell({ children }) {
  const pathname = usePathname();
  const showNotifBubble = !pathname?.startsWith("/chat");

  return (
    <>
      {showNotifBubble && <NotificationListener />}
      {children}
    </>
  );
}
