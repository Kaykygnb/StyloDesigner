/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/settings.js — JANELA "CONFIGURAÇÕES" (onde salvar, versões, cópia no navegador, aparência)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Aberta pela engrenagem do topo, por Arquivo → Configurações ou Ctrl+, (vírgula).
 *  Seções:
 *   1. Pasta de projetos  — caminho no computador (o SERVIDOR grava lá), auto-salvar e nº de versões.
 *      Explica como usar Google Drive/OneDrive/Dropbox: escolher uma pasta sincronizada por eles.
 *   2. Cópia no navegador — sempre ligada (IndexedDB); mostra o espaço e pede proteção contra limpeza.
 *   3. Assistente de IA e MCP — chave/modelo/endereço da API (OpenAI ou compatível) e como ligar o Claude Code/Codex.
 *   4. Aparência e controles — tema, tela ao abrir o app (página inicial ou editor) e o que a roda do mouse faz.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openModal } from './menus.js';
import { browserUsage, requestPersistence, folder } from '../storage.js';
import { PROVIDERS } from '../agent/providers.js';

/** "12345678" bytes → "11,8 MB". */
export const formatBytes = (b) =>
  b == null ? '?' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Caixa de seleção no estilo do app (a mesma de props.js). */
const checkbox = (label, checked, onchange) => {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onchange(input.checked) });
  return h('label.check', input, h('span.box', ico('check', 10)), h('span', label));
};

/**
 * Abre a janela de Configurações.
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.saving   ver saving.js (refresh, server)
 * @param {object} deps.prefs    preferências (autoFolder, wheelMode)
 * @param {() => void} deps.savePrefs
 * @param {(m: string) => void} deps.toast
 */
