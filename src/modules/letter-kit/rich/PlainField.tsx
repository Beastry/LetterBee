"use client";

import { useEffect, useRef } from "react";

/** Source editor `ed()`: plaintext contentEditable, paste strips markup. */
export function PlainField({
  value,
  onChange,
  multiline = false,
  placeholder = "点此输入",
  className,
  label,
  onSplit,
  onMerge,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  label: string;
  onSplit?: (at: number, rest: string) => void;
  onMerge?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || focused.current) return;
    const current = (node.innerText || "").replace(/\u00a0/g, " ").replace(/\n$/, "");
    if (current !== value) node.textContent = value;
    if (autoFocus) {
      focused.current = true;
      node.focus();
    }
  }, [value, autoFocus]);

  function read() {
    return (ref.current?.innerText || "").replace(/\u00a0/g, " ").replace(/\n$/, "");
  }

  function caret() {
    const node = ref.current;
    const sel = getSelection();
    if (!node || !sel?.rangeCount) return read().length;
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(node);
    range.setEnd(sel.focusNode || node, sel.focusOffset);
    return range.toString().length;
  }

  return (
    <span
      ref={ref}
      className={`we ${className || ""}`}
      contentEditable="plaintext-only"
      role="textbox"
      aria-label={label}
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder}
      spellCheck={false}
      suppressContentEditableWarning
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        onChange(read());
      }}
      onPaste={(event) => {
        event.preventDefault();
        let text = event.clipboardData.getData("text/plain") || "";
        text = text.replace(/\r/g, "");
        if (!multiline) text = text.replace(/\s*\n\s*/g, " ");
        document.execCommand("insertText", false, text);
      }}
      onDrop={(event) => event.preventDefault()}
      onInput={() => onChange(read())}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter" && !multiline) {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Enter" && multiline && !event.shiftKey && onSplit) {
          event.preventDefault();
          const text = read();
          const at = caret();
          onChange(text.slice(0, at));
          onSplit(at, text.slice(at));
        } else if (
          event.key === "Backspace" &&
          multiline &&
          onMerge &&
          caret() === 0 &&
          getSelection()?.isCollapsed
        ) {
          event.preventDefault();
          onMerge();
        }
      }}
    />
  );
}
