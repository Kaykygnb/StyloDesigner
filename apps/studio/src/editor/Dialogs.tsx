// Janelas do editor: ajuda (atalhos de teclado) e configurações (aparência, canvas, conexão do agente, conta).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACCENTS, app, DEFAULT_SHORTCUTS, persistAccountPreferences, run, setAccent, setDensity, setGuides, setLanguage, setRulers, setTheme, toast, useApp, type Density, type Language, type Theme } from '../lib/app';
import { connectCommand } from './Panels';
import { Icon } from '../ui/Icon';
import { SITE_LANGUAGES, SUPPORTED_LANGUAGES, t, tl } from '../lib/i18n';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const M = MAC ? '⌘' : 'Ctrl';

/** [seção, [[tecla, descrição]]], já no idioma da tela. */
const shortcutGroups = (language: Language): [string, [string, string][]][] => [
  [t(language, 'shortcuts.sectionTools'), [['V', t(language, 'shortcuts.d.move')], ['F / B', t(language, 'shortcuts.d.frame')], ['⇧ S', t(language, 'shortcuts.d.section')], ['R', t(language, 'shortcuts.d.rect')], ['E', t(language, 'shortcuts.d.ellipse')], ['L', t(language, 'shortcuts.d.line')], ['T', t(language, 'shortcuts.d.text')], ['⇧ E', t(language, 'shortcuts.d.htmlCode')], ['C', t(language, 'shortcuts.d.comment')], ['I', t(language, 'shortcuts.d.inspect')], ['H', t(language, 'shortcuts.d.hand')]]],
  [t(language, 'shortcuts.sectionEdit'), [[`${M} Z / ${M} ⇧ Z`, t(language, 'shortcuts.d.undoRedo')], [`${M} D`, t(language, 'shortcuts.d.duplicate')], [t(language, 'shortcuts.k.altDrag'), t(language, 'shortcuts.d.duplicateDrag')], [`${M} C / X / V`, t(language, 'shortcuts.d.copyCutPaste')], [`${M} A`, t(language, 'shortcuts.d.selectAllLevel')], [`${M} G / ${M} ⇧ G`, t(language, 'shortcuts.d.group')], [`${M} Alt G`, t(language, 'shortcuts.d.wrapFrame')], [`${M} Alt K / B`, t(language, 'shortcuts.d.component')], [`${M} Alt M`, t(language, 'shortcuts.d.mask')], ['⇧ H / ⇧ V', t(language, 'shortcuts.d.flip')], ['0–9', t(language, 'shortcuts.d.opacity')], ['⇧ A', t(language, 'shortcuts.d.autoLayout')], ['Delete', t(language, 'shortcuts.d.delete')], [t(language, 'shortcuts.k.arrows'), t(language, 'shortcuts.d.move')]]],
  [t(language, 'shortcuts.sectionLayers'), [[`${M} ] / [`, t(language, 'shortcuts.d.forwardBack')], [`${M} ⇧ ] / [`, t(language, 'shortcuts.d.frontBack')], [`${M} ⇧ L`, t(language, 'shortcuts.d.lock')], [`${M} ⇧ H`, t(language, 'shortcuts.d.hide')], ['F2', t(language, 'shortcuts.d.rename')], ['Enter / ⇧ Enter', t(language, 'shortcuts.d.enterExitGroup')], ['Tab / ⇧ Tab', t(language, 'shortcuts.d.nextPrevLayer')]]],
  [t(language, 'shortcuts.sectionView'), [[`${M} R`, t(language, 'shortcuts.d.rulers')], [t(language, 'shortcuts.k.modWheel', { mod: M }), t(language, 'shortcuts.d.zoom')], [`${M} + / − / 0`, t(language, 'shortcuts.d.zoomSteps')], [t(language, 'shortcuts.k.wheel'), t(language, 'shortcuts.d.scroll')], [t(language, 'shortcuts.k.spaceDrag'), t(language, 'shortcuts.d.panView')], ['⇧ 1', t(language, 'shortcuts.d.fitAll')], ['⇧ 2', t(language, 'shortcuts.d.fitSelection')], ['⇧ 0', t(language, 'shortcuts.d.zoom100')], [`${M} \\`, t(language, 'shortcuts.d.togglePanels')]]],
  [t(language, 'shortcuts.sectionTransform'), [['⇧', t(language, 'shortcuts.d.keepRatio')], ['Alt', t(language, 'shortcuts.d.fromCenter')], [`${M}`, t(language, 'shortcuts.d.noSnap')]]],
  [t(language, 'shortcuts.sectionSelection'), [[t(language, 'shortcuts.k.modClick', { mod: M }), t(language, 'shortcuts.d.selectThroughGroups')], [t(language, 'shortcuts.k.shiftClick'), t(language, 'shortcuts.d.toggleSelection')], [t(language, 'shortcuts.k.doubleClick'), t(language, 'shortcuts.d.enterGroupEditText')], [t(language, 'shortcuts.k.altMouse'), t(language, 'shortcuts.d.showDistances')], [`${M} Alt C / V`, t(language, 'shortcuts.d.copyPasteProps')]]],
  [t(language, 'shortcuts.sectionOther'), [[`${M} ⇧ C`, t(language, 'shortcuts.d.copyCss')], [`${M} Alt Enter`, t(language, 'shortcuts.d.present')], [`${M} ,`, t(language, 'shortcuts.d.settings')], ['?', t(language, 'shortcuts.d.thisHelp')]]],
];

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row"><h3 className="grow">{title}</h3><button className="btn ghost icon" aria-label={tl('ui.dialogs.close')} onClick={onClose}><Icon name="close" size={16} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function HelpDialog() {
  const open = useApp((s) => s.help);
  const language = useApp((s) => s.language);
  useEffect(() => {
    const on = () => app.set({ help: !app.get().help });
    window.addEventListener('stylo:help', on);
    return () => window.removeEventListener('stylo:help', on);
  }, []);
  if (!open) return null;
  return (
    <Modal title={t(language, 'ui.dialogs.keyboardShortcuts')} wide onClose={() => app.set({ help: false })}>
      <div className="shortcuts">
        {shortcutGroups(language).map(([title, rows]) => (
          <section key={title}>
            <h4>{title}</h4>
            {rows.map(([k, d]) => <div className="sc-row" key={k + d}><kbd>{k}</kbd><span>{d}</span></div>)}
          </section>
        ))}
      </div>
    </Modal>
  );
}

