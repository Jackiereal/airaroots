'use client';

import { useRouter } from 'next/navigation';
import { ConflictAlert } from './ConflictAlert';

type Props = { reservationId: string };

export function ConflictAlertWrapper({ reservationId }: Props) {
  const router = useRouter();
  return (
    <ConflictAlert
      reservationId={reservationId}
      onResolved={() => router.refresh()}
    />
  );
}
