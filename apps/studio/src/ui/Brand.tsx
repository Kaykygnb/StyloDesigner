// Marca do Stylo: três camadas de tinta (ciano, magenta, amarelo) que se sobrepõem.
// No tema claro elas se misturam como tinta (multiply); no escuro, como luz (screen).
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect className="lm-c" x="2" y="3" width="17" height="17" rx="5" />
      <rect className="lm-m" x="13" y="6" width="17" height="17" rx="5" />
      <rect className="lm-y" x="7" y="12" width="17" height="17" rx="5" />
    </svg>
  );
}

export function Brand({ size = 26, className = '' }: { size?: number; className?: string }) {
  return <div className={`brand ${className}`.trim()}><LogoMark size={size} /><span className="brand-word">Stylo</span></div>;
}
