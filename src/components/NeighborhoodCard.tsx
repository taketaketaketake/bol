interface NeighborhoodCardProps {
  name: string;
  description?: string;
  zipCodes: string[];
}

export default function NeighborhoodCard({ name, description, zipCodes }: NeighborhoodCardProps) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold text-brand-text mb-2">{name}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-3">{description}</p>
      )}
      <div className="flex flex-wrap gap-1" style={{ marginTop: description ? '0' : '2rem' }}>
        {zipCodes.map((zip) => (
          <span
            key={zip}
            className="inline-block bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-1 text-xs font-bold"
          >
            {zip}
          </span>
        ))}
      </div>
    </div>
  );
}