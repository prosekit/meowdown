import { useCallback, type ReactElement } from 'react'

import {
  GEOMETRY,
  HIDDEN_RUNS,
  IME,
  LONG_PARAGRAPH,
  PLAIN_TEXT,
  WIKILINK_BULLET,
} from './content.ts'
import { getProbeView } from './editor-probe.tsx'
import { measureCaret, walkTextblock } from './geometry.ts'
import { ProbeButton, ProbePage } from './panel.tsx'
import { CaretControls, ProbeEditor, useCaretConfig } from './probe-editor.tsx'
import { record } from './recorder.ts'

export interface ProbePageDefinition {
  path: string
  title: string
  blurb: string
  render: () => ReactElement
}

function TapPage(): ReactElement {
  return (
    <ProbePage
      title="P1 点击落点与事件顺序"
      goal="确定一次点击里 touch / 合成 mouse / focus / selectionchange / click 的确切顺序和间隔。"
      steps={[
        '先点页面空白处（不要点编辑器）。',
        '点段落中间放置光标。等 2 秒。',
        '再点同一段落的另一个位置（此时编辑器已聚焦）。等 2 秒。',
        '快速连点两下选中一个词。等 2 秒。',
        '点编辑器外面让它失焦。',
        '点「保存日志」。',
      ]}
      marks={['光标出现了', '光标没出现', '落点不对', '一切正常']}
    >
      <ProbeEditor markdown={PLAIN_TEXT} markMode="hide" />
    </ProbePage>
  )
}

function CaretDragPage(): ReactElement {
  const caret = useCaretConfig({ rendering: 'virtual', markMode: 'hide' })
  return (
    <ProbePage
      title="P2 长按拖动光标与放大镜归因"
      goal="放大镜到底是不是被 caret-color: transparent 抑制的；四种 caret 渲染下各是什么表现。"
      steps={[
        '先选一组开关（caret + mode），组合改了就重新做一遍下面的步骤。',
        '在上面那段纯文字上长按并保持，等放大镜出现。',
        '不抬手指，左右拖动约两个词的距离，再抬起。',
        '立刻点下面的观察按钮：有没有放大镜、有没有看到光标。',
        '在下面那段带语法的内容上重复一次，拖动路径要跨过 **bold**。',
        '点「保存日志」。然后换下一组开关。',
        '至少要跑满：caret=virtual/native × mode=hide/show 四组。',
      ]}
      marks={[
        '有放大镜',
        '没有放大镜',
        '看到光标',
        '没看到光标',
        '两个光标位置不同',
        '拖动跟手',
        '拖动不跟手',
      ]}
      controls={<CaretControls {...caret} />}
    >
      <ProbeEditor
        markdown={`${PLAIN_TEXT}\n\n${HIDDEN_RUNS}`}
        markMode={caret.config.markMode}
        rendering={caret.config.rendering}
      />
    </ProbePage>
  )
}

function SpaceDragPage(): ReactElement {
  return (
    <ProbePage
      title="P3 虚拟键盘空格拖动与输入模态"
      goal="手指在系统键盘上滑动改光标时，网页能收到什么。这是「最近一次输入模态」启发式最可能失效的地方。"
      steps={[
        '点编辑器让软键盘升起，等键盘完全展开。',
        '长按空格键，保持不抬手。',
        '左右滑动手指改变光标位置，来回两次，然后抬起。',
        '点观察按钮记录光标有没有真的移动。',
        '如果有蓝牙键盘：连上，按左右方向键各 3 次。',
        '再按 Shift+左方向键扩选 3 次。',
        '点「保存日志」。',
      ]}
      marks={['空格拖动光标动了', '空格拖动光标没动', '方向键光标动了', '没有物理键盘', '一切正常']}
    >
      <ProbeEditor markdown={LONG_PARAGRAPH} markMode="hide" />
    </ProbePage>
  )
}

