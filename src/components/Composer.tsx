import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

export function Composer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);
  function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }
  return (
    <div className="flex items-end gap-2 rounded-xl border bg-card p-2 pl-4 shadow-sm">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-muted-foreground"
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="Send"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground transition disabled:opacity-50"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
