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
        'shadow-card transition-all duration-200 group', 
        onClick ? 'hover:shadow-elevated hover:border-primary/50 cursor-pointer active:scale-[0.98]' : '',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs md:text-sm text-muted-foreground truncate">{title}</p>
              {onClick && <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">Ver detalhes</span>}
            </div>
            <p className="text-base md:text-2xl font-bold font-display mt-1 truncate">{value}</p>
            {trend && <p className="text-xs text-success mt-1">{trend}</p>}
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
