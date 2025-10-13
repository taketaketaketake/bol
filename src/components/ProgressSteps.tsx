interface ProgressStepsProps {
  currentStep: number;
}

const steps = [
  { number: 1, label: "Schedule" },
  { number: 2, label: "Service" },
  { number: 3, label: "Add-ons" },
  { number: 4, label: "Details" },
  { number: 5, label: "Payment" },
];

export default function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-10 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between sm:space-x-4 space-y-4 sm:space-y-0">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center w-full sm:w-auto">
            {/* Step circle */}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm flex-shrink-0 transition-all duration-200
                ${
                  step.number < currentStep
                    ? "bg-brand-primary text-white"
                    : step.number === currentStep
                    ? "bg-brand-primary text-white ring-2 ring-brand-primary/30"
                    : "bg-gray-200 text-gray-500"
                }`}
              aria-label={`Step ${step.number}: ${step.label}`}
            >
              {step.number < currentStep ? "✓" : step.number}
            </div>

            {/* Step label */}
            <span
              className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                step.number <= currentStep
                  ? "text-brand-primary"
                  : "text-gray-500"
              }`}
            >
              {step.label}
            </span>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={`hidden sm:block flex-1 h-0.5 mx-4 transition-colors duration-200 ${
                  step.number < currentStep
                    ? "bg-brand-primary"
                    : "bg-gray-200"
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
