import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEP_HOURS = 0.25;

type HoursInputProps = Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function HoursInput({ value, onValueChange, className, disabled, ...props }: HoursInputProps) {
  const step = (dir: number) => {
    const parsed = parseFloat(value);
    const base = Number.isFinite(parsed) ? parsed : 0;
    const next = Math.max(0, Math.round((base + dir * STEP_HOURS) * 100) / 100);
    onValueChange(String(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        {...props}
        className="h-full w-full bg-transparent pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="absolute inset-y-px right-px flex w-6 flex-col overflow-hidden rounded-r-md border-l border-input">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase hours by 0.25"
          disabled={disabled}
          onClick={() => step(1)}
          className="flex flex-1 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease hours by 0.25"
          disabled={disabled}
          onClick={() => step(-1)}
          className="flex flex-1 items-center justify-center border-t border-input text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
