import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

export type { ButtonSize, ButtonVariant } from './buttonStyles';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Plain button, no Radix/Slot. `type` defaults to `button` because a bare `<button>`
 * inside the promo's forms would submit them.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
    />
  );
});
