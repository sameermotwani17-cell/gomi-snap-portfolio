import EmptyState from "../EmptyState";

export default function EmptyStateExample() {
  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <h3 className="text-sm font-medium mb-4">No search query (English)</h3>
        <EmptyState language="en" searchQuery="" />
      </div>
      <div className="border-b pb-4">
        <h3 className="text-sm font-medium mb-4">No search query (Japanese)</h3>
        <EmptyState language="ja" searchQuery="" />
      </div>
      <div className="border-b pb-4">
        <h3 className="text-sm font-medium mb-4">Not found (English)</h3>
        <EmptyState language="en" searchQuery="unknown item" />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">Not found (Japanese)</h3>
        <EmptyState language="ja" searchQuery="不明なアイテム" />
      </div>
    </div>
  );
}
