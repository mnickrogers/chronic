"use client";
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LegacyProjectRouteRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { if (id) router.replace(`/projects/${id}`); }, [id]);
  return null;
}