function ModalityPage(): ReactElement {
  return (
    <ProbePage
      title="P4 输入模态切换矩阵"
      goal="交替使用手指、物理键盘和指针设备，看哪些信号真的能区分它们。"
      steps={[
        '手指点一下编辑器。点「手指点击」。',
        '手指拖动光标。点「手指拖动」。',
        '（如有蓝牙键盘）按方向键。点「物理键盘」。',
        '（如有蓝牙键盘）打几个字。点「物理键盘」。',
        '手指再点一次编辑器。点「手指点击」。',
        '（如有触控板或鼠标）移动指针并点击。点「指针设备」。',
        '点「保存日志」。',
      ]}
      marks={['手指点击', '手指拖动', '物理键盘', '软键盘打字', '指针设备']}
    >
      <ProbeEditor markdown={PLAIN_TEXT} markMode="hide" />
    </ProbePage>
  )
}

function GeometryPage(): ReactElement {
  const caret = useCaretConfig({ rendering: 'native', markMode: 'hide' })

  const measure = useCallback((label: string) => {
    const view = getProbeView()
    if (view == null) {
      record('note', 'measure-skipped', { reason: 'no view' })
      return
    }
    measureCaret(view, label)
  }, [])

  const walk = useCallback(() => {
    const view = getProbeView()
    if (view == null) {
      record('note', 'walk-skipped', { reason: 'no view' })
      return
    }
    walkTextblock(view)
  }, [])

  return (
    <ProbePage
      title="P5 原生 caret 几何与可见性预测"
      goal="JS 能不能测出原生 caret 的尺寸；能不能在运行时预测它会不会因为 font-size: 0 而不可见。"
      steps={[
        '把 caret 开关设成 native（这样你看到的就是浏览器自己画的光标）。',
        '点 foo **bold** bar 那一行的任意位置，把光标放进去。',
        '点「巡检当前段落」：程序会把光标走遍这一段的每个位置并测量。',
        '巡检完，用方向键或手指把光标停在 **bold** 右边（视觉上在 bold 和 bar 之间）。',
        '点「测一次」，然后如实点「这里看得见光标」或「这里看不见光标」。',
        '在标题行首、链接后面、wikilink 两侧各重复一次「测一次」+ 观察按钮。',
        '点「保存日志」。',
      ]}
      marks={['这里看得见光标', '这里看不见光标', '光标很矮', '光标位置不对']}
      controls={
        <>
          <CaretControls {...caret} />
          <section className="mt-2 flex flex-wrap gap-2 rounded-xl border border-stone-300 p-3 dark:border-stone-700">
            <ProbeButton onPress={() => measure('manual')} tone="primary">
              测一次
            </ProbeButton>
            <ProbeButton onPress={walk}>巡检当前段落</ProbeButton>
          </section>
        </>
      }
    >
      <ProbeEditor
        markdown={GEOMETRY}
        markMode={caret.config.markMode}
        rendering={caret.config.rendering}
        trackMoves={false}
      />
    </ProbePage>
  )
}

function WikilinkBulletPage(): ReactElement {
  const caret = useCaretConfig({ rendering: 'virtual', markMode: 'hide' })
  return (
    <ProbePage
      title="P6 bullet 里只有一个 wikilink 时的光标行为"
      goal="触摸拖动光标经过「有且仅有一个 wikilink」的列表项时，selection 到底发生了什么。"
      steps={[
        '在第一条列表项里点一下放置光标。',
        '长按并向下拖动光标，慢慢经过第二条（纯 wikilink 那条），一直到第三条。',
        '抬手。点观察按钮描述你看到的现象。',
        '反方向再来一次：从第三条往上拖回第一条。',
        '（如有物理键盘）用上下方向键走一遍同样的路径做对照。',
        '在第四条（前后都有文字的那条）上再拖一次。',
        '点「保存日志」。',
      ]}
      marks={[
        '光标消失了',
        '光标跳到别处',
        '整个 wikilink 被选中',
        '整个列表项被选中',
        '拖不过去',
        '页面自己滚动了',
        '一切正常',
      ]}
      controls={<CaretControls {...caret} />}
    >
      <ProbeEditor
        markdown={WIKILINK_BULLET}
        markMode={caret.config.markMode}
        rendering={caret.config.rendering}
      />
    </ProbePage>
  )
}

