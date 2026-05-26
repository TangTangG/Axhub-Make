import { cn } from './utils';

const selected = true;
const className = cn(
    'menu-item-wrapper group flex',
    selected ? 'bg-accent text-accent-foreground font-semibold' : 'text-foreground hover:bg-muted/50',
    'cursor-pointer text-[11px]',
    selected && 'bg-accent/50'
);
console.log(className);
