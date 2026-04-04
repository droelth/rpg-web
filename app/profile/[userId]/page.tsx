"use client";

import { useParams } from "next/navigation";
import { ProfileView } from "@/components/ProfileView";

export default function PublicProfilePage() {
  const params = useParams();
  const raw = params?.userId;
  const userId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  return <ProfileView targetUserId={userId} />;
}
