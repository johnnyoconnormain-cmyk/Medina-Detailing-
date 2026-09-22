export default function Loading() {
  return (
    <div className="p-4">
      <div className="skeleton mb-4 h-16 w-full" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="skeleton h-80 lg:col-span-2" />
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}
