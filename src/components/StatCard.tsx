import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  onClick?: () => void;
}

export default function StatCard({ title, value, icon: Icon, trend, className, onClick }: StatCardProps) {
  return (
    <Card 
      className={cn(
        'shadow-card transition-all duration-300 group relative overflow-hidden', 
        onClick ? 'hover:shadow-elevated hover:border-primary/50 cursor-pointer active:scale-[0.98]' : '',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs md:text-sm font-medium text-muted-foreground/80 truncate uppercase tracking-wider">{title}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl md:text-3xl font-bold font-display tracking-tight truncate">{value}</p>
              {trend && <p className="text-xs text-success font-medium flex items-center gap-0.5">{trend}</p>}
            </div>
            {onClick && (
              <div className="mt-2 flex items-center gap-1 text-[10px] md:text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                Ver detalhes <span className="text-base leading-none">→</span>
              </div>
            )}
          </div>
          <div className="relative">
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
              <Icon className="h-5 w-5 md:h-7 md:w-7 text-primary" />
            </div>
            {/* Subtle background glow on hover */}
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
