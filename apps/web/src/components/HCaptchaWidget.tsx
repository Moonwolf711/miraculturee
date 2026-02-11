import { useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface HCaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
}

export function HCaptchaWidget({ onVerify, onExpire, onError }: HCaptchaWidgetProps) {
  const captchaRef = useRef<HCaptcha>(null);
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY;

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex justify-center my-4">
      <HCaptcha
        ref={captchaRef}
        sitekey={siteKey}
        onVerify={onVerify}
        onExpire={() => {
          onExpire?.();
        }}
        onError={(err) => {
          onError?.(err);
        }}
        theme="dark"
      />
    </div>
  );
}
