import { Fragment } from 'react';

/** Mostra um texto traduzido que tem trechos em negrito marcados com <b>…</b>. Só aceita essa marca: o resto é texto puro. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g);
  return <>{parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}</>;
}
