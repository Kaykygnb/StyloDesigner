// Janelas do editor: ajuda (atalhos de teclado) e configurações (aparência, canvas, conexão do agente, conta).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACCENTS, app, DEFAULT_SHORTCUTS, persistAccountPreferences, run, setAccent, setDensity, setGuides, setLanguage, setRulers, setTheme, toast, useApp, type Density, type Language, type Theme } from '../lib/app';
import { connectCommand } from './Panels';
import { Icon } from '../ui/Icon';
import { t } from '../lib/i18n';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const M = MAC ? '⌘' : 'Ctrl';

/** [seção, [[tecla, descrição]]]: o mesmo conjunto do editor antigo, ajustado ao que o painel novo tem. */
const SHORTCUTS: [string, [string, string][]][] = [
  ['Ferramentas', [['V', 'Mover'], ['F / B', 'Frame'], ['⇧ S', 'Seção'], ['R', 'Retângulo'], ['E', 'Elipse'], ['L', 'Linha'], ['T', 'Texto'], ['⇧ E', 'Código HTML (escrito à mão)'], ['C', 'Comentar'], ['I', 'Inspecionar (como o F12)'], ['H', 'Mão (ou segure Espaço)']]],
  ['Edição', [[`${M} Z / ${M} ⇧ Z`, 'Desfazer / Refazer'], [`${M} D`, 'Duplicar'], ['Alt + arrastar', 'Duplicar arrastando'], [`${M} C / X / V`, 'Copiar / Recortar / Colar'], [`${M} A`, 'Selecionar tudo no mesmo nível'], [`${M} G / ${M} ⇧ G`, 'Agrupar / Desagrupar'], [`${M} Alt G`, 'Envolver em frame'], [`${M} Alt K / B`, 'Criar componente / Desanexar'], [`${M} Alt M`, 'Máscara'], ['⇧ H / ⇧ V', 'Espelhar'], ['0–9', 'Opacidade (1 = 10% … 0 = 100%)'], ['⇧ A', 'Auto layout (flexbox)'], ['Delete', 'Excluir'], ['Setas (⇧ = 10px)', 'Mover']]],
  ['Camadas', [[`${M} ] / [`, 'Avançar / Recuar'], [`${M} ⇧ ] / [`, 'Frente / Fundo'], [`${M} ⇧ L`, 'Travar'], [`${M} ⇧ H`, 'Ocultar'], ['F2', 'Renomear'], ['Enter / ⇧ Enter', 'Entrar / sair do grupo'], ['Tab / ⇧ Tab', 'Próxima / anterior camada']]],
  ['Vista', [[`${M} R`, 'Réguas (arraste delas para criar guias)'], [`${M} + roda`, 'Zoom'], [`${M} + / − / 0`, 'Aproximar / afastar / 100%'], ['Roda / ⇧ roda', 'Rolar'], ['Espaço + arrastar', 'Mover a vista'], ['⇧ 1', 'Ajustar tudo'], ['⇧ 2', 'Ajustar seleção'], ['⇧ 0', 'Zoom 100%'], [`${M} \\`, 'Esconder/mostrar painéis']]],
  ['Ao mover / redimensionar', [['⇧', 'Mantém a proporção / trava o eixo'], ['Alt', 'A partir do centro'], [`${M}`, 'Sem encaixe (snap)']]],
  ['Seleção', [[`${M} + clique`, 'Seleciona através de grupos'], ['⇧ + clique', 'Soma/tira da seleção'], ['Duplo clique', 'Entra no grupo · edita o texto'], ['Alt + mouse', 'Mostra distâncias até outra camada'], [`${M} Alt C / V`, 'Copiar / colar propriedades']]],
  ['Outros', [[`${M} ⇧ C`, 'Copiar CSS'], [`${M} Alt Enter`, 'Apresentar o protótipo'], [`${M} ,`, 'Configurações'], ['?', 'Esta ajuda']]],
];

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row"><h3 className="grow">{title}</h3><button className="btn ghost icon" aria-label="Fechar" onClick={onClose}><Icon name="close" size={16} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function HelpDialog() {
  const open = useApp((s) => s.help);
  useEffect(() => {
    const on = () => app.set({ help: !app.get().help });
    window.addEventListener('stylo:help', on);
    return () => window.removeEventListener('stylo:help', on);
  }, []);
  if (!open) return null;
  return (
    <Modal title="Atalhos de teclado" wide onClose={() => app.set({ help: false })}>
      <div className="shortcuts">
        {SHORTCUTS.map(([title, rows]) => (
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
  const copy = async () => { try { await navigator.clipboard.writeText(connectCommand()); toast('ok', 'Comando copiado.'); } catch { toast('error', 'Selecione o texto e copie com Ctrl+C.'); } };
  return (
    <Modal title={tr('settings.title')} onClose={() => app.set({ settings: false })}>
      <div className="settings">
        <h4>{tr('settings.appearance')}</h4>
        <div className="segmented wide">
          {([['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']] as [Theme, string][]).map(([v, l]) => <button key={v} className={theme === v ? 'on' : ''} onClick={() => { setTheme(v); persistAccountPreferences({ theme: v }); }}>{l}</button>)}
        </div>
        <div className="swatches">{ACCENTS.map((c) => <button key={c} className={`swatch${accent === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Destaque ${c}`} onClick={() => { setAccent(c); persistAccountPreferences({ accent: c }); }}>{accent === c && <Icon name="check" size={13} />}</button>)}</div>
        <p className="hint">A aparência é uma preferência sua: não muda o projeto.</p>
        <label className="small">{language === 'en-US' ? 'Interface density' : 'Densidade da interface'}<select className="field" value={density} onChange={(e) => { const v = e.target.value as Density; setDensity(v); persistAccountPreferences({ density: v }); }}><option value="comfortable">{tr('settings.comfortable')}</option><option value="compact">{tr('settings.compact')}</option></select></label>
        <label className="small">{tr('settings.language')}<select className="field" value={language} onChange={(e) => { const v = e.target.value as Language; setLanguage(v); persistAccountPreferences({ language: v }); }}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English</option></select></label>
        <h4>{tr('settings.shortcuts')}</h4>
        <p className="hint">Use uma única tecla por ação. As mudanças são salvas na sua conta.</p>
        <div className="shortcut-grid">{(['move', 'frame', 'rect', 'ellipse', 'text', 'hand', 'comment', 'inspect'] as const).map((name) => <label className="small" key={name}>{tr(`tool.${name}`).replace(/ \(.*\)$/, '')}<input className="field" maxLength={1} value={shortcuts[name]} onChange={(e) => { const value = e.target.value.toLowerCase().replace(/[^a-z]/g, ''); if (!value) return; const taken = Object.entries(shortcuts).find(([other, key]) => other !== name && key === value); if (taken) { toast('error', `A tecla ${value.toUpperCase()} já é de “${tr(`tool.${taken[0]}`).replace(/ \(.*\)$/, '')}”.`); return; } persistAccountPreferences({ shortcuts: { ...(shortcuts || {}), [name]: value } }); }} /></label>)}</div>

        <h4>{tr('settings.canvas')}</h4>
        <label className="check"><input type="checkbox" checked={rulers} onChange={(e) => setRulers(e.target.checked)} /><span>{tr('settings.rulers')} ({M}+R)</span></label>
        <label className="check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /><span>{tr('settings.guides')}</span></label>

        <h4>{tr('settings.metadata')}</h4>
        <p className="hint">Esses dados entram no HTML publicado e no compartilhamento social. Deixe vazio o que não usar.</p>
        <label className="small">Título da página<input className="field" value={site.title} maxLength={160} onChange={(e) => setSite((x) => ({ ...x, title: e.target.value }))} /></label>
        <label className="small">Descrição<input className="field" value={site.description} maxLength={320} onChange={(e) => setSite((x) => ({ ...x, description: e.target.value }))} /></label>
        <label className="small">Idioma<select className="field" value={site.lang} onChange={(e) => setSite((x) => ({ ...x, lang: e.target.value }))}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English (US)</option><option value="es-ES">Español</option></select></label>
        <label className="small">URL canônica (HTTPS)<input className="field" type="url" placeholder="https://exemplo.com/" value={site.canonical} onChange={(e) => setSite((x) => ({ ...x, canonical: e.target.value }))} /></label>
        <label className="small">Imagem Open Graph (HTTPS)<input className="field" type="url" placeholder="https://exemplo.com/og.png" value={site.image} onChange={(e) => setSite((x) => ({ ...x, image: e.target.value }))} /></label>
        <label className="small">Favicon (HTTPS ou asset local)<input className="field" value={site.favicon} placeholder="https://exemplo.com/favicon.png" onChange={(e) => setSite((x) => ({ ...x, favicon: e.target.value }))} /></label>
        <button className="btn primary" onClick={async () => { const out = await run('set_site_metadata', { ...site }); if (out) toast('ok', language === 'en-US' ? 'Site metadata saved.' : 'Metadados do site salvos.'); }}>{tr('settings.saveMetadata')}</button>

        <h4>Conectar um agente de IA</h4>
        <div className="codebox"><code>{connectCommand()}</code><button className="btn ghost icon sm" title="Copiar" onClick={() => void copy()}><Icon name="copy" size={14} /></button></div>
        <p className="hint">Qualquer agente que fale MCP (Claude Code, Codex, Cursor…) trabalha neste projeto, ao mesmo tempo que você.</p>

        {user && <><h4>Conta</h4><p>{user.name} · {user.email}</p></>}
      </div>
    </Modal>
  );
}