export function SettingsDialog() {
  const open = useApp((s) => s.settings);
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const density = useApp((s) => s.density);
  const language = useApp((s) => s.language);
  const user = useApp((s) => s.user);
  const shortcuts = useMemo(() => ({ ...DEFAULT_SHORTCUTS, ...(user?.preferences?.shortcuts || {}) }), [user?.preferences?.shortcuts]);
  const rulers = useApp((s) => s.rulers);
  const guides = useApp((s) => s.guides);
  const doc = useApp((s) => s.doc);
  const tr = (key: string) => t(language, key);
  const [site, setSite] = useState({ title: '', description: '', lang: 'pt-BR', canonical: '', image: '', favicon: '' });
  useEffect(() => {
    const on = () => app.set({ settings: true });
    window.addEventListener('stylo:settings', on);
    return () => window.removeEventListener('stylo:settings', on);
  }, []);
  useEffect(() => {
    const value = (doc as any)?.site || {};
    setSite({ title: String(value.title || ''), description: String(value.description || ''), lang: String(value.lang || 'pt-BR'), canonical: String(value.canonical || ''), image: String(value.image || ''), favicon: String(value.favicon || '') });
  }, [doc]);
  if (!open) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(connectCommand()); toast('ok', t(language, 'ui.dialogs.commandCopied')); } catch { toast('error', t(language, 'ui.dialogs.copyManually')); } };
  return (
    <Modal title={tr('settings.title')} onClose={() => app.set({ settings: false })}>
      <div className="settings">
        <h4>{tr('settings.appearance')}</h4>
        <div className="segmented wide">
          {([['light', t(language, 'ui.appearance.light')], ['dark', t(language, 'ui.appearance.dark')], ['system', t(language, 'ui.appearance.system')]] as [Theme, string][]).map(([v, l]) => <button key={v} className={theme === v ? 'on' : ''} onClick={() => { setTheme(v); persistAccountPreferences({ theme: v }); }}>{l}</button>)}
        </div>
        <div className="swatches">{ACCENTS.map((c) => <button key={c} className={`swatch${accent === c ? ' on' : ''}`} style={{ background: c }} aria-label={`${t(language, 'ui.appearance.accent')} ${c}`} onClick={() => { setAccent(c); persistAccountPreferences({ accent: c }); }}>{accent === c && <Icon name="check" size={13} />}</button>)}</div>
        <p className="hint">{t(language, 'ui.dialogs.appearanceHint')}</p>
        <label className="small">{t(language, 'ui.dialogs.interfaceDensity')}<select className="field" value={density} onChange={(e) => { const v = e.target.value as Density; setDensity(v); persistAccountPreferences({ density: v }); }}><option value="comfortable">{tr('settings.comfortable')}</option><option value="compact">{tr('settings.compact')}</option></select></label>
        <label className="small">{tr('settings.language')}<select className="field" value={language} onChange={(e) => { const v = e.target.value as Language; setLanguage(v); persistAccountPreferences({ language: v }); }}>{SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <h4>{tr('settings.shortcuts')}</h4>
        <p className="hint">{t(language, 'ui.dialogs.shortcutsHint')}</p>
        <div className="shortcut-grid">{(['move', 'frame', 'rect', 'ellipse', 'text', 'hand', 'comment', 'inspect'] as const).map((name) => <label className="small" key={name}>{tr(`tool.${name}`).replace(/ \(.*\)$/, '')}<input className="field" maxLength={1} value={shortcuts[name]} onChange={(e) => { const value = e.target.value.toLowerCase().replace(/[^a-z]/g, ''); if (!value) return; const taken = Object.entries(shortcuts).find(([other, key]) => other !== name && key === value); if (taken) { toast('error', t(language, 'ui.dialogs.keyTaken', { key: value.toUpperCase(), action: tr(`tool.${taken[0]}`).replace(/ \(.*\)$/, '') })); return; } persistAccountPreferences({ shortcuts: { ...(shortcuts || {}), [name]: value } }); }} /></label>)}</div>

        <h4>{tr('settings.canvas')}</h4>
        <label className="check"><input type="checkbox" checked={rulers} onChange={(e) => setRulers(e.target.checked)} /><span>{tr('settings.rulers')} ({M}+R)</span></label>
        <label className="check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /><span>{tr('settings.guides')}</span></label>

        <h4>{tr('settings.metadata')}</h4>
        <p className="hint">{t(language, 'ui.dialogs.metadataHint')}</p>
        <label className="small">{t(language, 'ui.dialogs.pageTitle')}<input className="field" value={site.title} maxLength={160} onChange={(e) => setSite((x) => ({ ...x, title: e.target.value }))} /></label>
        <label className="small">{t(language, 'ui.dialogs.description')}<input className="field" value={site.description} maxLength={320} onChange={(e) => setSite((x) => ({ ...x, description: e.target.value }))} /></label>
        <label className="small">{t(language, 'ui.dialogs.publishedSiteLanguage')}<select className="field" value={site.lang} onChange={(e) => setSite((x) => ({ ...x, lang: e.target.value }))}>{SITE_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="small">{t(language, 'ui.dialogs.canonicalUrl')}<input className="field" type="url" placeholder={t(language, 'ui.dialogs.exampleUrl')} value={site.canonical} onChange={(e) => setSite((x) => ({ ...x, canonical: e.target.value }))} /></label>
        <label className="small">{t(language, 'ui.dialogs.ogImage')}<input className="field" type="url" placeholder={t(language, 'ui.dialogs.exampleOg')} value={site.image} onChange={(e) => setSite((x) => ({ ...x, image: e.target.value }))} /></label>
        <label className="small">{t(language, 'ui.dialogs.favicon')}<input className="field" value={site.favicon} placeholder={t(language, 'ui.dialogs.exampleFavicon')} onChange={(e) => setSite((x) => ({ ...x, favicon: e.target.value }))} /></label>
        <button className="btn primary" onClick={async () => { const out = await run('set_site_metadata', { ...site }); if (out) toast('ok', t(language, 'ui.dialogs.siteMetadataSaved')); }}>{tr('settings.saveMetadata')}</button>

        <h4>{t(language, 'ui.dialogs.connectAgent')}</h4>
        <div className="codebox"><code>{connectCommand()}</code><button className="btn ghost icon sm" title={t(language, 'ui.dialogs.copy')} onClick={() => void copy()}><Icon name="copy" size={14} /></button></div>
        <p className="hint">{t(language, 'ui.dialogs.connectHint')}</p>

        {user && <><h4>{t(language, 'ui.dialogs.account')}</h4><p>{user.name} · {user.email}</p></>}
      </div>
    </Modal>
  );
}
