/** Resumos de camadas e descrição em português das alterações. */
import { tagOf, DEFAULT_BREAKPOINTS } from '../../model.js';
import type { ToolArgs } from './types.ts';
/** Resumo curto de uma camada (o que a IA precisa para se orientar, sem o peso de todos os campos). */
export function summarize(n, depth = 0): ToolArgs {
  const out: ToolArgs = { id: n.id, name: n.name, type: n.type, tag: tagOf(n), w: Math.round(n.w), h: Math.round(n.h) };
  if (typeof n.note === 'string' && n.note.trim()) out.note = n.note.length > 180 ? `${n.note.slice(0, 180)}…` : n.note;
  if (n.x || n.y) Object.assign(out, { x: Math.round(n.x), y: Math.round(n.y) });
  if (n.sizeX !== 'fixed' || n.sizeY !== 'fixed') out.size = `${n.sizeX}/${n.sizeY}`;
  if (n.layout && n.layout.mode !== 'none') {
    const L = n.layout;
    out.layout = L.mode === 'grid'
      ? { mode: 'grid', cols: L.cols, colGap: L.colGap, rowGap: L.rowGap, padding: L.padding }
      : { mode: L.mode, gap: L.gap, padding: L.padding, justify: L.justify, align: L.align, ...(L.wrap ? { wrap: true } : {}) };
  }
  if (n.fill && n.fill.type !== 'none') out.fill = n.fill.type === 'solid' ? n.fill.color : n.fill.type;
  if (n.type === 'text') out.text = n.text.length > 80 ? `${n.text.slice(0, 80)}…` : n.text;
  if (!n.visible) out.visible = false;
  if (n.absolute) out.absolute = true;
  if (n.component) out.component = true;
  if (n.instanceOf) out.instanceOf = n.instanceOf;
  if (n.children?.length) {
    if (depth > 0) out.children = n.children.map((c) => summarize(c, depth - 1));
    else out.childCount = n.children.length;
  }
  return out;
}

