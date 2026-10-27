# File Tree for DSH

A workspace file tree beside the native DeepSeek Harness preview panel.

为 DeepSeek Harness（DSH）的原生预览面板添加文件树。浏览目录和打开文件时，文件树始终保留在预览区域右侧。

## 安装 / Install

```sh
dsh plugin --profile desktop add @xiaotuchu/dsh-file-tree
```

安装或更新后，完全退出并重新打开 DSH。进入会话并打开右侧预览面板，即可看到文件树；标题栏的文件夹按钮用于显示或隐藏它。

After installing or updating, fully restart DSH. Open a session and its right preview panel. Use the folder button in the panel toolbar to show or hide the tree.

## 功能 / Features

- 展开目录并点击文件，在旁边的原生预览中打开。
- 同一会话切换预览标签时保留目录展开状态和选中项。
- 筛选已展开目录中的文件；不会递归扫描未展开的目录。
- 刷新文件列表，加载失败时重试。
- 拖动文件树左边界调整宽度；分隔条支持左右方向键。
- 文件树支持上下方向键、Home / End、左右展开与折叠。
- 跟随宿主主题，使用原生工具提示。

Browse directories, open files in the native preview, filter loaded entries, refresh listings, and resize the tree. Switching preview tabs within the same session preserves the tree state. Changing sessions loads that session's workspace.

## 兼容性与限制 / Compatibility

- 当前接入依据 Windows 桌面版 DSH `0.2.1-rc.2`；清单要求 `>=0.2.1-rc.2`。
- 原生预览面板目前没有独立的文件树扩展席位，因此插件通过宿主的 DOM 标记接入。未来 DSH 版本改变这些标记时可能需要适配。
- Web profile 声明在清单中，但尚未完成独立的 Web 部署验证。
- 插件不编辑、重命名或删除工作区文件。新增或删除文件后，请手动刷新。
- 筛选只作用于已展开的目录，不是全工作区搜索。每个目录最多显示 800 项。
- 文件预览格式由 DSH 原生预览器决定。

The integration targets the Windows desktop layout in DSH `0.2.1-rc.2`. It uses native panel DOM markers, which may change in later versions. Web deployment has not been independently verified. Filtering is limited to expanded directories, and filesystem changes require a manual refresh.

## 开发 / Development

Requires Node.js 20 or later.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

- `src/client/`: 文件树、样式和原生面板接入。
- `src/node/`: 目录和文本读取接口；请求鉴权、工作区路径检查。
- `src/shared/`: 前后端协议。
- `lib/`: 随 npm 包分发的预构建产物。

The browser uses the host's React and UI components; the bundle does not include a second React runtime. Source repositories include prebuilt `lib` files so installation does not require a build step.

## 验证 / Verification

自动回归测试覆盖目录请求中断后的重新加载、刷新、选中状态、面板挂载与恢复、标签切换、会话切换、资源地址和未知会话处理。

`tests/preview-entry.ts` 是使用模拟数据的浏览器布局夹具。组件与布局检查不等于所有 DSH 版本或平台上的兼容性保证。

## License

MIT. See [LICENSE](./LICENSE).
