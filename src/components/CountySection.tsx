import NeighborhoodCard from './NeighborhoodCard';

interface Neighborhood {
  name: string;
  description?: string;
  zipCodes: string[];
}

interface CountySectionProps {
  id: string;
  title: string;
  subtitle: string;
  neighborhoods: Neighborhood[];
  bgColor?: string;
}

export default function CountySection({
  id,
  title,
  subtitle,
  neighborhoods,
  bgColor = "bg-white"
}: CountySectionProps) {
  return (
    <section id={id} className={`py-8 sm:py-12 lg:py-20 ${bgColor}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title text-brand-text mb-4 sm:mb-6">{title}</h2>
        <p className="text-gray-500 mb-8 sm:mb-12">{subtitle}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {neighborhoods.map((neighborhood) => (
            <NeighborhoodCard
              key={neighborhood.name}
              name={neighborhood.name}
              description={neighborhood.description}
              zipCodes={neighborhood.zipCodes}
            />
          ))}
        </div>
      </div>
    </section>
  );
}