/** Reminder under free-text fields; the caller links it to the field with aria-describedby. */
export function HealthHint({ id }: { id?: string }) {
  return (
    <p id={id} className="mt-1 text-caption text-slate">
      Don't record health, injury or medical information.
    </p>
  );
}
