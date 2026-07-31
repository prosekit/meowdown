# iPhone caret 探针使用说明

这个 website 已经被改造成一个**一次性的数据收集工具**,用来在真机 iPhone Safari 上回答"自绘 caret 在触摸屏上到底出了什么问题"。分支不会合进 master。

## 跑起来

```bash
pnpm dev
```

终端会打印两个地址,用 `Network:` 那个(形如 `http://192.168.0.202:5173/`)。iPhone 连同一个 Wi-Fi,Safari 打开它。

建议同时用数据线把 iPhone 接到 Mac,打开 Safari 的「开发」菜单做远程调试:探针本身要是报错,这样能立刻看见。

## 怎么做

首页按顺序列出了 P1 到 P8。**按顺序做,一页一页来。**

每一页的结构都一样:

1. **操作步骤**:照着做就行。
2. **开关**(部分页面):改开关等于换一组实验条件,改了就把这一页的步骤重做一遍,并单独保存一份日志。
3. **编辑器**:实验对象。
4. **看到什么就点什么**:一排观察按钮。**这是整件事的关键。** 放大镜、光标像素、iOS 抓手,JavaScript 一个都看不见,只有你能看见。看到了就点一下,它会以同一个时钟插进事件时间线里。
5. **日志面板**:实时显示最近 30 条,以及总条数。做完点「保存日志」。

## 保存与回收

- 「保存日志」把当前这一轮 POST 给 dev server,落在 `website/probe-logs/` 下,文件名会显示在屏幕上。保存成功后计数清零,可以接着做下一轮。
- 页面被关掉、被 HMR 重载、误触返回,都会自动用 `sendBeacon` 补一份,不会丢。
- 万一网络出问题,「复制」按钮把整份 JSON 放进剪贴板,可以用 AirDrop 或备忘录传回来。

跑完之后,把整个 `website/probe-logs/` 目录交回来分析。

## 必须跑满的组合

P2(长按拖光标)是最重要的一页,它的开关组合决定了能不能给"放大镜消失"定罪:

| caret     | mode   | 想知道什么                                                                                                     |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `virtual` | `hide` | 现状。放大镜应该是没有的                                                                                       |
| `native`  | `hide` | 放开原生 caret 之后放大镜回来了吗?原生 caret 在隐藏语法旁边看得见吗?                                           |
| `virtual` | `show` | show 模式没有零尺寸字符,用来隔离"是 caret-color 的锅还是 font-size 的锅"                                       |
| `native`  | `show` | 全原生基准线                                                                                                   |
| `faint`   | `hide` | `rgb(0 0 0 / 1%)` 而不是 `transparent`。如果这一档有放大镜,说明抑制认的是关键字而不是透明度,那我们就能两者兼得 |
| `both`    | `hide` | 两个 caret 同时画。它们位置差多少,一眼就能看出来                                                               |

## 探针的自我约束

- **不逐条 `console.log`**:同步打印会扰动事件批处理和时序,而时序正是我们要测的东西。所有条目先进内存,保存时才落盘。
- **廉价读 vs 强制 layout**:每个事件只记属性(`pointerType`、`anchorOffset` 之类),不碰 `getClientRects`。几何测量只在 P5 发生,而且由按钮触发。
- **按钮不抢焦点**:所有探针按钮在 `pointerdown` 上 `preventDefault`,动作走 `click`。否则一点按钮就 blur 编辑器,把要记录的 selection 毁掉。
- **面板节流**:最多 250ms 更新一次,容器 `contain: strict`。怀疑面板本身有干扰时,点「暂停显示」再跑一遍做对照。
- **没有 StrictMode**:它的双重 effect 会让探针挂两次、每条记录两份。

## 日志格式

```jsonc
{
  "session": "202607311312-r42c",
  "page": "#/caret-drag",
  "startedAt": 1785000000000, // Date.now(),用来和 performance.now() 对齐
  "env": {
    "userAgent": "…",
    "maxTouchPoints": 5,
    "media": { "(pointer: coarse)": true },
    "viewport": {},
  },
  "config": { "rendering": "native", "markMode": "hide" },
  "entries": [
    {
      "seq": 42, // 单调递增,唯一排序依据
      "t": 1523.4, // performance.now()
      "kind": "event", // event | tx | mark | measure | config | mutation | note
      "name": "pointerdown",
      "detail": { "pointerType": "touch", "x": 120, "y": 340 },
      "sel": {
        "dom": { "anchor": "text(\"foo \")@p", "anchorOffset": 4, "collapsed": true },
        "pm": { "anchor": 14, "head": 14, "empty": true, "parent": "paragraph", "marks": [] },
      },
    },
  ],
}
```

`kind` 的含义:

- `event`:DOM 事件,capture 阶段记录,顺序就是浏览器的派发顺序
- `tx`:ProseMirror transaction,带 meta key(`pointer` 说明选区来自指针)
- `mark`:你点的观察按钮
- `measure`:P5 的几何测量,含四个"原生 caret 可不可见"的预测候选
- `mutation`:contenteditable 的 DOM 变更(软键盘直接改 DOM 时能看出来)
- `config` / `note`:开关变更、巡检起止
