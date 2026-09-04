'use client';

import { useFormStatus } from 'react-dom';

type PendingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel = 'Guardando…',
  className = 'btn btn-primary'
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
