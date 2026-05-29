"use client";
// Shared button (observations #1, #2): one styled, accessible control used across Setup, the action
// bar, and the header. Class-based styling (see globals.css) gives real :hover/:active states and a
// clear `selected` affordance for segmented toggles. All native <button> props pass through, so
// callers can still set role="radio"/aria-checked, aria-label, disabled, type, etc.
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  selected?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  selected = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : null,
    selected ? "btn--selected" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
