// Janelas do editor: ajuda (atalhos de teclado) e configurações (aparência, canvas, conexão do agente, conta).
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ACCENTS, app, setAccent, setGuides, setRulers, setTheme, toast, useApp, type Theme } from '../lib/app';
import { connectCommand } from './Panels';
import { Icon } from '../ui/Icon';

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
  const rulers = useApp((s) => s.rulers);
  const guides = useApp((s) => s.guides);
  const user = useApp((s) => s.user);
  useEffect(() => {
    const on = () => app.set({ settings: true });
    window.addEventListener('stylo:settings', on);
    return () => window.removeEventListener('stylo:settings', on);
  }, []);
  if (!open) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(connectCommand()); toast('ok', 'Comando copiado.'); } catch { toast('error', 'Selecione o texto e copie com Ctrl+C.'); } };
  return (
    <Modal title="Configurações" onClose={() => app.set({ settings: false })}>
      <div className="settings">
        <h4>Aparência</h4>
        <div className="segmented wide">
          {([['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']] as [Theme, string][]).map(([v, l]) => <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>)}
        </div>
        <div className="swatches">{ACCENTS.map((c) => <button key={c} className={`swatch${accent === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Destaque ${c}`} onClick={() => setAccent(c)}>{accent === c && <Icon name="check" size={13} />}</button>)}</div>
        <p className="hint">A aparência é uma preferência sua: não muda o projeto.</p>

        <h4>Canvas</h4>
        <label className="check"><input type="checkbox" checked={rulers} onChange={(e) => setRulers(e.target.checked)} /><span>Mostrar réguas ({M}+R)</span></label>
        <label className="check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /><span>Mostrar e encaixar nas guias</span></label>

        <h4>Conectar um agente de IA</h4>
        <div className="codebox"><code>{connectCommand()}</code><button className="btn ghost icon sm" title="Copiar" onClick={() => void copy()}><Icon name="copy" size={14} /></button></div>
        <p className="hint">Qualquer agente que fale MCP (Claude Code, Codex, Cursor…) trabalha neste projeto, ao mesmo tempo que você.</p>

        {user && <><h4>Conta</h4><p>{user.name} · {user.email}</p></>}
      </div>
    </Modal>
  );
}
