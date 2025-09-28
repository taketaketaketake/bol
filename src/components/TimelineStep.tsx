interface TimelineStepProps {
  time: string;
  title: string;
  description: string;
  isLast?: boolean;
  isHighlighted?: boolean;
}

export default function TimelineStep({ time, title, description, isLast = false, isHighlighted = false }: TimelineStepProps) {
  const dotColor = isHighlighted ? 'bg-brand-accent' : 'bg-brand-primary';

  return (
    <div className={`relative ${!isLast ? 'mb-6' : ''}`}>
      <div className={`absolute left-[-6px] top-1 w-3 h-3 ${dotColor} rounded-full`}></div>
      <div>
        <h4 className="font-bold text-brand-text mb-1">{time} — {title}</h4>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </div>
  );
}