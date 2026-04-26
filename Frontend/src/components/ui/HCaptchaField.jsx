import { useMemo } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

function HCaptchaField({ onVerify, onExpire, onError }) {
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY;
  const shouldRender = Boolean(siteKey);
  const stableKey = useMemo(() => siteKey ?? "missing-site-key", [siteKey]);

  if (!shouldRender) {
    return (
      <p className="text-center text-[12px] font-semibold text-pink-300">
        Missing VITE_HCAPTCHA_SITE_KEY in Frontend/.env
      </p>
    );
  }

  return (
    <div className="flex justify-center">
      <HCaptcha
        key={stableKey}
        sitekey={siteKey}
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
        theme="dark"
      />
    </div>
  );
}

export default HCaptchaField;