export function openSettings({ store, saving, prefs, savePrefs, toast }) {
  const ui = store.ui;
  const body = h('div.modal-body.settings');
  const { close } = openModal({ title: 'Configurações', body, cls: 'narrow' });

  /** Redesenha o conteúdo (chamado ao abrir e depois de cada mudança que o servidor confirma). */
  async function render() {
    const server = await saving.refresh();
    const usage = await browserUsage();
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    const ai = server ? await fetch('/api/agent/config').then((r) => r.json()).catch(() => null) : null;
    body.replaceChildren(folderSection(server), browserSection(usage, persisted), aiSection(ai), lookSection());
  }

  // ---------------------------------------------------------------- 1. pasta
  function folderSection(server) {
    if (!server) {
      return h('section.set-section',
        h('h3', ico('folder', 15), ' Pasta de projetos'),
        h('p.set-status.off', '● Sem servidor'),
        h('p.muted', 'Para salvar numa pasta do seu computador, abra o app com ', h('code', 'npm start'),
          ' (o servidor do projeto). Do jeito que está, o projeto fica só no navegador, e "Salvar" baixa um arquivo .json.'));
    }
    const pathInput = h('input.text.mono', { type: 'text', value: server.folder, spellcheck: false, 'aria-label': 'Caminho da pasta de projetos' });
    const msg = h('p.set-msg', { role: 'status' });
    const apply = h('button.btn', {
      type: 'button',
      onclick: async () => {
        apply.disabled = true;
        msg.className = 'set-msg';
        msg.textContent = 'Verificando a pasta…';
        try {
          await folder.setConfig({ folder: pathInput.value });
          // o projeto aberto estava ligado a um arquivo da pasta ANTIGA: desliga (senão gravaria um arquivo com o mesmo
          // nome na pasta nova sem você pedir). Ele continua salvo no navegador; use Ctrl+S para pôr na pasta nova.
          if (ui.link) store.setLink(null);
          toast('Pasta de projetos alterada.');
          render();
        } catch (err) {
          msg.className = 'set-msg error';
          msg.textContent = err.message || 'Não consegui usar essa pasta.';
          apply.disabled = false;
        }
      },
    }, 'Usar esta pasta');
    pathInput.addEventListener('keydown', (e) => e.key === 'Enter' && apply.click());

    const versions = h('input.text', { type: 'number', min: 0, max: 200, value: server.keepVersions, 'aria-label': 'Quantidade de versões guardadas', style: { width: '64px' } });
    versions.addEventListener('change', async () => {
      try {
        const r = await folder.setConfig({ keepVersions: Number(versions.value) });
        versions.value = r.keepVersions;
        toast(r.keepVersions ? `Guardando até ${r.keepVersions} versões por projeto.` : 'Versões antigas desligadas.');
      } catch (err) { toast(err.message); }
    });

    return h('section.set-section',
      h('h3', ico('folder', 15), ' Pasta de projetos'),
      h('p.set-status.on', '● Servidor conectado — projetos são gravados como arquivos .json nesta pasta:'),
      h('div.set-path', h('div.field', pathInput), apply),
      msg,
      h('p.muted.small', 'Caminho completo. Exemplos: ', h('code', 'C:\\Users\\voce\\Documents\\Designer'), ' · ',
        h('code', '/home/voce/Designer'), ' · ', h('code', '~/Designer'), '. A pasta é criada se não existir.'),
      h('div.set-tip',
        h('strong', 'Quer cópia na nuvem (Google Drive)?'),
        h('p', 'Instale o ', h('em', 'Google Drive para computador'), ' e escolha aqui uma pasta DENTRO dele (no Windows costuma ser ',
          h('code', 'G:\\Meu Drive\\Designer'), '). O próprio Drive sobe os arquivos para a nuvem; funciona igual com OneDrive e Dropbox.'),
        h('p.muted.small', 'Se abrir o mesmo projeto em dois computadores ao mesmo tempo, o editor percebe que o arquivo mudou e para de gravar nele em vez de apagar o trabalho do outro.')),
      h('div.set-row', checkbox('Salvar automaticamente na pasta enquanto edito', prefs.autoFolder !== false, (v) => {
        prefs.autoFolder = v;
        savePrefs();
        toast(v ? 'Auto-salvar na pasta ligado.' : 'Auto-salvar na pasta desligado: use Ctrl+S para gravar.');
      })),
      h('div.set-row', h('span', 'Guardar até'), h('div.field', versions), h('span', 'versões antigas de cada projeto')),
      h('p.muted.small', 'No máximo uma versão a cada 10 minutos de edição. Abra-as em Arquivo → Abrir da pasta → Versões. 0 = não guardar.'));
  }

  // ---------------------------------------------------------------- 2. navegador
  function browserSection(usage, persisted) {
    const protect = h('button.btn', {
      type: 'button', disabled: persisted,
      onclick: async () => {
        const ok = await requestPersistence();
        toast(ok ? 'Pronto: o navegador não vai apagar a cópia sozinho.' : 'O navegador recusou (ele decide com base no uso do site).');
        render();
      },
    }, persisted ? 'Protegida' : 'Proteger contra limpeza automática');
    return h('section.set-section',
      h('h3', ico('layers', 15), ' Cópia no navegador'),
      h('p', 'Sempre ligada. A cada mudança o projeto aberto é guardado no navegador (', usage.engine, '), mesmo sem servidor. ',
        usage.usage != null ? `Usando ${formatBytes(usage.usage)}.` : ''),
      h('p.muted.small', 'Ela some se você limpar os dados do site ou trocar de navegador. Para guardar de verdade, use a pasta acima.'),
      h('div.set-row', protect));
  }

  // ---------------------------------------------------------------- 3. assistente de IA e MCP
  function aiSection(ai) {
    if (!ai) {
      return h('section.set-section',
        h('h3', ico('sparkle', 15), ' Assistente de IA e MCP'),
        h('p.muted', 'Precisa do servidor do app (', h('code', 'npm start'), '): é ele que guarda a chave e conversa com a IA.'));
    }
    const msg = h('p.set-msg', { role: 'status' });
    const prov = PROVIDERS.find((x) => x.id === ai.provider) || null;
    /** Grava no servidor e redesenha (a chave só vai quando você digita uma nova). */
    const save = async (patch, done = 'Assistente configurado.') => {
      try {
        const r = await fetch('/api/agent/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        toast(done);
        render();
      } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message || 'Não consegui salvar.'; }
    };
    // PROVEDOR: escolher um já grava endereço e modelo sugerido (a chave de cada provedor fica guardada separada)
    const provSel = h('select.select', { 'aria-label': 'Provedor de IA' },
      ...PROVIDERS.map((x) => h('option', { value: x.id, selected: ai.provider === x.id }, x.name)),
      h('option', { value: 'custom', selected: ai.provider === 'custom' }, 'Outro (compatível com a OpenAI)'));
    provSel.addEventListener('change', () => {
      const x = PROVIDERS.find((p) => p.id === provSel.value);
      if (x) save({ baseUrl: x.baseUrl, model: x.model }, `Provedor: ${x.name}.`);
      else { base.focus(); base.select(); }
    });
    const key = h('input.text.mono', { type: 'password', placeholder: ai.hasKey ? '•••••••• (chave salva)' : prov?.keyHint || 'chave da API', autocomplete: 'off', spellcheck: false, 'aria-label': 'Chave da API' });
    const model = h('input.text.mono', { type: 'text', value: ai.model, spellcheck: false, 'aria-label': 'Modelo' });
    const base = h('input.text.mono', { type: 'text', value: ai.baseUrl, spellcheck: false, 'aria-label': 'Endereço da API' });
    const saveBtn = h('button.btn.primary', { type: 'button', onclick: () => save({ model: model.value, baseUrl: base.value, ...(key.value.trim() ? { apiKey: key.value.trim() } : {}) }) }, 'Salvar');
    const forget = ai.hasKey ? h('button.btn', { type: 'button', onclick: () => save({ apiKey: '' }, 'Chave apagada.') }, 'Apagar chave') : null;
    /** Grava sem redesenhar a janela (para não sumir com a lista de modelos aberta). */
    const putConfig = async (patch) => {
      const r = await fetch('/api/agent/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      return data;
    };
    // LISTA DE MODELOS (aparece depois de "Ver modelos"): busca + lista clicável. Uma lista de verdade, e não o
    // <datalist> do navegador, que só mostra o que combina com o texto já escrito no campo (escondia quase tudo).
    const picker = h('div.model-picker', { hidden: true });
    function showPicker(list) {
      const search = h('input.text', { type: 'search', placeholder: `Buscar entre ${list.length} modelos… (ex.: llama, qwen, deepseek)`, 'aria-label': 'Buscar modelo', spellcheck: false });
      const box = h('div.model-list', { role: 'listbox', 'aria-label': 'Modelos disponíveis' });
      const fill = () => {
        const q = search.value.trim().toLowerCase();
        const shown = list.filter((m) => !q || m.toLowerCase().includes(q));
        box.replaceChildren(...shown.slice(0, 300).map((m) => h('button.model-item' + (m === model.value ? '.on' : ''), {
          type: 'button', role: 'option', 'aria-selected': String(m === model.value),
          onclick: async () => {
            try {
              await putConfig({ model: m });
              model.value = m;
              msg.className = 'set-msg';
              msg.textContent = `Modelo escolhido: ${m}. Lembre: ele precisa aceitar ferramentas ("tool calling") para mexer no design.`;
              toast('Modelo salvo.');
              fill();
            } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message; }
          },
        }, m)), ...(shown.length ? [] : [h('p.muted.small', 'Nenhum modelo com esse nome.')])); // nada de null: replaceChildren escreveria "null"
      };
      search.addEventListener('input', fill);
      picker.replaceChildren(h('div.field', search), box);
      picker.hidden = false;
      fill();
      search.focus();
    }
    // VER MODELOS: grava antes o que foi digitado (endereço e chave nova), pergunta à API quais modelos a conta tem
    // e mostra a lista. De quebra, testa a chave.
    const listBtn = h('button.btn', {
      type: 'button',
      onclick: async () => {
        listBtn.disabled = true;
        msg.className = 'set-msg';
        msg.textContent = 'Consultando os modelos…';
        try {
          const typed = key.value.trim();
          await putConfig({ baseUrl: base.value, ...(typed ? { apiKey: typed } : {}) });
          if (typed) { key.value = ''; key.placeholder = '•••••••• (chave salva)'; }
          const r = await fetch('/api/agent/models');
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          if (!data.models.length) throw new Error('A API não devolveu nenhum modelo.');
          msg.textContent = `A chave funciona: ${data.models.length} modelos. Clique em um para escolher.`;
          showPicker(data.models);
        } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message || 'Não consegui listar os modelos.'; }
        listBtn.disabled = false;
      },
    }, 'Ver modelos');
    const copy = (text) => h('button.btn.small', { type: 'button', onclick: () => navigator.clipboard?.writeText(text).then(() => toast('Copiado.')) }, 'Copiar');
    const cmd = (label, text) => h('div.set-cmd', h('span.set-label', label), h('code', text), copy(text));
    return h('section.set-section',
      h('h3', ico('sparkle', 15), ' Assistente de IA e MCP'),
      h('p', 'O ', h('strong', 'Assistente'), ' (botão ', ico('sparkle', 12), ' no topo) conversa com a IA usando a ', h('strong', 'sua'),
        ' chave. Ela fica guardada só neste computador, no arquivo de configuração do servidor, e nunca vai para o projeto.'),
      h('div.set-row', h('span.set-label', 'Provedor'), h('div.field.select-wrap', provSel, ico('chevron', 12))),
      h('div.set-row', h('span.set-label', 'Chave da API'), h('div.field.grow', key), forget),
      h('div.set-row', h('span.set-label', 'Modelo'), h('div.field.grow', model), listBtn),
      picker,
      h('div.set-row', h('span.set-label', 'Endereço da API'), h('div.field.grow', base)),
      h('div.set-row', saveBtn),
      msg,
      prov ? h('p.muted.small', `Chave em ${prov.keyUrl}. ${prov.note}`) : h('p.muted.small', 'Qualquer servidor compatível com a API da OpenAI (Chat Completions com ferramentas) funciona: LM Studio, OpenRouter, Groq...'),
      h('p.muted.small', 'O que a IA sabe sobre a ferramenta e como ela deve trabalhar está no arquivo ', h('code', ai.instructions || 'docs/AGENTE.md'),
        '. Edite à vontade: vale na próxima mensagem.'),
      h('div.set-tip',
        h('strong', 'MCP: ligar o Claude Code, o Codex ou o Claude Desktop'),
        h('p', 'Com o app aberto no navegador, esses programas conseguem ler e alterar o design (cada alteração passa pela sua permissão aqui). ',
          ai.editors ? h('span.set-badge.on', `● ${ai.editors} editor${ai.editors > 1 ? 'es' : ''} conectado${ai.editors > 1 ? 's' : ''}`) : h('span.set-badge.off', '● nenhum editor conectado')),
        // ACESSO DE ADMINISTRADOR: programas deste computador agem sem perguntar e mexem nos arquivos de projeto
        h('div.set-row', checkbox('Acesso de administrador: o MCP altera sem perguntar e pode abrir, salvar e criar projetos', !!ai.mcpAdmin, async (v) => {
          try {
            const r = await fetch('/api/agent/mcp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin: v }) });
            if (!r.ok) throw new Error((await r.json()).error);
            toast(v ? 'MCP com acesso de administrador.' : 'MCP volta a pedir permissão a cada alteração.');
          } catch (err) { toast(err.message || 'Não consegui salvar.'); }
        })),
        h('p.muted.small', 'Só vale para programas deste computador (o endereço do MCP não aceita pedidos de fora). Tudo continua saindo com Ctrl+Z, e um aviso mostra cada alteração.'),
        cmd('Plugin do Claude Code', `/plugin marketplace add Kaykygnb/projetodesigner2`),
        cmd('', `/plugin install projeto-designer@projeto-designer`),
        cmd('Claude Code (sem plugin)', `claude mcp add --transport http designer ${ai.mcpUrl}`),
        cmd('Codex / Claude Desktop', `node "${ai.mcpScript}"`),
        h('p.muted.small', 'Guia completo (Claude, Codex/GPT e ChatGPT): ', h('code', 'docs/MCP.md'), '. No Codex: em ', h('code', '~/.codex/config.toml'), ' crie ', h('code', '[mcp_servers.designer]'), ' com ', h('code', 'command = "node"'), ' e ',
          h('code', `args = ["${ai.mcpScript.replace(/\\/g, '\\\\')}"]`), '. No Claude Desktop: Configurações → Desenvolvedor → Editar configuração, em ', h('code', 'mcpServers'), '.')));
  }

  // ---------------------------------------------------------------- 4. aparência
  function lookSection() {
    const opt = (group, value, label, current, onPick) =>
      h('label.set-radio', h('input', { type: 'radio', name: group, value, checked: current === value, onchange: () => onPick(value) }), h('span', label));
    return h('section.set-section',
      h('h3', ico('sliders', 15), ' Aparência e controles'),
      h('div.set-row', { role: 'radiogroup', 'aria-label': 'Tema' }, h('span.set-label', 'Tema'),
        opt('theme', 'dark', 'Escuro', ui.theme, (v) => store.setTheme(v)),
        opt('theme', 'light', 'Claro', ui.theme, (v) => store.setTheme(v))),
      h('div.set-row', h('span.set-label', 'Seu nome nos comentários'),
        (() => {
          const input = h('input.text', { type: 'text', value: prefs.author || '', placeholder: 'Eu', maxLength: 40, spellcheck: false, 'aria-label': 'Seu nome nos comentários' });
          input.addEventListener('change', () => { prefs.author = input.value.trim().slice(0, 40); savePrefs(); toast('Nome atualizado.'); });
          return h('div.field', { style: { maxWidth: '220px' } }, input);
        })()),
      h('div.set-row', { role: 'radiogroup', 'aria-label': 'Ao abrir o app' }, h('span.set-label', 'Ao abrir o app'),
        opt('start', 'home', 'Mostrar a página inicial', prefs.startScreen || 'home', (v) => { prefs.startScreen = v; savePrefs(); }),
        opt('start', 'editor', 'Ir direto para o editor', prefs.startScreen || 'home', (v) => { prefs.startScreen = v; savePrefs(); })),
      h('div.set-row', { role: 'radiogroup', 'aria-label': 'Roda do mouse' }, h('span.set-label', 'Roda do mouse'),
        opt('wheel', 'pan', 'Rola o canvas (Ctrl + roda = zoom)', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); }),
        opt('wheel', 'zoom', 'Dá zoom', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); })));
  }

  body.append(h('p.muted', 'Carregando…'));
  render();
  return { close };
}
