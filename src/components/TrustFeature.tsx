interface TrustFeatureProps {
  title: string;
  description: string;
  iconColor: string;
  bgColor: string;
  iconPath: string;
}

export default function TrustFeature({ title, description, iconColor, bgColor, iconPath }: TrustFeatureProps) {
  return (
    <div className="card p-6 text-center">
      <div className={`w-16 h-16 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <svg className={`w-8 h-8 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-brand-text mb-3">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  );
}