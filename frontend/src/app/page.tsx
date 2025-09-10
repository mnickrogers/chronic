"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function Home() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      // unauthenticated
      router.replace('/login');
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    // Redirect to the new All Tasks landing per PRD
    router.replace('/tasks');
  }, [session]);

  const create = async () => {
    // no-op in redirected flow
  };

  if (!session) return null;

  return null;
}