/** Descrição em português de uma alteração, para a janela de permissão. */
export function describeCall(tool: string, args: ToolArgs, store) {
  const nm = (id) => { const n = id && store.get(id); return n ? `“${n.name}”` : `(camada ${id})`; };
  switch (tool) {
    case 'align_layers': return `Alinhar ${(args.ids || []).length} camadas (${args.alignment})`;
    case 'distribute_layers': return `Distribuir ${(args.ids || []).length} camadas (${args.axis})`;
    case 'group_layers': return `Agrupar ${(args.ids || []).length} camadas`;
    case 'ungroup_layers': return `Desagrupar ${(args.ids || []).length} grupos/seções`;
    case 'arrange_layers': {
      const what = { front: 'Trazer para a frente', forward: 'Avançar uma camada', backward: 'Recuar uma camada', back: 'Enviar para trás', flip_h: 'Espelhar na horizontal', flip_v: 'Espelhar na vertical', wrap_in_frame: 'Envolver em frame', toggle_auto_layout: 'Alternar auto layout de', create_component: 'Criar componente de', detach_instance: 'Desanexar instância de', toggle_mask: 'Alternar máscara em' }[args.action] || args.action;
      return `${what} ${(args.ids || []).map(nm).join(', ')}`;
    }
    case 'paste_layers': return `Colar cópia de ${(args.ids || []).map(nm).join(', ')}${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ''}`;
    case 'paste_style': return `Colar a aparência de ${nm(args.source_id)} em ${(args.ids || []).map(nm).join(', ')}`;
    case 'reorder_layer': return `Mover camada ${args.id} ao índice ${args.index}`;
    case 'rename_page': return `Renomear página ${args.id} para ${args.name}`;
    case 'reorder_page': return `Mover página ${args.id} ao índice ${args.index}`;
    case 'update_design_resource': return `Atualizar recurso ${args.kind} ${args.id}: ${Object.keys(args.changes || {}).join(', ')}`;
    case 'delete_design_resource': return `Remover recurso ${args.kind} ${args.id}${args.detach ? ' desligando seus vínculos' : ''}`;
    case 'update_layer': {
      const keys = Object.entries(args.props || {}).map(([k, v]) => (k === 'layout' && v && typeof v === 'object' ? Object.keys(v).map((x) => `layout.${x}`).join(', ') : k));
      return `Alterar ${nm(args.id)}: ${keys.join(', ') || '(nada)'}`;
    }
    case 'update_layers': return `Alterar ${(args.updates || []).length} camada(s) em lote: ${(args.updates || []).slice(0, 5).map((update) => nm(update.id)).join(', ')}${(args.updates || []).length > 5 ? '…' : ''}`;
    case 'create_layer': return `Criar ${args.type === 'text' ? 'um texto' : `um ${args.type}`}${args.props?.name ? ` “${args.props.name}”` : ''}${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' na página'}`;
    case 'add_asset': return `Enviar uma imagem para o projeto${args.name ? ` (“${args.name}”)` : ''}${args.insert ? ' e colocá-la no canvas' : ''}`;
    case 'insert_asset': return `Inserir a imagem do projeto${args.name ? ` “${args.name}”` : ''}${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' no canvas'}`;
    case 'delete_layers': return `Apagar ${(args.ids || []).map(nm).join(', ')}`;
    case 'move_layer': return `Mover ${nm(args.id)}${args.parent_id ? ` para ${args.parent_id === 'root' ? 'a raiz da página' : `dentro de ${nm(args.parent_id)}`}` : ''}${Number.isInteger(args.index) ? ` (posição ${args.index})` : ''}`;
    case 'undo': return 'Desfazer a última alteração (Ctrl+Z)';
    case 'build_layout': {
      let count = 0;
      const walkSpec = (s) => { if (s && typeof s === 'object') { count++; (s.children || []).forEach(walkSpec); } };
      walkSpec(args.tree);
      return `Montar “${args.tree?.props?.name || args.tree?.type || 'estrutura'}” (${count} camada${count === 1 ? '' : 's'})${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' como tela nova na página'}`;
    }
    case 'insert_icon': return `Inserir o ícone “${args.name}”${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' na página'}`;
    case 'create_color_styles': return `Criar ${(args.colors || []).length} estilo(s) de cor: ${(args.colors || []).map((c) => `${c.name} ${c.color}`).join(', ')}`;
    case 'create_page': return `Criar a página “${args.name}”`;
    case 'set_project_css': return `${String(args.css || '').trim() ? 'Substituir' : 'Limpar'} CSS global do projeto (${String(args.css || '').length} caracteres)`;
    case 'set_responsive': return `No ${(store.state.doc.breakpoints?.length ? store.state.doc.breakpoints : DEFAULT_BREAKPOINTS).find((b) => b.id === args.breakpoint)?.name || args.breakpoint}, alterar ${nm(args.id)}: ${Object.keys(args.props || {}).join(', ')}`;
    case 'set_state': return `No estado ${args.state}, alterar ${nm(args.id)}: ${Object.keys(args.props || {}).join(', ')}`;
    case 'create_component': return `Transformar ${nm(args.id)} em componente`;
    case 'create_instance': return `Criar uma cópia do componente ${nm(args.component_id)}${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' na página'}`;
    case 'duplicate_layers': return `Duplicar ${(args.ids || []).map(nm).join(', ')}`;
    case 'add_interaction': return `Protótipo: clicar em ${nm(args.id)} → ${args.action === 'navigate' ? `ir para ${nm(args.target_id)}` : args.action === 'back' ? 'voltar' : `abrir ${args.url}`}`;
    case 'add_comment': return `Comentar em ${nm(args.id)}: “${String(args.text || '').slice(0, 80)}”`;
    case 'delete_page': return `Apagar a página “${(store.state.doc.pages.find((p) => p.id === args.id) || {}).name || args.id}”`;
    case 'redo': return 'Refazer (Ctrl+Shift+Z)';
    case 'open_project': return `Abrir o projeto “${args.file}” (troca o projeto aberto)`;
    case 'save_project': return args.name ? `Salvar o projeto como “${args.name}”` : 'Salvar o projeto na pasta';
    case 'new_project': return `Começar um projeto novo${args.name ? ` “${args.name}”` : ''} (troca o projeto aberto)`;
    case 'edit_image': {
      if (args.restore_original) return `Voltar ${nm(args.id)} para a imagem original`;
      const what = [args.rotate && `girar ${args.rotate}°`, args.flip_h && 'espelhar ↔', args.flip_v && 'espelhar ↕', (args.ratio || args.crop) && `recortar${args.ratio ? ` ${args.ratio}` : ''}`,
        args.remove_background && 'remover o fundo', args.filter && args.filter !== 'none' && `filtro ${args.filter}`, args.adjust && `ajustes (${Object.keys(args.adjust).join(', ')})`,
        args.max_width && `largura máx. ${args.max_width}px`, args.format && `formato ${args.format}`].filter(Boolean);
      return `Editar a foto de ${nm(args.id)}: ${what.join(', ') || 'nada'}`;
    }
    case 'generate_image_edit': return `IA de imagem em ${nm(args.id)} (${({ fill: 'preencher área', replace: 'trocar objeto', expand: 'expandir', generate: 'imagem nova' })[args.mode] || args.mode}): “${String(args.prompt || '').slice(0, 80)}” — a imagem vai para o modelo de imagem configurado`;
    default: return tool;
  }
}
