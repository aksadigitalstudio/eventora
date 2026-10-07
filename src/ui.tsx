import { useEffect, useRef } from "react";
import { ArrowUpRight, X, Check, LoaderCircle } from "lucide-react";
import { CONFIG } from "./config";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      href="/"
      className={"brand " + (light ? "light" : "")}
      aria-label={CONFIG.appName + " home"}
    >
      <span className="brand-icon">
        e<sup>✳</sup>
      </span>
      {CONFIG.appName}
      <span className="brand-dot">.</span>
    </a>
  );
}
export function Button({
  children,
  onClick,
  type = "button",
  variant = "",
  disabled = false,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: string;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={"button " + variant}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
export function NextIcon() {
  return <ArrowUpRight size={19} />;
}
export function Status({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={"status " + tone}>
      {tone === "success" && <Check size={12} />} {children}
    </span>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <span>↗</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Loading({ text = "Loading your event…" }: { text?: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      {text}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current!;
    el.querySelector<HTMLElement>("button,input")?.focus();
    const listener = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Tab") {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select,textarea,a[href]",
          ),
        ).filter((x) => x.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last?.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
