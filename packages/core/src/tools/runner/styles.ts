/** Estilos compartilhados, modos de cor e variáveis de tamanho. */
import { uid } from '../../model.js';
import { addMode, addVar, bindVar, unbindVar, modesOf, varsOf, setStyleColor, syncVars } from '../../modes.js';
import { textStyleFrom } from '../../components.js';
import type { RunnerContext, ToolHandlers, ToolArgs } from './types.ts';
import { hex } from './properties.ts';
export function createStylesTools(ctx: RunnerContext): ToolHandlers {
  const { store, need } = ctx;
  return {
    create_effect_styles({ styles = [] }) {
      if (!Array.isArray(styles) || !styles.length) throw new Error('Mande a lista: styles: [{name, shadows: [{x, y, blur, spread, color, opacity}]}].');
      const made = styles.map(({ name, shadows = [] }) => {
        if (!Array.isArray(shadows) || !shadows.length) throw new Error(`O estilo "${name}" precisa de pelo menos uma sombra.`);
        return { id: uid(), name: String(name || 'Sombra').trim().slice(0, 40), shadows: shadows.map((s) => ({ x: 0, y: 4, blur: 16, spread: 0, ...{ color: '#000000' }, opacity: 0.25, inset: false, ...s, color: hex(s.color ?? '#000000') || '#000000' })) };
      });
      store.update(() => { (store.state.doc.styles.effects ||= []).push(...made); }, { commit: true });
      return { created: made.map((m) => ({ id: m.id, name: m.name })), hint: 'Ligue camadas com update_layer: {"effectStyleId": id}.' };
    },
    create_gradient_styles({ styles = [] }) {
      if (!Array.isArray(styles) || !styles.length) throw new Error('Mande a lista: styles: [{name, type, angle, stops: [{color, pos}]}].');
      const made = styles.map(({ name, type = 'linear', angle = 90, stops = [] }) => {
        if (!Array.isArray(stops) || stops.length < 2) throw new Error(`O gradiente "${name}" precisa de pelo menos 2 cores (stops).`);
        return {
          id: uid(), name: String(name || 'Gradiente').trim().slice(0, 40), type, angle: Number(angle) || 0,
          stops: stops.map((s, i) => ({ color: hex(s.color) || (() => { throw new Error(`Cor inválida em "${name}": use "#RRGGBB".`); })(), opacity: s.opacity ?? 1, pos: s.pos ?? Math.round((i / (stops.length - 1)) * 100) })),
        };
      });
      store.update(() => { (store.state.doc.styles.gradients ||= []).push(...made); }, { commit: true });
      return { created: made.map((m) => ({ id: m.id, name: m.name })), hint: 'Ligue camadas com update_layer: {"fill": {"gradientId": id}}.' };
    },
    create_text_styles({ styles = [] }) {
      if (!Array.isArray(styles) || !styles.length) throw new Error('Mande a lista: styles: [{name, fontFamily, fontSize, ...}].');
      const made = styles.map(({ name, ...rest }) => ({ id: uid(), name: String(name || 'Texto').trim().slice(0, 40), ...textStyleFrom(rest) }));
      store.update(() => { store.state.doc.styles.texts.push(...made); }, { commit: true });
      return { created: made.map((m) => ({ id: m.id, name: m.name })), hint: 'Ligue textos com apply_text_style.' };
    },
    apply_text_style({ ids = [], style_id = null }) {
      const nodes = ids.map(need);
      const st = style_id ? (store.state.doc.styles.texts || []).find((t) => t.id === style_id) : null;
      if (style_id && !st) throw new Error(`Estilo de texto "${style_id}" não existe. Veja textStyles em get_document ou crie com create_text_styles.`);
      for (const n of nodes) if (n.type !== 'text') throw new Error(`“${n.name}” não é um texto.`);
      store.update(() => { for (const n of nodes) { if (st) n.textStyleId = st.id; else delete n.textStyleId; } }, { commit: true });
      return { ok: true, linked: nodes.length };
    },
    add_color_mode({ name, scheme, auto = false }) {
      if (!String(name || '').trim()) throw new Error('Dê um nome ao modo, ex.: "Escuro".');
      let mode;
      store.update(() => { mode = addMode(store.state.doc.styles, { name, scheme: scheme || null, auto }); }, { commit: true });
      return { mode: { id: mode.id, name: mode.name, scheme: mode.scheme }, hint: auto ? 'Valores gerados por inversão de luminosidade: ajuste com set_style_color(mode_id).' : 'Os estilos começam iguais ao padrão: defina o valor deste modo com set_style_color(mode_id).' };
    },
    set_style_color({ style_id, color, mode_id, opacity }) {
      const st = (store.state.doc.styles.colors || []).find((c) => c.id === style_id);
      if (!st) throw new Error(`Estilo de cor "${style_id}" não existe. Veja colorStyles em get_document.`);
      const c = hex(color);
      if (!c) throw new Error('Cor inválida: use "#RRGGBB".');
      if (mode_id && !modesOf(store.state.doc.styles).some((m) => m.id === mode_id)) throw new Error(`Modo "${mode_id}" não existe. Veja colorModes em get_document ou crie com add_color_mode.`);
      store.update(() => { setStyleColor(st, mode_id || null, c, opacity); }, { commit: true });
      return { ok: true, style: st.name, mode_id: mode_id || null, color: c };
    },
    create_size_variables({ variables = [] }) {
      if (!Array.isArray(variables) || !variables.length) throw new Error('Mande a lista: variables: [{name, value}].');
      const out: ToolArgs[] = [];
      store.update(() => {
        for (const { name, value } of variables) {
          const existing = varsOf(store.state.doc.styles).find((v) => v.name.toLowerCase() === String(name).trim().toLowerCase());
          if (existing) { existing.value = Math.max(0, Number(value) || 0); out.push({ id: existing.id, name: existing.name, value: existing.value, updated: true }); }
          else { const v = addVar(store.state.doc.styles, name, value); out.push({ id: v.id, name: v.name, value: v.value }); }
        }
        syncVars(store.state.doc, true);
      }, { commit: true });
      return { variables: out, hint: 'Ligue camadas com bind_variable.' };
    },
    bind_variable({ ids = [], prop, variable_id = null }) {
      const nodes = ids.map(need);
      const v = variable_id ? varsOf(store.state.doc.styles).find((x) => x.id === variable_id) : null;
      if (variable_id && !v) throw new Error(`Variável "${variable_id}" não existe. Veja sizeVars em get_document ou crie com create_size_variables.`);
      const fits = (n) => (prop === 'fontSize' ? n.type === 'text' : prop === 'radius' ? true : !!n.layout && n.layout.mode !== 'none');
      const bad = nodes.find((n) => !fits(n));
      if (bad) throw new Error(`“${bad.name}” não tem ${prop}${prop === 'gap' || prop === 'padding' ? ' (só frames com layout flex/grid)' : prop === 'fontSize' ? ' (só texto)' : ''}.`);
      store.update(() => { for (const n of nodes) (v ? bindVar(n, prop, v) : unbindVar(n, prop)); }, { commit: true });
      return { ok: true, linked: nodes.length, prop, value: v?.value ?? null };
    },
    create_color_styles({ colors = [] }) {
      if (!Array.isArray(colors) || !colors.length) throw new Error('Mande a lista: colors: [{name, color: "#RRGGBB"}].');
      const made = colors.map(({ name, color }) => {
        const c = hex(color);
        if (!c) throw new Error(`Cor inválida em "${name}": use "#RRGGBB".`);
        return { id: uid(), name: String(name || 'Cor').trim().slice(0, 40), color: c, opacity: 1 };
      });
      store.update(() => { store.state.doc.styles.colors.push(...made); });
      return { created: made.map(({ id, name, color }) => ({ id, name, color })), hint: 'Ligue as camadas com fill: {"styleId": id}.' };
    }
  };
}