function WikilinkSelectionPage(): ReactElement {
  const caret = useCaretConfig({ rendering: 'virtual', markMode: 'hide' })
  return (
    <ProbePage
      title="P7 拖动选区端点经过 wikilink bullet"
      goal="非空选区的端点被拖过纯 wikilink 列表项时的异常行为。"
      steps={[
        '双击第一条列表项里的一个词，产生非空选区。',
        '拖动选区的下端抓手向下，慢慢经过第二条（纯 wikilink），再拖回来。',
        '点观察按钮。',
        '拖动上端抓手向上，同样经过一次。',
        '点观察按钮。',
        '在第四条（前后都有文字的那条）上重复一次。',
        '点「保存日志」。',
      ]}
      marks={[
        '抓手不见了',
        '抓手跳位',
        '选区塌成光标',
        '选区和手指对不上',
        '选区吞掉整个列表项',
        '一切正常',
      ]}
      controls={<CaretControls {...caret} />}
    >
      <ProbeEditor
        markdown={WIKILINK_BULLET}
        markMode={caret.config.markMode}
        rendering={caret.config.rendering}
      />
    </ProbePage>
  )
}

function ImeKeyboardPage(): ReactElement {
  const caret = useCaretConfig({ rendering: 'virtual', markMode: 'hide' })
  return (
    <ProbePage
      title="P8 中文输入与软键盘升起"
      goal="composition 事件与 selectionchange 的交错顺序；软键盘升起对 visualViewport 和 caret 图层坐标的影响。"
      steps={[
        '切到中文键盘，在第一段里输入「你好世界」，留意候选栏。',
        '输入过程中观察光标位置对不对，点对应的观察按钮。',
        '滚动到底部，点最后一段，让软键盘把内容顶上去。',
        '看光标有没有被键盘挡住，点观察按钮。',
        '收起键盘。',
        '点「保存日志」。',
      ]}
      marks={['输入中光标位置正确', '输入中光标位置错误', '光标被键盘挡住', '光标可见', '一切正常']}
      controls={<CaretControls {...caret} />}
    >
      <ProbeEditor
        markdown={IME}
        markMode={caret.config.markMode}
        rendering={caret.config.rendering}
      />
    </ProbePage>
  )
}

export const PROBE_PAGES: readonly ProbePageDefinition[] = [
  { path: '#/tap', title: 'P1 点击落点', blurb: '一次点击的事件顺序', render: () => <TapPage /> },
  {
    path: '#/caret-drag',
    title: 'P2 长按拖光标',
    blurb: '放大镜归因，四种 caret 渲染',
    render: () => <CaretDragPage />,
  },
  {
    path: '#/space-drag',
    title: 'P3 空格键拖动',
    blurb: '软键盘拖光标，网页能看到什么',
    render: () => <SpaceDragPage />,
  },
  {
    path: '#/modality',
    title: 'P4 输入模态',
    blurb: '手指 / 物理键盘 / 指针的判别信号',
    render: () => <ModalityPage />,
  },
  {
    path: '#/caret-geometry',
    title: 'P5 caret 几何',
    blurb: '尺寸测量与可见性预测',
    render: () => <GeometryPage />,
  },
  {
    path: '#/wikilink-bullet',
    title: 'P6 wikilink bullet',
    blurb: '拖光标经过纯 wikilink 列表项',
    render: () => <WikilinkBulletPage />,
  },
  {
    path: '#/wikilink-selection',
    title: 'P7 选区端点',
    blurb: '拖选区端点经过 wikilink 列表项',
    render: () => <WikilinkSelectionPage />,
  },
  {
    path: '#/ime-keyboard',
    title: 'P8 中文输入',
    blurb: 'composition 与软键盘视口',
    render: () => <ImeKeyboardPage />,
  },
]
