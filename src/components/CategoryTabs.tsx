import { cn } from '@/lib/utils';
import { 
  Utensils, 
  ShoppingBasket, 
  Apple, 
  Carrot, 
  Drumstick, 
  Pill, 
  Cake, 
  Coffee,
  LayoutGrid
} from 'lucide-react';

export type CategoryType = 'all' | 'food' | 'grocery' | 'fruits' | 'vegetables' | 'meat' | 'medicine' | 'bakery' | 'beverages';

interface Category {
  id: CategoryType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const categories: Category[] = [
  { id: 'all', label: 'All', icon: <LayoutGrid className="w-5 h-5" />, color: 'bg-primary/10 text-primary' },
  { id: 'food', label: 'Food', icon: <Utensils className="w-5 h-5" />, color: 'bg-orange-100 text-orange-600' },
  { id: 'grocery', label: 'Grocery', icon: <ShoppingBasket className="w-5 h-5" />, color: 'bg-blue-100 text-blue-600' },
  { id: 'fruits', label: 'Fruits', icon: <Apple className="w-5 h-5" />, color: 'bg-red-100 text-red-600' },
  { id: 'vegetables', label: 'Vegetables', icon: <Carrot className="w-5 h-5" />, color: 'bg-green-100 text-green-600' },
  { id: 'meat', label: 'Meat', icon: <Drumstick className="w-5 h-5" />, color: 'bg-amber-100 text-amber-700' },
  { id: 'medicine', label: 'Medicine', icon: <Pill className="w-5 h-5" />, color: 'bg-teal-100 text-teal-600' },
  { id: 'bakery', label: 'Bakery', icon: <Cake className="w-5 h-5" />, color: 'bg-pink-100 text-pink-600' },
  { id: 'beverages', label: 'Beverages', icon: <Coffee className="w-5 h-5" />, color: 'bg-purple-100 text-purple-600' },
];

interface CategoryTabsProps {
  selected: CategoryType;
  onSelect: (category: CategoryType) => void;
}

export function CategoryTabs({ selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide py-2 -mx-4 px-4">
      <div className="flex gap-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={cn(
              "flex flex-col items-center gap-2 min-w-[72px] p-3 rounded-xl transition-all duration-200",
              selected === category.id
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-card hover:bg-secondary border border-border"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              selected === category.id ? "bg-primary-foreground/20" : category.color
            )}>
              {category.icon}
            </div>
            <span className="text-xs font-medium whitespace-nowrap">{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
