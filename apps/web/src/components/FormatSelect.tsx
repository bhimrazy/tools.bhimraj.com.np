import type { OutputFormat } from "@tools/engines/image";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FORMAT_ITEMS = [
  { label: "JPG", value: "image/jpeg" },
  { label: "WebP", value: "image/webp" },
] as const;

export default function FormatSelect({
  value,
  onChange,
  className,
}: {
  value: OutputFormat;
  onChange(v: OutputFormat): void;
  className: string;
}) {
  return (
    <Select
      items={FORMAT_ITEMS}
      value={value}
      onValueChange={(v) => v && onChange(v as OutputFormat)}
    >
      <SelectTrigger aria-label="Format" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {FORMAT_ITEMS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
