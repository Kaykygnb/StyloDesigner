/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/layers.js — PAINEL DE PÁGINAS E CAMADAS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { nodeIcon } from './icons.js';
import { isContainer } from '../model.js';
import { showMenu } from './menus.js';

/**
 * Cria o painel de CAMADAS (aba esquerda): lista de páginas + árvore de camadas.
 *
 * Na árvore, a camada MAIS À FRENTE aparece no TOPO (a lista é o array de trás para a frente). Cada linha tem: setinha
 * (abrir/fechar), ícone, nome (duplo clique renomeia), cadeado e olho. Dá para ARRASTAR linhas para reordenar ou
 * aninhar (soltar no meio de um frame coloca dentro dele; na borda de cima/baixo põe antes/depois).
 *
 * @param {{store, commands, container: HTMLElement}} deps
 */
export function createLayersPanel({ store, commands, container }) {
  const ui = store.ui;
  // pagesBox: lista de páginas · tree: árvore de camadas · search: caixa de busca por nome
  const pagesBox = h('div.pages');
  const tree = h('div.layer-tree');
  const search = h('input', { placeholder: 'Buscar camadas…', spellcheck: false });
  search.addEventListener('input', () => { ui.layerQuery = search.value.trim().toLowerCase(); store.emit('ui'); });
  container.append(
    h('section.panel-section.pages-section',
      h('header.section-head', h('span', 'Páginas'),
        iconButton('plus', 'Nova página', () => store.addPage(), 'small')),
      pagesBox),
    h('section.panel-section.layers-section',
      h('header.section-head', h('span', 'Camadas')),
      h('label.layer-search', ico('search', 13), search),
      tree),
  );

  // --------------------------------------------------------------- páginas
  /**
   * Desenha a lista de páginas. Clique abre; duplo clique renomeia; botão direito abre o menu (renomear, duplicar,
   * excluir). A última página não pode ser excluída (todo projeto tem ao menos uma).
   */
  function renderPages() {
    pagesBox.replaceChildren(
      ...store.state.doc.pages.map((p) => {
        const rename = () => {
          const name = prompt('Nome da página:', p.name);
          if (name?.trim()) { p.name = name.trim(); store.commit(); }
        };
        const remove = () => {
          if (!confirm(`Excluir a página "${p.name}"?`)) return;
          const doc = store.state.doc;
          doc.pages.splice(doc.pages.indexOf(p), 1);
          store.switchPage(doc.pages[0].id);
          store.commit();
        };
        const row = h('div.page-row' + (p.id === ui.pageId ? '.active' : ''), {
          onclick: () => store.switchPage(p.id),
          ondblclick: rename,
          oncontextmenu: (e) => {
            e.preventDefault();
            showMenu(e.clientX, e.clientY, [
              { label: 'Renomear', onClick: rename },
              { label: 'Duplicar página', icon: 'copy', onClick: () => store.duplicatePage(p.id) },
              'sep',
              { label: 'Excluir', icon: 'trash', danger: true, disabled: store.state.doc.pages.length < 2, onClick: remove },
            ]);
          },
        }, ico('page', 14), h('span.page-name', p.name),
        store.state.doc.pages.length > 1
          ? h('button.icon-btn.small.row-action', {
            title: 'Excluir página',
            onclick: (e) => { e.stopPropagation(); remove(); },
          }, ico('x', 12))
          : null);
        return row;
      }),
    );
  }

  // --------------------------------------------------------------- árvore
  /**
   * Abre as pastas que contêm as camadas selecionadas, para que a seleção fique visível na lista. Devolve true se algo mudou.
   * (Guardamos `false` explicitamente: o padrão de "fechado" só vale para pastas nunca abertas.)
   */
  function expandAncestors(ids) {
    let changed = false;
    for (const id of ids) {
      for (let p = store.parentOf(id); p; p = store.parentOf(p.id)) {
        if (ui.collapsed[p.id] !== false) { ui.collapsed[p.id] = false; changed = true; }
      }
    }
    return changed;
  }

  /** Camadas dentro de frames começam FECHADAS (só os níveis de cima aparecem); selecionar abre o caminho. `ui.collapsed[id]` tem prioridade. */
  const isCollapsed = (node, depth) => ui.collapsed[node.id] ?? depth >= 1;

  /**
   * Cria a linha de UMA camada (com todos os ouvintes: seleção, renomear, menu, arrastar e soltar).
   * @param {object} node  a camada
   * @param {number} depth  nível de aninhamento (recuo de 14px por nível)
   */
  function rowFor(node, depth) {
    const selected = ui.selection.includes(node.id);
    const hasKids = isContainer(node) && node.children.length > 0;
    const collapsed = isCollapsed(node, depth);

    // nome: texto normal ou, durante a renomeação (F2 / duplo clique), um campo de edição. Enter/blur confirma; Esc cancela.
    const nameEl = ui.renamingId === node.id
      ? (() => {
        const input = h('input.rename', { value: node.name, spellcheck: false });
        const done = (ok) => {
          if (ui.renamingId !== node.id) return;
          ui.renamingId = null;
          if (ok && input.value.trim()) {
            store.update(() => { node.name = input.value.trim(); }, { commit: true });
          } else store.emit('doc');
        };
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') done(true);
          if (e.key === 'Escape') done(false);
        });
        input.addEventListener('blur', () => done(true));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        requestAnimationFrame(() => { input.focus(); input.select(); });
        return input;
      })()
      : h('span.layer-name', node.name);

    // a linha em si: arrastável (menos durante a renomeação), com recuo proporcional à profundidade
    const row = h('div.layer-row' +
      (selected ? '.selected' : '') + (!node.visible ? '.dim' : '') + (node.locked ? '.locked' : ''), {
      draggable: ui.renamingId !== node.id,
      dataset: { id: node.id },
      style: { paddingLeft: `${8 + depth * 14}px` },
    },
    h('button.twist' + (hasKids ? '' : '.empty') + (collapsed ? '' : '.open'), {
      type: 'button',
      onclick: (e) => {
        e.stopPropagation();
        if (e.altKey) setAll(node, collapsed ? false : true);
        else ui.collapsed[node.id] = !collapsed;
        store.emit('ui');
      },
    }, ico('chevron', 10)),
    h('span.layer-icon' + (node.component || node.instanceOf ? '.comp' : node.type === 'frame' && !store.parentOf(node.id) ? '.board' : ''),
      ico(node.component || node.instanceOf ? 'component' : nodeIcon(node.type), 14)),
    nameEl,
    h('span.row-actions',
      h('button.icon-btn.small' + (node.locked ? '.on' : ''), {
        type: 'button', title: node.locked ? 'Destravar' : 'Travar',
        onclick: (e) => { e.stopPropagation(); store.update(() => { node.locked = !node.locked; }, { commit: true }); },
      }, ico(node.locked ? 'lock' : 'unlock', 13)),
      h('button.icon-btn.small' + (!node.visible ? '.on' : ''), {
        type: 'button', title: node.visible ? 'Ocultar' : 'Mostrar',
        onclick: (e) => { e.stopPropagation(); store.update(() => { node.visible = !node.visible; }, { commit: true }); },
      }, ico(node.visible ? 'eye' : 'eyeOff', 13))),
    );

    // CLIQUE: Shift = intervalo (da âncora até aqui, na ordem visual) · Ctrl/⌘ = alterna na seleção · normal = seleciona só esta
    row.addEventListener('click', (e) => {
      if (e.shiftKey && ui.layerAnchor && ui.layerAnchor !== node.id) {
        // seleção em intervalo, na ordem em que as linhas aparecem
        const order = [...tree.querySelectorAll('.layer-row')].map((r) => r.dataset.id);
        const a = order.indexOf(ui.layerAnchor), b = order.indexOf(node.id);
        if (a >= 0 && b >= 0) {
          store.setSelection(order.slice(Math.min(a, b), Math.max(a, b) + 1));
          return;
        }
      }
      ui.layerAnchor = node.id;
      if (e.ctrlKey || e.metaKey) {
        store.setSelection(selected ? ui.selection.filter((s) => s !== node.id) : [...ui.selection, node.id]);
      } else store.setSelection([node.id]);
    });
    // duplo clique no nome renomeia (cliques nos botões de cadeado/olho não contam)
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      ui.renamingId = node.id;
      store.emit('doc');
    });
    // botão direito: seleciona a camada (se ainda não estava) e abre o mesmo menu de contexto do canvas
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!selected) store.setSelection([node.id]);
      ui.contextMenu = { x: e.clientX, y: e.clientY };
      store.emit('contextmenu');
    });
    // passar o mouse na linha destaca a camada no canvas (hover), e vice-versa
    row.addEventListener('pointerenter', () => { ui.hoverId = node.id; store.emit('hover'); });
    row.addEventListener('pointerleave', () => { ui.hoverId = null; store.emit('hover'); });

    // ---- ARRASTAR E SOLTAR (HTML5 drag & drop) ----
    // dragstart: arrastar uma linha não selecionada seleciona ela primeiro. dragover: mostra um indicador conforme a zona
    // (acima / dentro / abaixo). drop: executa com commands.reparent, que mantém a posição visual das camadas.
    row.addEventListener('dragstart', (e) => {
      if (!selected) store.setSelection([node.id]);
      e.dataTransfer.setData('text/plain', node.id);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      clearDrop();
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const zone = dropZone(e, row, node);
      clearDrop();
      row.classList.add(`drop-${zone}`);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below', 'drop-inside'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const zone = dropZone(e, row, node);
      clearDrop();
      const moving = commands.topSelection();
      if (!moving.length) return;
      if (zone === 'inside') commands.reparent(moving, node);
      else {
        const parent = store.parentOf(node.id);
        const list = store.listOf(node.id);
        // lista é exibida de cima (frente) para baixo (fundo): "acima" = índice maior
        commands.reparent(moving, parent, zone === 'above' ? list.indexOf(node) + 1 : list.indexOf(node));
      }
      store.commit();
    });
    return row;
  }

  /** Alt+clique na setinha: abre ou fecha tudo dentro (recursivo). */
  function setAll(node, value) {
    ui.collapsed[node.id] = value;
    (node.children || []).forEach((c) => isContainer(c) && setAll(c, value));
  }

  /**
   * Em qual "zona" da linha o mouse está: nos 25% de cima 'above', nos 25% de baixo 'below' e no meio 'inside'
   * (só para frames/grupos, que aceitam filhos).
   */
  function dropZone(e, row, node) {
    const r = row.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (isContainer(node) && y > 0.25 && y < 0.75) return 'inside';
    return y < 0.5 ? 'above' : 'below';
  }
  /** Remove os indicadores visuais de soltura de todas as linhas. */
  const clearDrop = () => tree.querySelectorAll('.drop-above,.drop-below,.drop-inside').forEach((r) => r.classList.remove('drop-above', 'drop-below', 'drop-inside'));

  /**
   * Reconstrói a árvore. Percorre cada lista de trás para a frente (para a camada da frente ficar no topo) e só
   * desce em pastas abertas. Com texto na busca, mostra uma lista plana das camadas cujo nome contém o texto.
   * Preserva a posição de rolagem.
   */
  function renderTree() {
    const rows = [];
    const add = (list, depth) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i];
        rows.push(rowFor(n, depth));
        if (isContainer(n) && !isCollapsed(n, depth)) add(n.children, depth + 1);
      }
    };
    if (ui.layerQuery) {
      // busca: lista plana das camadas cujo nome contém o texto
      const walk = (list) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const n = list[i];
          if (n.name.toLowerCase().includes(ui.layerQuery)) rows.push(rowFor(n, 0));
          if (n.children) walk(n.children);
        }
      };
      walk(store.page().children);
      if (!rows.length) rows.push(h('div.empty-hint', 'Nenhuma camada encontrada.'));
    } else add(store.page().children, 0);
    if (!rows.length) {
      rows.push(h('div.empty-hint', 'Nenhuma camada ainda.', h('br'), 'Desenhe com ', h('kbd', 'F'), ', ', h('kbd', 'R'), ', ', h('kbd', 'E'), ' ou ', h('kbd', 'T'), '.'));
    }
    const scroll = tree.scrollTop;
    tree.replaceChildren(...rows);
    tree.scrollTop = scroll;
  }

  /**
   * "Impressão digital" do que a lista MOSTRA (ids, nomes, visibilidade, trava, pastas abertas, seleção...). Se não mudou
   * desde o último desenho (ex.: só a posição de uma camada mudou durante um arrasto), pulamos a reconstrução da lista —
   * foi isso que tornou o arrastar fluido com centenas de camadas.
   */
  function signature() {
    const parts = [ui.selection.join(','), ui.renamingId, ui.layerQuery, store.state.doc.pages.map((p) => p.id + p.name).join(','), ui.pageId];
    const walkSig = (list) => {
      for (const n of list) {
        parts.push(n.id, n.name, n.visible ? 1 : 0, n.locked ? 1 : 0, n.component ? 'c' : n.instanceOf ? 'i' : '', String(ui.collapsed[n.id]), n.children ? n.children.length : '-');
        if (n.children) walkSig(n.children);
      }
    };
    walkSig(store.page().children);
    return parts.join('|');
  }

  // últimas versões desenhadas (seleção e assinatura), para detectar o que mudou
  let lastSelKey = '';
  let lastSig = '';
  /**
   * Atualiza o painel só se algo visível mudou. Se a seleção mudou, abre as pastas dela; ao selecionar pelo canvas,
   * rola a lista até a camada.
   */
  function render(reasons) {
    const sig = signature();
    if (sig === lastSig && !reasons?.has('force')) return;
    lastSig = sig;
    const selKey = ui.selection.join(',');
    if (selKey !== lastSelKey) {
      lastSelKey = selKey;
      if (expandAncestors(ui.selection)) reasons?.add?.('ui');
    }
    renderPages();
    renderTree();
    const sel = tree.querySelector('.layer-row.selected');
    if (sel && reasons?.has('selection')) sel.scrollIntoView({ block: 'nearest' });
  }

  // Reage a documento/seleção/ui (não redesenha no meio de um arrastar-e-soltar da própria lista) e atualiza o destaque de hover sem reconstruir.
  store.subscribe((reasons) => {
    if (['doc', 'selection', 'ui'].some((r) => reasons.has(r)) && !tree.querySelector('.dragging')) render(reasons);
    else if (reasons.has('hover')) {
      tree.querySelectorAll('.layer-row.hover').forEach((r) => r.classList.remove('hover'));
      if (ui.hoverId) tree.querySelector(`.layer-row[data-id="${ui.hoverId}"]`)?.classList.add('hover');
    }
  });
  render();
}
