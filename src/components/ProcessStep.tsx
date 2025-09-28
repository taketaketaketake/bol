interface ProcessStepProps {
  stepNumber: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export default function ProcessStep({ stepNumber, title, description, imageUrl, imageAlt }: ProcessStepProps) {
  return (
    <article className="card p-6 relative overflow-hidden">
      <div className="absolute top-4 right-4 text-6xl font-black text-brand-primary opacity-10">
        {stepNumber}
      </div>
      <img
        src={imageUrl}
        alt={imageAlt}
        className="w-full h-48 object-cover rounded-lg border border-gray-200 mb-4"
      />
      <h3 className="text-xl font-bold text-brand-text mb-3">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </article>
  );
}