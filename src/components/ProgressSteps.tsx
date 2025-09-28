interface ProgressStepsProps {
  currentStep: number;
}

const steps = [
  { number: 1, label: "Schedule" },
  { number: 2, label: "Service" },
  { number: 3, label: "Add-ons" },
  { number: 4, label: "Details" },
  { number: 5, label: "Payment" }
];

export default function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                step.number < currentStep
                  ? "bg-blue-600 text-white"
                  : step.number === currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-500"
              }`}>
                {step.number < currentStep ? "✓" : step.number}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                step.number <= currentStep ? "text-blue-600" : "text-gray-500"
              }`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 ml-4 ${
                step.number < currentStep ? "bg-blue-600" : "bg-gray-300"
              }`}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}