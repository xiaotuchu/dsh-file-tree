export const CSS = `
[data-file-peek-layout]{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(140px,min(var(--fp-width,240px),45%));grid-template-rows:auto minmax(0,1fr)}
[data-file-peek-layout]>[data-file-peek-header]{grid-column:1/-1;grid-row:1;min-width:0}
[data-file-peek-layout]>[data-file-peek-preview]{grid-column:1;grid-row:2;min-width:0;min-height:0;width:auto!important}
.fp-host{grid-column:2;grid-row:2;position:relative;min-width:0;min-height:0;overflow:visible;pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l3,#e2e2e2);background:var(--dsw-alias-bg-base,#f7f7f7);color:var(--dsw-alias-label-primary,#252525)}
.fp-host[hidden]{display:none!important}.fp-content{height:100%;min-height:0;overflow:hidden}
.fp-tree{height:100%;min-height:0;display:flex;flex-direction:column;font-family:inherit;font-size:14px;line-height:1.5;color:inherit}
.fp-toolbar{box-sizing:border-box;display:flex;align-items:center;gap:2px;height:38px;padding:0 6px;flex:none;min-width:0;border-bottom:.5px solid var(--dsw-alias-border-l3,#e2e2e2)}
.fp-toolbar input{width:0;flex:1;min-width:0;height:27px;padding:0 4px;border:0;background:transparent;color:inherit;font:inherit;outline:none}
.fp-search-icon{font-size:19px;line-height:1;color:var(--dsw-alias-label-tertiary,#909090);padding-left:3px}
.fp-toggle,.fp-iconbtn{display:inline-flex;align-items:center;justify-content:center;flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#777);border-radius:5px;padding:0;cursor:pointer}
.fp-toggle{width:28px;height:28px;border-radius:var(--dsw-radius-sm,5px)}.fp-iconbtn{width:22px;height:24px;font:17px system-ui}
.fp-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,#e8e8e8)}
.fp-iconbtn:hover{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover,#e8e8e8) 45%,transparent)}
.fp-scroll{flex:1;min-height:0;overflow:auto;padding:0 5px 8px;scrollbar-width:thin}
.fp-row{box-sizing:border-box;display:flex;align-items:center;gap:5px;width:100%;height:28px;padding:0 6px;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:nowrap}
.fp-row:hover{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover,#ececec) 45%,transparent)}
.fp-row[aria-selected=true]{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-hover,#e5e5e5) 65%,transparent)}
.fp-row:focus-visible,.fp-iconbtn:focus-visible,.fp-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:-2px}
.fp-name{overflow:hidden;text-overflow:ellipsis}.fp-caret{display:block;width:10px;height:10px;flex:none;color:var(--dsw-alias-label-tertiary,#888);transform-origin:50% 50%}
.fp-directory[aria-expanded=true]>.fp-caret{transform:rotate(90deg)}
.fp-file-icon{width:14px;flex:none;font:600 10px/1 ui-monospace,monospace;text-align:center}
.fp-note{padding:8px 10px;color:var(--dsw-alias-label-tertiary,#888);font-size:inherit;overflow-wrap:anywhere}
.fp-error{color:var(--dsw-alias-label-secondary,#777);border-bottom:1px solid var(--dsw-alias-border-l3,#ddd)}
.fp-filter-hint{padding:5px 10px;font-size:inherit;color:var(--dsw-alias-label-tertiary,#888)}
.fp-retry{border:0;background:transparent;color:var(--dsw-alias-brand-primary,#4d6bfe);cursor:pointer}
.fp-resize{position:absolute;left:-4px;top:0;bottom:0;width:7px;z-index:3;cursor:col-resize;touch-action:none}
.fp-resize:hover,.fp-resize:focus-visible{background:var(--dsw-alias-brand-primary,#4d6bfe);opacity:.35;outline:none}
`
