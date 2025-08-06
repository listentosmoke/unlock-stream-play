import { Play } from 'lucide-react';

interface VideoPlaceholderProps {
  title: string;
  className?: string;
}

export function VideoPlaceholder({ title, className }: VideoPlaceholderProps) {
  // Generate a color based on the title
  const getColorFromTitle = (title: string) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const backgroundColor = getColorFromTitle(title);
  
  return (
    <div 
      className={`flex flex-col items-center justify-center text-white ${className}`}
      style={{ backgroundColor }}
    >
      <Play className="h-16 w-16 mb-4" fill="currentColor" />
      <div className="text-center px-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{title}</h3>
        <p className="text-sm opacity-80">Video Preview</p>
      </div>
    </div>
  );
}