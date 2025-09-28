interface ChecklistItemProps {
  text: string;
}

export default function ChecklistItem({ text }: ChecklistItemProps) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-5 h-5 bg-brand-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        ✓
      </div>
      <span className="text-gray-500 text-sm">{text}</span>
    </li>
  );
}